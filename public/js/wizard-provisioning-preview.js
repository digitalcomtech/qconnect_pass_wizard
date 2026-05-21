// Read-only provisioning preview (no Pegasus mutations)

const lookupPreview = {
  primary: {
    imei: { phase: "idle" },
    sim: { phase: "idle" },
  },
  secondary: {
    imei: { phase: "idle" },
    sim: { phase: "idle" },
  },
};

function resetLookupPreviewState() {
  lookupPreview.primary = { imei: { phase: "idle" }, sim: { phase: "idle" } };
  lookupPreview.secondary = { imei: { phase: "idle" }, sim: { phase: "idle" } };
  refreshProvisioningPreview();
}

function setImeiLookupPreview(isSecondary, patch) {
  const slot = isSecondary ? lookupPreview.secondary : lookupPreview.primary;
  slot.imei = Object.assign({}, slot.imei, patch || {});
  refreshProvisioningPreview();
}

function setSimLookupPreview(isSecondary, patch) {
  const slot = isSecondary ? lookupPreview.secondary : lookupPreview.primary;
  slot.sim = Object.assign({}, slot.sim, patch || {});
  refreshProvisioningPreview();
}

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function simTypeFromIccid(iccid) {
  if (!iccid) return null;
  if (iccid.startsWith("8988")) return "SuperSIM";
  if (iccid.startsWith("8901")) return "Wireless";
  return null;
}

function formatImeiPreviewLine(label, snap) {
  if (!snap || snap.phase === "idle") return `${label}: — (lookup pending)`;
  if (snap.phase === "loading") return `${label}: looking up…`;
  if (snap.phase === "linked") {
    const v = snap.vehicleName
      ? `${snap.vehicleName}${snap.vehicleId ? " (#" + snap.vehicleId + ")" : ""}`
      : snap.vehicleId
        ? "#" + snap.vehicleId
        : "unknown vehicle";
    return `${label}: linked to ${v} (cannot provision)`;
  }
  if (snap.phase === "ok") {
    const state = snap.deviceState ? ` · ${snap.deviceState}` : "";
    return `${label}: found in Pegasus${state}`;
  }
  if (snap.phase === "warn") return `${label}: ${snap.message || "invalid format"}`;
  return `${label}: ${snap.message || "not found / error"}`;
}

function formatSimPreviewLine(label, iccid, snap) {
  const typeHint = simTypeFromIccid(iccid);
  const typeSuffix = typeHint ? ` (${typeHint})` : "";
  if (!iccid) return `${label}: — (optional, not provided)`;
  if (!snap || snap.phase === "idle") return `${label}: — (lookup pending)${typeSuffix}`;
  if (snap.phase === "loading") return `${label}: looking up…${typeSuffix}`;
  if (snap.phase === "warn") return `${label}: ${snap.message || "invalid prefix"}${typeSuffix}`;
  if (snap.phase === "ok") {
    return `${label}: found in ${snap.foundIn || "Pegasus"} · ${snap.simType || typeHint || "SIM"} · status ${snap.status || "—"}`;
  }
  return `${label}: ${snap.message || "not found / error"}${typeSuffix}`;
}

function collectProvisioningIssues() {
  const issues = [];
  const d = typeof readDevicesSliceEffective === "function" ? readDevicesSliceEffective() : null;
  const addSecondary = document.getElementById("addSecondaryUnit");
  const secondaryEnabled = addSecondary && addSecondary.checked;

  if (!selectedVIN) issues.push("Select a VIN before provisioning.");
  if (!selectedInstallationId) issues.push("Installation ID is missing.");

  const imei = imeiInput ? imeiInput.value.trim() : "";
  const imeiConfirm = document.getElementById("imeiConfirmInput")
    ? document.getElementById("imeiConfirmInput").value.trim()
    : "";
  const sim = simInput ? simInput.value.trim() : "";
  const simConfirm = document.getElementById("simConfirmInput")
    ? document.getElementById("simConfirmInput").value.trim()
    : "";

  if (!imei) issues.push("Primary IMEI is required.");
  else if (imei.length < 10) issues.push("Primary IMEI is too short.");
  else if (!imeiVerified) issues.push("Primary IMEI must be found in Pegasus (live lookup).");
  else if (lookupPreview.primary.imei.phase === "linked") {
    issues.push("Primary IMEI is already linked to another vehicle.");
  } else if (lookupPreview.primary.imei.phase === "error") {
    issues.push("Primary IMEI lookup failed or device not found.");
  }

  if (imei && imeiConfirm && imei !== imeiConfirm) {
    issues.push("Primary IMEI and confirmation do not match.");
  }

  if (sim) {
    if (sim !== simConfirm) issues.push("Primary SIM and confirmation do not match.");
    if (!simVerified) issues.push("Primary SIM must be found in Pegasus when provided.");
    else if (lookupPreview.primary.sim.phase === "error") {
      issues.push("Primary SIM lookup failed.");
    }
  }

  if (secondaryEnabled) {
    const secImei = document.getElementById("secondaryImeiInput")
      ? document.getElementById("secondaryImeiInput").value.trim()
      : "";
    const secSim = document.getElementById("secondarySimInput")
      ? document.getElementById("secondarySimInput").value.trim()
      : "";
    const secSimConfirm = document.getElementById("secondarySimConfirmInput")
      ? document.getElementById("secondarySimConfirmInput").value.trim()
      : "";

    if (!secImei) issues.push("Secondary IMEI is required when secondary unit is enabled.");
    else if (!window.secondaryImeiVerified) {
      issues.push("Secondary IMEI must be found in Pegasus.");
    } else if (lookupPreview.secondary.imei.phase === "linked") {
      issues.push("Secondary IMEI is already linked to another vehicle.");
    } else if (lookupPreview.secondary.imei.phase === "error") {
      issues.push("Secondary IMEI lookup failed.");
    }

    if (secSim) {
      if (secSim !== secSimConfirm) {
        issues.push("Secondary SIM and confirmation do not match.");
      }
      if (!secondarySimVerified) {
        issues.push("Secondary SIM must be found in Pegasus when provided.");
      } else if (lookupPreview.secondary.sim.phase === "error") {
        issues.push("Secondary SIM lookup failed.");
      }
    }
  }

  return issues;
}

function buildPlannedActions(secondaryEnabled, primarySim, secondarySim) {
  const actions = [
    "Create or update Pegasus client group",
    "Create or update / link vehicle to installation VIN",
    "Link primary device (IMEI) to vehicle",
  ];
  if (primarySim) actions.push("Process primary SIM (activate or update status)");
  if (secondaryEnabled) {
    actions.push("Process secondary device (IMEI) and secondary group/vehicle linkage");
    if (secondarySim) actions.push("Process secondary SIM");
  }
  const creds = appConfig && appConfig.credentials;
  if (creds && creds.qservicesTokenConfigured) {
    actions.push("qservices installation record / duplicate check (Bearer)");
  } else {
    actions.push("(qservices confirmation not configured — install API may still run)");
  }
  return actions;
}

function refreshProvisioningPreview() {
  const panel = document.getElementById("provisioningPreviewPanel");
  if (!panel) return;

  const client =
    sessionStorage.getItem("selectedClientFullName") || selectedClientName || "—";
  const vin = selectedVIN || "—";
  const installId = selectedInstallationId || "—";
  const env =
    appConfig && appConfig.environment
      ? String(appConfig.environment).toUpperCase()
      : "—";
  const creds = appConfig && appConfig.credentials;

  const addSecondary = document.getElementById("addSecondaryUnit");
  const secondaryEnabled = addSecondary && addSecondary.checked;
  const primarySim = simInput ? simInput.value.trim() : "";
  const secondarySim = document.getElementById("secondarySimInput")
    ? document.getElementById("secondarySimInput").value.trim()
    : "";

  const issues = collectProvisioningIssues();
  const canProceed = issues.length === 0;

  if (typeof startInstallBtn !== "undefined" && startInstallBtn) {
    startInstallBtn.disabled = !canProceed;
  }

  const credWarnings = [];
  if (creds && !creds.qservicesTokenConfigured) {
    credWarnings.push(
      "qservices Bearer token is not configured. Installation search and qservices-side confirmation may return 401. IMEI/SIM provisioning via api.pegasusgateway.com can still proceed."
    );
  }
  if (creds && !creds.deviceLookupAvailable) {
    credWarnings.push("Pegasus1 token missing — device lookup may fail.");
  }
  if (creds && !creds.simLookupAvailable) {
    credWarnings.push("Pegasus1/256 SIM tokens incomplete — SIM lookup may fail.");
  }

  const planned = buildPlannedActions(secondaryEnabled, primarySim, secondarySim);

  let html = '<div class="provisioning-preview-inner">';
  html += "<h3 class=\"provisioning-preview-title\">Provisioning preview</h3>";
  html += "<p class=\"provisioning-preview-note\">Read-only summary. No changes are sent to Pegasus until you click <strong>Provision in Pegasus</strong>.</p>";

  html += '<dl class="provisioning-preview-dl">';
  html += `<dt>Client</dt><dd>${escapeHtml(client)}</dd>`;
  html += `<dt>VIN</dt><dd>${escapeHtml(vin)}</dd>`;
  html += `<dt>Installation ID</dt><dd>${escapeHtml(installId)}</dd>`;
  html += `<dt>Environment</dt><dd>${escapeHtml(env)}</dd>`;
  html += "</dl>";

  html += '<div class="provisioning-preview-section"><strong>Device lookup</strong><ul>';
  html += `<li>${escapeHtml(formatImeiPreviewLine("Primary IMEI", lookupPreview.primary.imei))}</li>`;
  html += `<li>${escapeHtml(formatSimPreviewLine("Primary SIM", primarySim, lookupPreview.primary.sim))}</li>`;
  if (secondaryEnabled) {
    html += `<li>${escapeHtml(formatImeiPreviewLine("Secondary IMEI", lookupPreview.secondary.imei))}</li>`;
    html += `<li>${escapeHtml(formatSimPreviewLine("Secondary SIM", secondarySim, lookupPreview.secondary.sim))}</li>`;
  }
  html += "</ul></div>";

  html += '<div class="provisioning-preview-section"><strong>Planned Pegasus actions</strong><ol>';
  planned.forEach((a) => {
    html += `<li>${escapeHtml(a)}</li>`;
  });
  html += "</ol></div>";

  if (credWarnings.length) {
    html += '<div class="provisioning-preview-warn"><strong>Credential notes</strong><ul>';
    credWarnings.forEach((w) => {
      html += `<li>${escapeHtml(w)}</li>`;
    });
    html += "</ul></div>";
  }

  if (issues.length) {
    html += '<div class="provisioning-preview-blockers"><strong>Resolve before provisioning</strong><ul>';
    issues.forEach((i) => {
      html += `<li>${escapeHtml(i)}</li>`;
    });
    html += "</ul></div>";
  } else {
    html += '<p class="provisioning-preview-ready">Ready to provision in Pegasus.</p>';
  }

  html += "</div>";
  panel.innerHTML = html;
}

window.resetLookupPreviewState = resetLookupPreviewState;
window.setImeiLookupPreview = setImeiLookupPreview;
window.setSimLookupPreview = setSimLookupPreview;
window.refreshProvisioningPreview = refreshProvisioningPreview;
window.collectProvisioningIssues = collectProvisioningIssues;
