// Wizard: client search + VIN selection (sessionStorage for installs list)
async function onNextClient(e) {
  e.preventDefault();
  clientStatus.innerText = "";
  
  // Track client selection step
  const clientName = clientNameInput.value.trim();
  if (window.activityTracker && clientName) {
    window.activityTracker.trackClientSelection(clientName);
  }

  // Clear previous workflow status and start fresh (only if status bar exists)
  if (document.getElementById('workflowStatusBar')) {
    clearWorkflowStatus();
    updateWorkflowStatus({
      currentStep: '1',
      status: 'Starting new workflow...'
    });
  }

  selectedClientName = clientNameInput.value.trim();
  if (!selectedClientName) {
    clientStatus.innerText = "🚨 Please enter a client name or VIN start.";
    return;
  }
  clientStatus.innerText = "↻ Fetching all installations…";

  try {
    const resp = await fetch(
      `/api/search-installations?query=${encodeURIComponent(selectedClientName)}`,
      {
        headers: getAuthHeaders()
      }
    );
    if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Search failed');
    }
    
    const installationsArray = data.installations;
    const filtered = installationsArray; // Already filtered by backend

    if (filtered.length === 0) {
      clientStatus.innerText = `❌ No installations found for "${selectedClientName}".`;
      vinSelect.innerHTML = `<option value="">-- No VINs found --</option>`;
      return;
    }

    applyJobDiscoveryPatch({
      searchQuery: selectedClientName,
      searchResults: filtered,
      selectedInstallationId: null,
      selectedVin: null,
      personDisplayName: "",
      selectedInstallation: null,
    });
    resetInstallationRunDevicesSlice();
    const jobAfterSearch = normalizeJobSlice(getInstallationRunState().job);
    buildVinSelectOptions(vinSelect, jobAfterSearch.searchResults, null);
    syncJobDiscoveryToLegacySession(jobAfterSearch, { step: "2" });

    // Update workflow status
    updateWorkflowStatus({
      currentStep: '2',
      status: `Found ${filtered.length} installation(s) for "${selectedClientName}"`
    });

    // Update sidebar and navigate to step 2
    updateStepStatus(1, 'completed');
    unlockNextStep(1);
    navigateToStep(2);

    debugPrint(filtered, "Filtered Installations");
  } catch (err) {
    console.error(err);
    clientStatus.innerText = "❌ " + err.message;
  }
}

// STEP 2 → STEP 3
function onNextVin() {
  vinStatus.innerText = "";
  const vin = vinSelect.value;
  if (!vin) {
    vinStatus.innerText = "🚨 Please select a VIN.";
    return;
  }
  selectedVIN = vin;
  selectedInstallationId = vinSelect.selectedOptions[0].dataset.installationId;

  resetDevicesIfVinOrInstallationChanged(selectedInstallationId, selectedVIN);
  
  // Track VIN selection step
  if (window.activityTracker) {
    window.activityTracker.trackVinSelection(vin, selectedClientName);
  }

  const jobSnap = normalizeJobSlice(getInstallationRunState().job);
  const filtered =
    jobSnap.searchResults && jobSnap.searchResults.length
      ? jobSnap.searchResults
      : JSON.parse(sessionStorage.getItem("filteredInst") || "[]");

  const inst = filtered.find(inst => inst.vehiculo?.serie === vin);
  let personName = "";
  if (inst && inst.persona) {
    const p = inst.persona;
    personName = [p.nombreAsegurado, p.nombreMedioAsegurado, p.apellidoPaterno, p.apellidoMaterno]
      .filter(Boolean).join(" ");
    
    // Clean up unwanted "NA" suffixes from installation data (handles " NA", " NA/", " NA /", etc.)
    personName = personName.replace(/\s+NA\s*\/?\s*$/i, "").trim();
  }

  applyJobDiscoveryPatch({
    searchQuery: selectedClientName,
    searchResults: filtered,
    selectedInstallationId: selectedInstallationId,
    selectedVin: selectedVIN,
    personDisplayName: personName,
    selectedInstallation: inst || null,
  });
  const jobAfterVin = normalizeJobSlice(getInstallationRunState().job);
  syncJobDiscoveryToLegacySession(jobAfterVin, { step: "3" });

  bindDevicesSliceToJob(selectedInstallationId, selectedVIN);

  // Update workflow status
  updateWorkflowStatus({
    currentStep: '3',
    vin: selectedVIN,
    status: `Selected VIN: ${selectedVIN}`
  });

  // Update sidebar and navigate to step 3
  updateStepStatus(2, 'completed');
  unlockNextStep(2);
  navigateToStep(3);

  hydrateDevicesFromStoreAndSync();
}
