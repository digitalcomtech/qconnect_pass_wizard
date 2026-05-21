// Provisioning result receipt (read-only display of /api/install outcome)

function receiptEscapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pickCorrelationId(data) {
  if (!data || typeof data !== "object") return null;
  var id =
    data.requestId ||
    data.correlationId ||
    data.correlation_id ||
    data.request_id ||
    data.runId ||
    data.run_id;
  return id != null && id !== "" ? String(id) : null;
}

function simLookupHint(isSecondary) {
  if (typeof lookupPreview === "undefined") return null;
  var slot = isSecondary ? lookupPreview.secondary : lookupPreview.primary;
  if (!slot || !slot.sim || slot.sim.phase !== "ok") return null;
  var parts = [];
  if (slot.sim.foundIn) parts.push(slot.sim.foundIn);
  if (slot.sim.simType) parts.push(slot.sim.simType);
  if (slot.sim.status) parts.push("status " + slot.sim.status);
  return parts.length ? parts.join(" · ") : null;
}

function formatLegacyStepLine(label, step) {
  if (!step) return label + ": —";
  if (step.skipped || step.action === "skipped") {
    return label + ": skipped" + (step.reason ? " (" + step.reason + ")" : "");
  }
  if (step.action === "not_applicable") {
    return label + ": not run" + (step.reason ? " — " + step.reason : "");
  }
  if (step.ok === false) {
    return label + ": failed" + (step.reason ? " — " + step.reason : "");
  }
  var bits = [label + ": OK"];
  if (step.created === true) bits.push("created");
  else if (step.created === false) bits.push("existing");
  if (step.groupId != null) bits.push("group " + step.groupId);
  if (step.vehicleId != null) bits.push("vehicle " + step.vehicleId);
  if (step.imei) bits.push("IMEI " + step.imei);
  if (step.action) bits.push(step.action);
  if (step.outcome) bits.push("outcome " + step.outcome);
  if (step.reason) bits.push(step.reason);
  return bits.join(" · ");
}

function formatNormalizedStepLine(step) {
  if (!step) return "—";
  var bits = [step.label || step.id || "Step"];
  bits.push(String(step.status || "unknown").toUpperCase());
  if (step.message) bits.push(step.message);
  if (step.data && step.data.groupId != null) bits.push("group " + step.data.groupId);
  if (step.data && step.data.vehicleId != null) bits.push("vehicle " + step.data.vehicleId);
  if (step.data && step.data.imei) bits.push("IMEI " + step.data.imei);
  if (step.data && step.data.created === true) bits.push("created");
  if (step.data && step.data.created === false) bits.push("existing");
  if (step.data && step.data.outcome) bits.push("outcome " + step.data.outcome);
  return bits.join(" · ");
}

function resolveReceiptStepLines(data, details) {
  if (details && Array.isArray(details.steps) && details.steps.length) {
    return {
      normalized: true,
      lines: details.steps.map(function (step) {
        return formatNormalizedStepLine(step);
      }),
      steps: details.steps,
    };
  }

  var steps = {};
  if (details && details.stepsByKey && typeof details.stepsByKey === "object") {
    steps = details.stepsByKey;
  } else if (details && details.steps && typeof details.steps === "object") {
    steps = details.steps;
  }
  if (!steps.qservicesDuplicateCheck && data.duplicateCheck) {
    steps.qservicesDuplicateCheck = {
      ok: false,
      outcome: data.duplicateCheck.outcome,
      reason: data.duplicateCheck.reason || null,
    };
  }

  var lines = [];
  lines.push(formatLegacyStepLine("qservices duplicate check", steps.qservicesDuplicateCheck));
  lines.push(formatLegacyStepLine("Repeats record", steps.repeatsRecord));
  lines.push(formatLegacyStepLine("Client group", steps.group));
  lines.push(formatLegacyStepLine("Vehicle", steps.vehicle));
  lines.push(formatLegacyStepLine("Primary device link", steps.primaryDeviceLink));
  lines.push(formatLegacyStepLine("Primary SIM", steps.primarySim));
  if (steps.secondary) {
    var sec = steps.secondary;
    lines.push(formatLegacyStepLine("Secondary device", sec));
    if (sec.sim) lines.push(formatLegacyStepLine("Secondary SIM", sec.sim));
    if (sec.hos && sec.hos.reason) lines.push("Secondary HOS: " + sec.hos.reason);
  }
  lines.push(formatLegacyStepLine("qservices confirmation", steps.qservicesConfirmation));
  return { normalized: false, lines: lines, steps: steps };
}

function overallResultLabel(success, httpStatus, data) {
  if (data && data.status === "partial") return "PARTIAL SUCCESS";
  if (success || (data && (data.status === "success" || data.success === true))) {
    return "SUCCESS";
  }
  if (data && data.status === "failed") return "FAILED";
  if (httpStatus === 503 && data && data.code === "DUPLICATE_CHECK_UNAVAILABLE") {
    return "FAILED";
  }
  return "FAILED";
}

function buildProvisioningReceiptModel(options) {
  var opts = options || {};
  var payload = opts.payload || {};
  var data = opts.data && typeof opts.data === "object" ? opts.data : {};
  var details = data.details && typeof data.details === "object" ? data.details : {};
  var ctx = data.context && typeof data.context === "object" ? data.context : {};
  var success = !!opts.success;
  var httpStatus = opts.httpStatus != null ? opts.httpStatus : null;
  var errorMessage = opts.errorMessage || (data.message ? String(data.message) : null);

  var stepView = resolveReceiptStepLines(data, details);

  var env =
    ctx.environment ||
    (appConfig && appConfig.environment
      ? String(appConfig.environment).toUpperCase()
      : "—");
  var client =
    ctx.clientName ||
    sessionStorage.getItem("selectedClientFullName") ||
    payload.client_name ||
    selectedClientName ||
    "—";
  var vin = ctx.vin || payload.vin || selectedVIN || "—";
  var installId = ctx.installationId || payload.installationId || selectedInstallationId || "—";
  var timestamp = data.timestamp || details.timestamp || new Date().toISOString();
  var correlationId =
    pickCorrelationId(data) ||
    (typeof readInstallSliceEffective === "function"
      ? readInstallSliceEffective().serverRunCorrelationId
      : null);

  var warnings = [];
  if (Array.isArray(details.warnings)) {
    warnings = details.warnings.slice();
  }
  if (appConfig && appConfig.credentials && !appConfig.credentials.qservicesTokenConfigured) {
    warnings.push(
      "qservices Bearer token not configured — installation search may 401; duplicate check inside /api/install still uses qservices."
    );
  }
  if (details.hosConfiguration && details.hosConfiguration.primary) {
    var primaryHosWarn = "Primary HOS: " + (details.hosConfiguration.primary.reason || "see logs");
    if (warnings.indexOf(primaryHosWarn) === -1) warnings.push(primaryHosWarn);
  }
  if (details.hosConfiguration && details.hosConfiguration.secondary) {
    var secondaryHosWarn =
      "Secondary HOS: " + (details.hosConfiguration.secondary.reason || "see logs");
    if (warnings.indexOf(secondaryHosWarn) === -1) warnings.push(secondaryHosWarn);
  }

  var errors = Array.isArray(details.errors) ? details.errors.slice() : [];
  if (!errors.length && errorMessage && !success) {
    errors.push({
      code: data.code || null,
      message: errorMessage,
      stepId: null,
    });
  }

  var primaryImei = ctx.primaryImei || payload.imei || "—";
  var primarySimLine = ctx.primarySim || payload.sim_number || "not provided";
  if (primarySimLine !== "not provided") {
    if (details.simProcessed === false) {
      primarySimLine += " (requested but simProcessed=false in response)";
    } else if (simLookupHint(false)) {
      primarySimLine += " (pre-check: " + simLookupHint(false) + ")";
    } else if (details.simProcessed) {
      primarySimLine += " (processed)";
    }
  }

  var secondaryBlock = null;
  var secondaryEnabled = ctx.secondaryEnabled || !!payload.secondary_imei;
  if (secondaryEnabled) {
    secondaryBlock = {
      imei: ctx.secondaryImei || payload.secondary_imei,
      sim: ctx.secondarySim || payload.secondary_sim_number || "not provided",
    };
    if (secondaryBlock.sim !== "not provided") {
      if (details.secondarySimProcessed === false) {
        secondaryBlock.sim += " (requested but secondarySimProcessed=false)";
      } else if (simLookupHint(true)) {
        secondaryBlock.sim += " (pre-check: " + simLookupHint(true) + ")";
      } else if (details.secondarySimProcessed) {
        secondaryBlock.sim += " (processed)";
      }
    }
  }

  return {
    overall: overallResultLabel(success, httpStatus, data),
    success: success,
    httpStatus: httpStatus,
    environment: env,
    client: client,
    vin: vin,
    installationId: installId,
    primaryImei: primaryImei,
    primarySim: primarySimLine,
    secondary: secondaryBlock,
    message: data.message || null,
    errorMessage: errorMessage,
    code: data.code || null,
    correlationId: correlationId,
    timestamp: timestamp,
    stepLines: stepView.lines,
    normalizedSteps: stepView.normalized,
    legacySteps: stepView.steps,
    errors: errors,
    warnings: warnings,
    details: details,
    rawJson: data,
  };
}

function buildCopyableReceiptSummary(model) {
  var lines = [];
  lines.push("PASS Provisioning Console — Provisioning Result Receipt");
  lines.push("Overall: " + model.overall);
  lines.push("Environment: " + model.environment);
  lines.push("HTTP: " + (model.httpStatus != null ? model.httpStatus : "—"));
  lines.push("Timestamp: " + model.timestamp);
  if (model.correlationId) lines.push("Request / correlation ID: " + model.correlationId);
  lines.push("");
  lines.push("Client: " + model.client);
  lines.push("VIN: " + model.vin);
  lines.push("Installation ID: " + model.installationId);
  lines.push("Primary IMEI: " + model.primaryImei);
  lines.push("Primary SIM: " + model.primarySim);
  if (model.secondary) {
    lines.push("Secondary IMEI: " + model.secondary.imei);
    lines.push("Secondary SIM: " + model.secondary.sim);
  }
  lines.push("");
  lines.push("— Pegasus steps —");
  model.stepLines.forEach(function (line) {
    lines.push(line);
  });
  if (model.message) lines.push("");
  if (model.message) lines.push("Message: " + model.message);
  if (model.errors.length) {
    lines.push("");
    lines.push("Errors:");
    model.errors.forEach(function (err) {
      var errLine = "- " + err.message;
      if (err.code) errLine += " (code: " + err.code + ")";
      if (err.stepId) errLine += " [step: " + err.stepId + "]";
      lines.push(errLine);
    });
  } else if (model.errorMessage) {
    lines.push("Error: " + model.errorMessage);
  }
  if (model.code) lines.push("Code: " + model.code);
  if (model.warnings.length) {
    lines.push("");
    lines.push("Warnings:");
    model.warnings.forEach(function (w) {
      lines.push("- " + w);
    });
  }
  if (model.rawJson && Object.keys(model.rawJson).length) {
    lines.push("");
    lines.push("Raw response JSON:");
    lines.push(JSON.stringify(model.rawJson, null, 2));
  }
  return lines.join("\n");
}

function renderProvisioningReceiptHtml(model) {
  var tone =
    model.overall === "SUCCESS"
      ? "receipt-success"
      : model.overall === "PARTIAL SUCCESS"
        ? "receipt-partial"
        : "receipt-failed";

  var html = '<div class="provisioning-receipt-inner ' + tone + '">';
  html +=
    '<div class="provisioning-receipt-header"><h3>Provisioning result receipt</h3>';
  html +=
    '<span class="provisioning-receipt-badge">' +
    receiptEscapeHtml(model.overall) +
    "</span></div>";

  html += '<dl class="provisioning-receipt-dl">';
  html += "<dt>Environment</dt><dd>" + receiptEscapeHtml(model.environment) + "</dd>";
  html += "<dt>HTTP status</dt><dd>" + receiptEscapeHtml(model.httpStatus != null ? model.httpStatus : "—") + "</dd>";
  html += "<dt>Timestamp</dt><dd>" + receiptEscapeHtml(model.timestamp) + "</dd>";
  if (model.correlationId) {
    html += "<dt>Request ID</dt><dd>" + receiptEscapeHtml(model.correlationId) + "</dd>";
  }
  html += "<dt>Client</dt><dd>" + receiptEscapeHtml(model.client) + "</dd>";
  html += "<dt>VIN</dt><dd>" + receiptEscapeHtml(model.vin) + "</dd>";
  html += "<dt>Installation ID</dt><dd>" + receiptEscapeHtml(model.installationId) + "</dd>";
  html += "<dt>Primary IMEI</dt><dd>" + receiptEscapeHtml(model.primaryImei) + "</dd>";
  html += "<dt>Primary SIM</dt><dd>" + receiptEscapeHtml(model.primarySim) + "</dd>";
  if (model.secondary) {
    html += "<dt>Secondary IMEI</dt><dd>" + receiptEscapeHtml(model.secondary.imei) + "</dd>";
    html += "<dt>Secondary SIM</dt><dd>" + receiptEscapeHtml(model.secondary.sim) + "</dd>";
  }
  html += "</dl>";

  html += '<div class="provisioning-receipt-section"><strong>Pegasus actions</strong><ul>';
  model.stepLines.forEach(function (line) {
    html += "<li>" + receiptEscapeHtml(line) + "</li>";
  });
  html += "</ul></div>";

  if (model.message) {
    html +=
      '<p class="provisioning-receipt-message"><strong>Server message:</strong> ' +
      receiptEscapeHtml(model.message) +
      "</p>";
  }
  if (model.errors.length) {
    html += '<div class="provisioning-receipt-error"><strong>Errors</strong><ul>';
    model.errors.forEach(function (err) {
      var item = receiptEscapeHtml(err.message);
      if (err.code) item += " <em>(" + receiptEscapeHtml(err.code) + ")</em>";
      if (err.stepId) item += " — step " + receiptEscapeHtml(err.stepId);
      html += "<li>" + item + "</li>";
    });
    html += "</ul></div>";
  } else if (model.errorMessage && model.errorMessage !== model.message) {
    html +=
      '<p class="provisioning-receipt-error"><strong>Error:</strong> ' +
      receiptEscapeHtml(model.errorMessage) +
      "</p>";
  }
  if (model.code) {
    html +=
      '<p class="provisioning-receipt-error"><strong>Code:</strong> ' +
      receiptEscapeHtml(model.code) +
      "</p>";
  }
  if (model.warnings.length) {
    html += '<div class="provisioning-receipt-warn"><strong>Warnings</strong><ul>';
    model.warnings.forEach(function (w) {
      html += "<li>" + receiptEscapeHtml(w) + "</li>";
    });
    html += "</ul></div>";
  }

  html +=
    '<div class="provisioning-receipt-actions">' +
    '<button type="button" id="copyProvisioningReceiptBtn" class="receipt-copy-btn">Copy result summary</button>' +
    '<button type="button" id="receiptStartOverBtn" class="receipt-start-over-btn">Start over</button>' +
    "</div>";
  html += "</div>";
  return html;
}

function showProvisioningResultReceipt(options) {
  window.stopPolling = true;
  sessionStorage.setItem("step", options.success ? "provisionComplete" : "provisionFailed");

  var model = buildProvisioningReceiptModel(options);
  window.lastProvisioningReceiptSummary = buildCopyableReceiptSummary(model);

  var panel = document.getElementById("provisioningReceiptPanel");
  if (panel) {
    panel.classList.remove("hidden");
    panel.innerHTML = renderProvisioningReceiptHtml(model);
    panel.setAttribute("aria-live", "polite");

    var copyBtn = document.getElementById("copyProvisioningReceiptBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = window.lastProvisioningReceiptSummary || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () {
              copyBtn.textContent = "Copied!";
              setTimeout(function () {
                copyBtn.textContent = "Copy result summary";
              }, 2000);
            },
            function () {
              window.prompt("Copy provisioning result:", text);
            }
          );
        } else {
          window.prompt("Copy provisioning result:", text);
        }
      });
    }

    var startOverBtn = document.getElementById("receiptStartOverBtn");
    if (startOverBtn) {
      startOverBtn.addEventListener("click", function () {
        if (typeof startNewWizardRunFromUserAction === "function") {
          startNewWizardRunFromUserAction();
        }
      });
    }
  }

  if (typeof installStatus !== "undefined" && installStatus) {
    installStatus.innerHTML = "";
  }

  if (typeof startInstallBtn !== "undefined" && startInstallBtn) {
    startInstallBtn.disabled = true;
  }

  var previewPanel = document.getElementById("provisioningPreviewPanel");
  if (previewPanel) {
    previewPanel.classList.add("provisioning-preview-done");
  }

  if (typeof updateWorkflowStatus === "function") {
    updateWorkflowStatus({
      currentStep: "3",
      status: options.success ? "Provisioning complete" : "Provisioning failed",
    });
  }

  if (typeof applyReportingSlicePatch === "function" && options.success) {
    applyReportingSlicePatch({ phase: "skipped" });
  }
}

function showProvisioningSuccessAfterInstall(data, payload, resp) {
  showProvisioningResultReceipt({
    success: true,
    httpStatus: resp && resp.status,
    data: data,
    payload: payload,
  });
}

function showProvisioningFailureAfterInstall(err, resp, data, payload) {
  showProvisioningResultReceipt({
    success: false,
    httpStatus: resp && resp.status,
    data: data,
    payload: payload,
    errorMessage: err && err.message ? err.message : "Provisioning failed",
  });
}

function buildReceiptPayloadFromCurrentForm() {
  var payload = {
    client_name:
      sessionStorage.getItem("selectedClientFullName") || selectedClientName || null,
    vin: selectedVIN || null,
    installationId: selectedInstallationId || null,
    imei: typeof imeiInput !== "undefined" && imeiInput ? imeiInput.value.trim() : null,
  };
  if (typeof simInput !== "undefined" && simInput && simInput.value.trim()) {
    payload.sim_number = simInput.value.trim();
  }
  var secondaryImeiEl = document.getElementById("secondaryImeiInput");
  var secondarySimEl = document.getElementById("secondarySimInput");
  if (secondaryImeiEl && secondaryImeiEl.value.trim()) {
    payload.secondary_imei = secondaryImeiEl.value.trim();
  }
  if (secondarySimEl && secondarySimEl.value.trim()) {
    payload.secondary_sim_number = secondarySimEl.value.trim();
  }
  return payload;
}

window.buildReceiptPayloadFromCurrentForm = buildReceiptPayloadFromCurrentForm;
window.showProvisioningResultReceipt = showProvisioningResultReceipt;
window.showProvisioningSuccessAfterInstall = showProvisioningSuccessAfterInstall;
window.showProvisioningFailureAfterInstall = showProvisioningFailureAfterInstall;
window.buildProvisioningReceiptModel = buildProvisioningReceiptModel;
