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

    navigateToStep(2);

    debugPrint(filtered, "Filtered Installations");
  } catch (err) {
    console.error(err);
    clientStatus.innerText = "❌ " + err.message;
  }
}

function applyVinSelection() {
  vinStatus.innerText = "";
  const vin = vinSelect.value;
  if (!vin) {
    selectedVIN = "";
    selectedInstallationId = "";
    var personEl = document.getElementById("selectedPersonName");
    if (personEl) personEl.textContent = "";
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
    return;
  }
  selectedVIN = vin;
  selectedInstallationId = vinSelect.selectedOptions[0].dataset.installationId;

  resetDevicesIfVinOrInstallationChanged(selectedInstallationId, selectedVIN);

  if (window.activityTracker) {
    window.activityTracker.trackVinSelection(vin, selectedClientName);
  }

  const jobSnap = normalizeJobSlice(getInstallationRunState().job);
  const filtered =
    jobSnap.searchResults && jobSnap.searchResults.length
      ? jobSnap.searchResults
      : JSON.parse(sessionStorage.getItem("filteredInst") || "[]");

  const inst = filtered.find(function (row) {
    return row.vehiculo && row.vehiculo.serie === vin;
  });
  var personName = "";
  if (inst && inst.persona) {
    const p = inst.persona;
    personName = [p.nombreAsegurado, p.nombreMedioAsegurado, p.apellidoPaterno, p.apellidoMaterno]
      .filter(Boolean)
      .join(" ");
    personName = personName.replace(/\s+NA\s*\/?\s*$/i, "").trim();
  }

  var personEl = document.getElementById("selectedPersonName");
  if (personEl) {
    personEl.textContent = personName ? "Insured: " + personName : "";
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

  updateWorkflowStatus({
    currentStep: "3",
    vin: selectedVIN,
    status: "Selected VIN: " + selectedVIN,
  });

  navigateToStep(3);

  hydrateDevicesFromStoreAndSync();
  if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
}

function onNextVin() {
  applyVinSelection();
}

window.applyVinSelection = applyVinSelection;
