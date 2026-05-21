/**
 * installationRun-first resume: derive target from persisted slices, then apply DOM/step sync.
 * Legacy `sessionStorage.step` is used only when `hasModernResumeSignal(state)` is false.
 */
(function () {
  function hasResumableJob(state) {
    if (!state || !state.job) return false;
    var j = normalizeJobSlice(state.job);
    if (j.searchQuery && String(j.searchQuery).trim()) return true;
    if (j.searchResults && j.searchResults.length > 0) return true;
    if (j.selectedVin || j.selectedInstallationId) return true;
    return false;
  }

  function hasResumableDevices(state) {
    if (!state || !state.devices) return false;
    var d = normalizeDevicesSlice(state.devices);
    var p = d.primary;
    if ((p.imei && String(p.imei).trim()) || (p.simIccid && String(p.simIccid).trim())) return true;
    if (p.verified.imei || p.verified.sim) return true;
    if (d.secondary.enabled) {
      if (
        (d.secondary.imei && String(d.secondary.imei).trim()) ||
        (d.secondary.simIccid && String(d.secondary.simIccid).trim())
      ) {
        return true;
      }
      if (d.secondary.verified.sim) return true;
    }
    if (d.boundSelectedInstallationId || d.boundSelectedVin) return true;
    return false;
  }

  function hasInstallSucceeded(state) {
    if (!state || !state.install) return false;
    return normalizeInstallSlice(state.install).phase === "succeeded";
  }

  function hasInstallFailed(state) {
    if (!state || !state.install) return false;
    return normalizeInstallSlice(state.install).phase === "failed";
  }

  function hasReportingProgress(state) {
    if (!state || !state.reporting) return false;
    var r = normalizeReportingSlice(state.reporting);
    if (r.phase !== "idle") return true;
    if (r.polling && typeof r.polling.attemptCount === "number" && r.polling.attemptCount > 0) {
      return true;
    }
    if (r.bypass && r.bypass.chosen) return true;
    return false;
  }

  function hasPaperworkProgress(state) {
    if (!state || !state.paperwork) return false;
    var p = normalizePaperworkSlice(state.paperwork);
    return !!(p.formOpenedAt || p.operatorAcknowledgedAt);
  }

  function hasConfirmationProgress(state) {
    if (!state || !state.confirmation) return false;
    return normalizeConfirmationSlice(state.confirmation).phase !== "not_started";
  }

  function hasModernResumeSignal(state) {
    return (
      hasResumableJob(state) ||
      hasResumableDevices(state) ||
      hasInstallSucceeded(state) ||
      hasInstallFailed(state) ||
      hasReportingProgress(state) ||
      hasPaperworkProgress(state) ||
      hasConfirmationProgress(state)
    );
  }

  function jobHasSelectedInstallation(state) {
    var j = normalizeJobSlice(state.job);
    return !!(j.selectedInstallationId && j.selectedVin);
  }

  function deriveResumeTargetFromInstallationRun(state) {
    if (!state || typeof state !== "object") {
      return { source: "legacy_fallback", legacyStep: sessionStorage.getItem("step") || "1" };
    }
    if (!hasModernResumeSignal(state)) {
      return { source: "legacy_fallback", legacyStep: sessionStorage.getItem("step") || "1" };
    }

    var inst = normalizeInstallSlice(state.install);

    if (inst.phase === "failed") {
      return {
        source: "modern",
        resumeKind: "provision_failed",
        legacyStepToken: "provisionFailed",
      };
    }

    if (inst.phase === "succeeded") {
      return {
        source: "modern",
        resumeKind: "provision_complete",
        legacyStepToken: "provisionComplete",
      };
    }

    if (hasResumableDevices(state) && jobHasSelectedInstallation(state)) {
      return { source: "modern", resumeKind: "device", legacyStepToken: "3" };
    }
    if (jobHasSelectedInstallation(state)) {
      return { source: "modern", resumeKind: "device", legacyStepToken: "3" };
    }
    if (hasResumableJob(state)) {
      return { source: "modern", resumeKind: "discovery", legacyStepToken: "2" };
    }

    return { source: "modern", resumeKind: "cold", legacyStepToken: "1" };
  }

  function restoreJobAndVinForDeviceStep() {
    var job = readJobSliceEffective();
    if (!job.searchResults || job.searchResults.length === 0) {
      job = bootstrapJobSliceFromLegacySession();
    }
    if (job.searchResults && job.searchResults.length && job.selectedVin) {
      clientNameInput.value = job.searchQuery || "";
      buildVinSelectOptions(vinSelect, job.searchResults, job.selectedVin);
      selectedClientName = job.searchQuery || "";
      selectedVIN = job.selectedVin;
      selectedInstallationId = job.selectedInstallationId || "";
      syncJobDiscoveryToLegacySession(job, { step: "3" });
      if (job.selectedVin) {
        updateWorkflowStatus({
          currentStep: "3",
          vin: job.selectedVin,
          status: "Selected VIN: " + job.selectedVin,
        });
      }
      return true;
    }
    var selectedVINLegacy = sessionStorage.getItem("selectedVIN");
    var filtered = [];
    try {
      filtered = JSON.parse(sessionStorage.getItem("filteredInst") || "[]");
    } catch (e) {
      filtered = [];
    }
    if (!Array.isArray(filtered)) filtered = [];
    clientNameInput.value = sessionStorage.getItem("clientName") || "";
    buildVinSelectOptions(vinSelect, filtered, selectedVINLegacy);
    selectedClientName = sessionStorage.getItem("clientName") || "";
    selectedVIN = selectedVINLegacy || "";
    selectedInstallationId = sessionStorage.getItem("installationId") || "";
    if (filtered.length && selectedVINLegacy) {
      applyJobDiscoveryPatch(readLegacyJobSliceFromSession());
      syncJobDiscoveryToLegacySession(normalizeJobSlice(getInstallationRunState().job), { step: "3" });
    }
    if (selectedVINLegacy) {
      updateWorkflowStatus({
        currentStep: "3",
        vin: selectedVINLegacy,
        status: "Selected VIN: " + selectedVINLegacy,
      });
    }
    return true;
  }

  function restoreDiscoveryStep() {
    var job = readJobSliceEffective();
    if (!job.searchResults || job.searchResults.length === 0) {
      job = bootstrapJobSliceFromLegacySession();
    }
    clientNameInput.value = job.searchQuery || "";
    selectedClientName = job.searchQuery || "";
    buildVinSelectOptions(vinSelect, job.searchResults || [], job.selectedVin || null);
    syncJobDiscoveryToLegacySession(job, { step: "2" });
    updateWorkflowStatus({
      currentStep: "2",
      status:
        "Found " +
        (job.searchResults || []).length +
        ' installation(s) for "' +
        (job.searchQuery || "") +
        '"',
    });
    navigateToStep(2);
  }

  function applyInstallationRunResumeTarget(target) {
    if (!target || target.source !== "modern") return;

    switch (target.resumeKind) {
      case "provision_complete":
        restoreJobAndVinForDeviceStep();
        navigateToStep(3);
        if (typeof showProvisioningSuccessAfterInstall === "function") {
          var instSliceOk = normalizeInstallSlice(getInstallationRunState().install);
          var summaryOk = instSliceOk.lastResponseSummary || {};
          var resumePayloadOk =
            typeof buildReceiptPayloadFromCurrentForm === "function"
              ? buildReceiptPayloadFromCurrentForm()
              : {};
          showProvisioningSuccessAfterInstall(
            {
              status: "success",
              message: summaryOk.message,
              details: summaryOk.details || {},
            },
            resumePayloadOk,
            { status: summaryOk.httpStatus }
          );
        }
        if (target.legacyStepToken) sessionStorage.setItem("step", target.legacyStepToken);
        break;

      case "provision_failed":
        restoreJobAndVinForDeviceStep();
        navigateToStep(3);
        if (typeof showProvisioningFailureAfterInstall === "function") {
          var instSliceFail = normalizeInstallSlice(getInstallationRunState().install);
          var summaryFail = instSliceFail.lastResponseSummary || {};
          var resumePayloadFail =
            typeof buildReceiptPayloadFromCurrentForm === "function"
              ? buildReceiptPayloadFromCurrentForm()
              : {};
          showProvisioningFailureAfterInstall(
            { message: summaryFail.message || "Provisioning failed" },
            { status: summaryFail.httpStatus },
            {
              message: summaryFail.message,
              code: summaryFail.code,
              duplicateCheck: summaryFail.duplicateCheck,
            },
            resumePayloadFail
          );
        }
        if (target.legacyStepToken) sessionStorage.setItem("step", target.legacyStepToken);
        break;

      case "device":
        restoreJobAndVinForDeviceStep();
        navigateToStep(3);
        if (target.legacyStepToken) sessionStorage.setItem("step", target.legacyStepToken);
        break;

      case "discovery":
        restoreDiscoveryStep();
        break;

      case "cold":
      default:
        navigateToStep(1);
        sessionStorage.setItem("step", "1");
        break;
    }
  }

  window.hasResumableJob = hasResumableJob;
  window.hasResumableDevices = hasResumableDevices;
  window.hasInstallSucceeded = hasInstallSucceeded;
  window.hasReportingProgress = hasReportingProgress;
  window.hasPaperworkProgress = hasPaperworkProgress;
  window.hasConfirmationProgress = hasConfirmationProgress;
  window.hasModernResumeSignal = hasModernResumeSignal;
  window.deriveResumeTargetFromInstallationRun = deriveResumeTargetFromInstallationRun;
  window.applyInstallationRunResumeTarget = applyInstallationRunResumeTarget;
})();
