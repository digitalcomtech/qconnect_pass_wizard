// Wizard: client search + VIN selection (sessionStorage for installs list)
async function onNextClient(e) {
  e.preventDefault();
  setClientSearchStatus("", "");

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
    setClientSearchStatus("error", "Please enter a client name or VIN prefix.");
    setVinSectionState("disabled");
    return;
  }

  setClientSearchStatus("loading", "Fetching installations…");
  setVinSectionState("loading");
  selectedVIN = "";
  selectedInstallationId = "";

  try {
    const resp = await fetch(
      `/api/search-installations?query=${encodeURIComponent(selectedClientName)}`,
      {
        headers: getAuthHeaders()
      }
    );
    const data = await resp.json();

    if (!resp.ok || !data.success) {
      const msg =
        typeof formatPegasusApiError === "function"
          ? formatPegasusApiError(resp, data, "search")
          : data.message || `Search failed: ${resp.status}`;
      throw new Error(msg);
    }

    const installationsArray = data.installations || [];
    const filtered = installationsArray;
    const totalFetched =
      data.totalFetched != null
        ? data.totalFetched
        : data.totalCount != null
          ? data.totalCount
          : null;
    const matchedCount =
      data.matchedCount != null
        ? data.matchedCount
        : data.totalFound != null
          ? data.totalFound
          : filtered.length;

    if (filtered.length === 0) {
      setClientSearchStatus(
        "warn",
        formatSearchZeroMessage(totalFetched, selectedClientName)
      );
      setVinSectionState("empty");
      applyJobDiscoveryPatch({
        searchQuery: selectedClientName,
        searchResults: [],
        selectedInstallationId: null,
        selectedVin: null,
        personDisplayName: "",
        selectedInstallation: null,
      });
      return;
    }

    setClientSearchStatus(
      "success",
      formatSearchSuccessMessage(totalFetched, matchedCount, selectedClientName)
    );
    setVinSectionState("ready");

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

    updateWorkflowStatus({
      currentStep: '2',
      status: `Found ${matchedCount} installation(s) for "${selectedClientName}"`
    });

    navigateToStep(2);

    debugPrint(filtered, "Filtered Installations");
  } catch (err) {
    console.error(err);
    setClientSearchStatus("error", err.message);
    setVinSectionState("disabled");
  }
}

function applyVinSelection() {
  const vin = vinSelect.value;
  if (!vin) {
    selectedVIN = "";
    selectedInstallationId = "";
    var personEl = document.getElementById("selectedPersonName");
    if (personEl) personEl.textContent = "";
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
    if (!vinSelect.disabled) {
      setVinHintStatus("Select a VIN to continue.", "success");
    }
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

  setVinHintStatus("Selected VIN: " + selectedVIN, "success");

  navigateToStep(3);

  hydrateDevicesFromStoreAndSync();
  if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
}

function onNextVin() {
  applyVinSelection();
}

window.applyVinSelection = applyVinSelection;
