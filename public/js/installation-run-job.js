/**
 * installationRun.job — discovery flow mapping (authoritative) + legacy sessionStorage adapter.
 */
(function () {
  function defaultJobSlice() {
    return {
      searchQuery: "",
      searchResults: [],
      selectedInstallationId: null,
      selectedVin: null,
      personDisplayName: "",
      selectedInstallation: null,
    };
  }

  function normalizeJobSlice(job) {
    var j = Object.assign({}, defaultJobSlice(), job || {});
    if (!Array.isArray(j.searchResults)) {
      j.searchResults = [];
    }
    if (j.selectedInstallationId === "") j.selectedInstallationId = null;
    if (j.selectedVin === "") j.selectedVin = null;
    return j;
  }

  function parseJsonArray(raw) {
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function parseSelectedInstallationRaw(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function legacyImportJobFromSession() {
    return {
      searchQuery: sessionStorage.getItem("clientName") || "",
      searchResults: parseJsonArray(sessionStorage.getItem("filteredInst")),
      selectedInstallationId: sessionStorage.getItem("installationId") || null,
      selectedVin: sessionStorage.getItem("selectedVIN") || null,
      personDisplayName: sessionStorage.getItem("selectedClientFullName") || "",
      selectedInstallation: parseSelectedInstallationRaw(sessionStorage.getItem("selectedInstallation")),
    };
  }

  function findInstallationByVin(installations, vin) {
    if (!vin || !installations || !installations.length) return null;
    for (var i = 0; i < installations.length; i++) {
      var inst = installations[i];
      if (inst && inst.vehiculo && inst.vehiculo.serie === vin) return inst;
    }
    return null;
  }

  /**
   * Prefer installationRun.job; backfill from legacy session keys when the store is incomplete.
   */
  function readJobSliceEffective() {
    initInstallationRunStore();
    var state = getInstallationRunState();
    var job = normalizeJobSlice(state.job);
    var legacy = legacyImportJobFromSession();
    var mutated = false;

    if (job.searchResults.length === 0 && legacy.searchResults.length > 0) {
      job = normalizeJobSlice(Object.assign({}, job, { searchResults: legacy.searchResults }));
      if (!job.searchQuery && legacy.searchQuery) {
        job.searchQuery = legacy.searchQuery;
      }
      mutated = true;
    }

    if (job.selectedVin && !job.selectedInstallation) {
      var fromList = findInstallationByVin(job.searchResults, job.selectedVin);
      if (fromList) {
        job.selectedInstallation = fromList;
        if (!job.selectedInstallationId) job.selectedInstallationId = fromList._id;
        mutated = true;
      } else if (legacy.selectedInstallation && legacy.selectedInstallation.vehiculo && legacy.selectedInstallation.vehiculo.serie === job.selectedVin) {
        job.selectedInstallation = legacy.selectedInstallation;
        if (!job.selectedInstallationId) job.selectedInstallationId = legacy.selectedInstallation._id;
        mutated = true;
      }
    }

    if (job.selectedVin && !job.personDisplayName && legacy.personDisplayName) {
      job.personDisplayName = legacy.personDisplayName;
      mutated = true;
    }

    if (mutated) {
      patchInstallationRunState({ job: job });
    }

    return normalizeJobSlice(getInstallationRunState().job);
  }

  function applyJobDiscoveryPatch(partial) {
    initInstallationRunStore();
    var state = getInstallationRunState();
    var job = normalizeJobSlice(state.job);
    var key;
    for (key in partial) {
      if (Object.prototype.hasOwnProperty.call(partial, key)) {
        job[key] = partial[key];
      }
    }
    patchInstallationRunState({ job: job });
    return normalizeJobSlice(getInstallationRunState().job);
  }

  /**
   * Keeps legacy keys in sync for modules not yet migrated (install, polling, confirm, etc.).
   * @param {object} job — normalized job slice
   * @param {{ step?: string }} opts — optional step ("1"|"2"|"3"|…)
   */
  function syncJobDiscoveryToLegacySession(job, opts) {
    var j = normalizeJobSlice(job);
    opts = opts || {};
    sessionStorage.setItem("clientName", j.searchQuery || "");
    sessionStorage.setItem("filteredInst", JSON.stringify(j.searchResults || []));
    if (j.selectedVin) {
      sessionStorage.setItem("selectedVIN", j.selectedVin);
    } else {
      sessionStorage.removeItem("selectedVIN");
    }
    if (j.selectedInstallationId) {
      sessionStorage.setItem("installationId", j.selectedInstallationId);
    } else {
      sessionStorage.removeItem("installationId");
    }
    sessionStorage.setItem("selectedClientFullName", j.personDisplayName || "");
    if (j.selectedInstallation) {
      sessionStorage.setItem("selectedInstallation", JSON.stringify(j.selectedInstallation));
    } else {
      sessionStorage.removeItem("selectedInstallation");
    }
    if (opts.step != null && opts.step !== "") {
      sessionStorage.setItem("step", String(opts.step));
    }
  }

  function buildVinSelectOptions(vinSelectEl, installations, selectedVin) {
    vinSelectEl.innerHTML = '<option value="">-- Select VIN --</option>';
    if (!installations || !installations.length) return;
    installations.forEach(function (inst) {
      var vin = inst.vehiculo && inst.vehiculo.serie;
      if (!vin) return;
      var p = inst.persona || {};
      var fullName = [p.nombreAsegurado, p.nombreMedioAsegurado, p.apellidoPaterno, p.apellidoMaterno]
        .filter(Boolean)
        .join(" ");
      var opt = document.createElement("option");
      opt.value = vin;
      opt.textContent = fullName ? vin + " — " + fullName : vin;
      opt.dataset.installationId = inst._id;
      if (selectedVin && vin === selectedVin) {
        opt.selected = true;
      }
      vinSelectEl.appendChild(opt);
    });
  }

  /**
   * When session step implies discovery data but the store is empty, copy legacy keys into job once.
   */
  function bootstrapJobSliceFromLegacySession() {
    var legacy = legacyImportJobFromSession();
    if (!legacy.searchResults || legacy.searchResults.length === 0) {
      return normalizeJobSlice(getInstallationRunState().job);
    }
    applyJobDiscoveryPatch(legacy);
    return readJobSliceEffective();
  }

  window.normalizeJobSlice = normalizeJobSlice;
  window.readJobSliceEffective = readJobSliceEffective;
  window.applyJobDiscoveryPatch = applyJobDiscoveryPatch;
  window.syncJobDiscoveryToLegacySession = syncJobDiscoveryToLegacySession;
  window.buildVinSelectOptions = buildVinSelectOptions;
  window.bootstrapJobSliceFromLegacySession = bootstrapJobSliceFromLegacySession;
  window.readLegacyJobSliceFromSession = legacyImportJobFromSession;
})();
