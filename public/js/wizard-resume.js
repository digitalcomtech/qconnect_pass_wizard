// Wizard: back navigation + sessionStorage restore on reload (installationRun-first resume)

function onBackToClient() {
  vinSection.classList.add("hidden");
  clientSection.classList.remove("hidden");
  
  // Update sidebar navigation
  updateStepStatus(2, 'pending');
  navigateToStep(1);
  
  // Track step navigation
  if (window.activityTracker) {
    window.activityTracker.trackStep('navigation', {
      action: 'back_to_client',
      from: 'vinSelection',
      to: 'clientSelection'
    });
  }
}

function onBackToVin() {
  deviceSection.classList.add("hidden");
  vinSection.classList.remove("hidden");
  
  // Update sidebar navigation
  updateStepStatus(3, 'pending');
  navigateToStep(2);
  
  // Track step navigation
  if (window.activityTracker) {
    window.activityTracker.trackStep('navigation', {
      action: 'back_to_vin',
      from: 'deviceSetup',
      to: 'vinSelection'
    });
  }
}

/** Legacy `sessionStorage.step` paths when installationRun has no resumable modern signal. */
function applyLegacyWizardResume(step) {
  if (step === "waitingForDevice") {
    applyInstallationRunResumeTarget({
      source: "modern",
      resumeKind: "waiting_reporting",
      legacyStepToken: "waitingForDevice",
    });
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
      currentStep: '2',
      status: `Found ${(job.searchResults || []).length} installation(s) for "${job.searchQuery || ""}"`
    });
    
    updateStepStatus(1, 'completed');
    unlockNextStep(1);
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
      updateStepStatus(1, 'completed');
      unlockNextStep(1);
      updateStepStatus(2, 'completed');
      unlockNextStep(2);
      navigateToStep(3);
      if (job.selectedVin) {
        updateWorkflowStatus({
          currentStep: '3',
          vin: job.selectedVin,
          status: `Selected VIN: ${job.selectedVin}`
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
        syncJobDiscoveryToLegacySession(normalizeJobSlice(getInstallationRunState().job), { step: "3" });
      }
      updateStepStatus(1, 'completed');
      unlockNextStep(1);
      updateStepStatus(2, 'completed');
      unlockNextStep(2);
      navigateToStep(3);
      if (selectedVINLegacy) {
        updateWorkflowStatus({
          currentStep: '3',
          vin: selectedVINLegacy,
          status: `Selected VIN: ${selectedVINLegacy}`
        });
      }
    }
    
  } else if (step === "confirmation") {
    updateStepStatus(5, 'completed');
    unlockNextStep(5);
    navigateToStep(6);
    
  } else if (step === "done") {
    successMsg.style.display = "block";
    updateStepStatus(1, 'completed');
    updateStepStatus(2, 'completed');
    updateStepStatus(3, 'completed');
    updateStepStatus(4, 'completed');
    updateStepStatus(5, 'completed');
    updateStepStatus(6, 'completed');
    
  } else {
    navigateToStep(1);
  }
}

function restoreState() {
  // Clear device verification messages (globals follow installationRun.devices after hydrate)
  imeiVerificationStatus.innerHTML = "";
  simVerificationStatus.innerHTML = "";
  document.getElementById("secondarySimVerificationStatus").innerHTML = "";
  
  // Add location permission request button if geolocation is supported
  if (navigator.geolocation) {
    const locationPermissionBtn = document.createElement("button");
    locationPermissionBtn.type = "button";
    locationPermissionBtn.textContent = "📍 Request Location Permission";
    locationPermissionBtn.style.cssText = "background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); color: white; font-size: 0.9rem; padding: 10px 18px; margin-top: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);";
    locationPermissionBtn.addEventListener("click", requestLocationPermission);
    
    const contentContainer = document.querySelector(".content-container");
    if (contentContainer) {
      const locationOptionsDiv = contentContainer.querySelector('[style*="background: #e8f4fd"]');
      if (locationOptionsDiv) {
        locationOptionsDiv.appendChild(locationPermissionBtn);
      }
    }
  }

  readJobSliceEffective();
  var state = getInstallationRunState();
  // Prefer installationRun-derived resume; legacy `sessionStorage.step` only when modern state is insufficient.
  var target = deriveResumeTargetFromInstallationRun(state);

  if (target.source === "modern") {
    applyInstallationRunResumeTarget(target);
  } else {
    applyLegacyWizardResume(target.legacyStep || sessionStorage.getItem("step") || "1");
  }

  hydrateDevicesFromStoreAndSync();
}
