// Wizard: back navigation + sessionStorage restore on reload (installationRun-first resume)

function resumeProvisionReceipt(step) {
  navigateToStep(3);
  var inst =
    typeof readInstallSliceEffective === "function" ? readInstallSliceEffective() : {};
  var summary = inst.lastResponseSummary || {};
  var payload =
    typeof buildReceiptPayloadFromCurrentForm === "function"
      ? buildReceiptPayloadFromCurrentForm()
      : {};

  if (step === "provisionComplete" && typeof showProvisioningSuccessAfterInstall === "function") {
    showProvisioningSuccessAfterInstall(
      { status: "success", message: summary.message, details: summary.details || {} },
      payload,
      { status: summary.httpStatus }
    );
    return;
  }

  if (step === "provisionFailed" && typeof showProvisioningFailureAfterInstall === "function") {
    showProvisioningFailureAfterInstall(
      { message: summary.message || "Provisioning failed" },
      { status: summary.httpStatus },
      {
        message: summary.message,
        code: summary.code,
        duplicateCheck: summary.duplicateCheck,
      },
      payload
    );
  }
}

/** Legacy `sessionStorage.step` when installationRun has no resumable modern signal. */
function applyLegacyWizardResume(step) {
  if (step === "provisionComplete" || step === "provisionFailed") {
    resumeProvisionReceipt(step);
    return;
  }

  if (step === "waitingForDevice" || step === "confirmation" || step === "done") {
    navigateToStep(3);
    sessionStorage.setItem("step", "provisionComplete");
    if (typeof installStatus !== "undefined" && installStatus) {
      installStatus.innerHTML =
        '<span style="color:#64748b;">Previous session ended after provisioning. Start over or provision again.</span>';
    }
    return;
  }

  if (step === "2") {
    let job = readJobSliceEffective();
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
        'Found ' +
        (job.searchResults || []).length +
        ' installation(s) for "' +
        (job.searchQuery || "") +
        '"',
    });

    navigateToStep(2);
  } else if (step === "3") {
    let job = readJobSliceEffective();
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
      navigateToStep(3);
      if (job.selectedVin) {
        updateWorkflowStatus({
          currentStep: "3",
          vin: job.selectedVin,
          status: "Selected VIN: " + job.selectedVin,
        });
      }
    } else {
      const selectedVINLegacy = sessionStorage.getItem("selectedVIN");
      let filtered = [];
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
        syncJobDiscoveryToLegacySession(normalizeJobSlice(getInstallationRunState().job), {
          step: "3",
        });
      }
      navigateToStep(3);
      if (selectedVINLegacy) {
        updateWorkflowStatus({
          currentStep: "3",
          vin: selectedVINLegacy,
          status: "Selected VIN: " + selectedVINLegacy,
        });
      }
    }
  } else {
    navigateToStep(1);
  }
}

function restoreState() {
  imeiVerificationStatus.innerHTML = "";
  simVerificationStatus.innerHTML = "";
  var secImeiStatus = document.getElementById("secondaryImeiVerificationStatus");
  if (secImeiStatus) secImeiStatus.innerHTML = "";
  document.getElementById("secondarySimVerificationStatus").innerHTML = "";

  readJobSliceEffective();
  var state = getInstallationRunState();
  var target = deriveResumeTargetFromInstallationRun(state);

  if (target.source === "modern") {
    applyInstallationRunResumeTarget(target);
  } else {
    applyLegacyWizardResume(target.legacyStep || sessionStorage.getItem("step") || "1");
  }

  hydrateDevicesFromStoreAndSync();
}
