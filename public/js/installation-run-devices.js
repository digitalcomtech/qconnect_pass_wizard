/**
 * installationRun.devices — prepare-devices flow (authoritative) + legacy global adapter.
 * All writes go through applyDevicesDiscoveryPatch / helpers below.
 */
(function () {
  function defaultPrimary() {
    return {
      imei: "",
      simIccid: "",
      imeiConfirm: "",
      simIccidConfirm: "",
      verified: { imei: false, sim: false },
    };
  }

  function defaultSecondary() {
    return {
      enabled: false,
      imei: "",
      simIccid: "",
      simIccidConfirm: "",
      verified: { imei: false, sim: false },
    };
  }

  function defaultDevicesSlice() {
    return {
      boundSelectedInstallationId: null,
      boundSelectedVin: null,
      primary: defaultPrimary(),
      secondary: defaultSecondary(),
      validationNotes: [],
    };
  }

  function normalizeVerified(v) {
    if (!v || typeof v !== "object") {
      return { imei: false, sim: false };
    }
    return {
      imei: !!v.imei,
      sim: !!v.sim,
    };
  }

  function normalizeBoundId(v) {
    if (v == null || v === "") return null;
    return String(v);
  }

  function normalizeDevicesSlice(raw) {
    var d = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var primary = Object.assign({}, defaultPrimary(), d.primary || {});
    primary.verified = normalizeVerified(primary.verified);
    var secondary = Object.assign({}, defaultSecondary(), d.secondary || {});
    secondary.verified = normalizeVerified(secondary.verified);
    var notes = Array.isArray(d.validationNotes) ? d.validationNotes.slice() : [];
    return {
      boundSelectedInstallationId: normalizeBoundId(d.boundSelectedInstallationId),
      boundSelectedVin: normalizeBoundId(d.boundSelectedVin),
      primary: primary,
      secondary: secondary,
      validationNotes: notes,
    };
  }

  function mergeDevices(prevNorm, partial) {
    var out = normalizeDevicesSlice(prevNorm);
    if (partial.boundSelectedInstallationId !== undefined) {
      out.boundSelectedInstallationId = normalizeBoundId(partial.boundSelectedInstallationId);
    }
    if (partial.boundSelectedVin !== undefined) {
      out.boundSelectedVin = normalizeBoundId(partial.boundSelectedVin);
    }
    if (partial.primary) {
      var p = partial.primary;
      if (p.imei !== undefined) out.primary.imei = p.imei;
      if (p.simIccid !== undefined) out.primary.simIccid = p.simIccid;
      if (p.imeiConfirm !== undefined) out.primary.imeiConfirm = p.imeiConfirm;
      if (p.simIccidConfirm !== undefined) out.primary.simIccidConfirm = p.simIccidConfirm;
      if (p.verified) {
        out.primary.verified = Object.assign({}, out.primary.verified, normalizeVerified(p.verified));
      }
    }
    if (partial.secondary) {
      var s = partial.secondary;
      if (s.enabled !== undefined) out.secondary.enabled = !!s.enabled;
      if (s.imei !== undefined) out.secondary.imei = s.imei;
      if (s.simIccid !== undefined) out.secondary.simIccid = s.simIccid;
      if (s.simIccidConfirm !== undefined) out.secondary.simIccidConfirm = s.simIccidConfirm;
      if (s.verified) {
        out.secondary.verified = Object.assign({}, out.secondary.verified, normalizeVerified(s.verified));
      }
    }
    if (partial.validationNotes !== undefined) {
      out.validationNotes = Array.isArray(partial.validationNotes)
        ? partial.validationNotes.slice()
        : [];
    }
    return normalizeDevicesSlice(out);
  }

  function readDevicesSliceEffective() {
    initInstallationRunStore();
    var state = getInstallationRunState();
    return normalizeDevicesSlice(state.devices);
  }

  function applyDevicesDiscoveryPatch(partial) {
    initInstallationRunStore();
    var state = getInstallationRunState();
    var merged = mergeDevices(state.devices, partial || {});
    patchInstallationRunState({ devices: merged });
    syncDevicesSliceToLegacyGlobals(merged);
    return normalizeDevicesSlice(getInstallationRunState().devices);
  }

  /** Replace devices slice with normalized defaults (including null job association). */
  function resetInstallationRunDevicesSlice() {
    initInstallationRunStore();
    var empty = defaultDevicesSlice();
    patchInstallationRunState({ devices: empty });
    syncDevicesSliceToLegacyGlobals(empty);
    return empty;
  }

  /** Record which installation+VIN the current device form is tied to (after intentional selection). */
  function bindDevicesSliceToJob(installationId, vin) {
    applyDevicesDiscoveryPatch({
      boundSelectedInstallationId: installationId == null ? null : String(installationId),
      boundSelectedVin: vin == null ? null : String(vin),
    });
  }

  /**
   * If devices were bound to a job identity and the user picks a different installation/VIN, clear device state.
   * No-op when there was no prior association (first selection for this run).
   */
  function resetDevicesIfVinOrInstallationChanged(newInstallationId, newVin) {
    var dev = readDevicesSliceEffective();
    if (dev.boundSelectedInstallationId == null && dev.boundSelectedVin == null) {
      return;
    }
    var nid = newInstallationId != null ? String(newInstallationId) : "";
    var nvin = newVin != null ? String(newVin) : "";
    if (String(dev.boundSelectedInstallationId || "") !== nid || String(dev.boundSelectedVin || "") !== nvin) {
      resetInstallationRunDevicesSlice();
    }
  }

  /**
   * Drop stale device data when job selection is incomplete or no longer matches association.
   * Called before hydrating device inputs from the store.
   */
  function reconcileDevicesSliceWithJobIfStale() {
    initInstallationRunStore();
    var job = normalizeJobSlice(getInstallationRunState().job);
    var dev = normalizeDevicesSlice(getInstallationRunState().devices);
    var jobId = job.selectedInstallationId || null;
    var jobVin = job.selectedVin || null;

    if (!(jobId && jobVin)) {
      if (dev.boundSelectedInstallationId != null || dev.boundSelectedVin != null) {
        resetInstallationRunDevicesSlice();
      }
      return readDevicesSliceEffective();
    }

    if (dev.boundSelectedInstallationId == null && dev.boundSelectedVin == null) {
      return dev;
    }

    if (
      String(dev.boundSelectedInstallationId || "") !== String(jobId) ||
      String(dev.boundSelectedVin || "") !== String(jobVin)
    ) {
      resetInstallationRunDevicesSlice();
      return readDevicesSliceEffective();
    }

    return dev;
  }

  function collectDevicesSnapshotFromDom() {
    var cur = readDevicesSliceEffective();
    function gid(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || "").trim() : "";
    }
    var addSecondaryEl = document.getElementById("addSecondaryUnit");
    return normalizeDevicesSlice({
      boundSelectedInstallationId: cur.boundSelectedInstallationId,
      boundSelectedVin: cur.boundSelectedVin,
      primary: {
        imei: imeiInput.value.trim(),
        simIccid: simInput.value.trim(),
        imeiConfirm: gid("imeiConfirmInput"),
        simIccidConfirm: gid("simConfirmInput"),
        verified: cur.primary.verified,
      },
      secondary: {
        enabled: addSecondaryEl ? !!addSecondaryEl.checked : false,
        imei: gid("secondaryImeiInput"),
        simIccid: gid("secondarySimInput"),
        simIccidConfirm: gid("secondarySimConfirmInput"),
        verified: cur.secondary.verified,
      },
      validationNotes: cur.validationNotes,
    });
  }

  function applyDevicesSnapshotFromDom() {
    return applyDevicesDiscoveryPatch(collectDevicesSnapshotFromDom());
  }

  function hydrateDeviceInputsFromSnapshot(devices) {
    var d = normalizeDevicesSlice(devices);
    imeiInput.value = d.primary.imei || "";
    simInput.value = d.primary.simIccid || "";
    var imeiConfirm = document.getElementById("imeiConfirmInput");
    var simConfirm = document.getElementById("simConfirmInput");
    if (imeiConfirm) imeiConfirm.value = d.primary.imeiConfirm || "";
    if (simConfirm) simConfirm.value = d.primary.simIccidConfirm || "";
    var addSecondary = document.getElementById("addSecondaryUnit");
    var secondaryFields = document.getElementById("secondaryUnitFields");
    if (addSecondary) addSecondary.checked = !!d.secondary.enabled;
    if (secondaryFields) secondaryFields.classList.toggle("hidden", !d.secondary.enabled);
    var secImei = document.getElementById("secondaryImeiInput");
    var secSim = document.getElementById("secondarySimInput");
    var secSimC = document.getElementById("secondarySimConfirmInput");
    if (secImei) secImei.value = d.secondary.imei || "";
    if (secSim) secSim.value = d.secondary.simIccid || "";
    if (secSimC) secSimC.value = d.secondary.simIccidConfirm || "";
  }

  function syncDevicesSliceToLegacyGlobals(devices) {
    var d = normalizeDevicesSlice(devices);
    imeiVerified = !!d.primary.verified.imei;
    simVerified = !!d.primary.verified.sim;
    secondarySimVerified = !!d.secondary.verified.sim;
    window.secondaryImeiVerified = !!d.secondary.verified.imei;
    if (typeof startInstallBtn !== "undefined" && startInstallBtn) {
      startInstallBtn.disabled = !imeiVerified;
    }
  }

  /** Centralized: primary IMEI text changed → clear IMEI verification in store + legacy globals. */
  function invalidatePrimaryImeiVerificationInStore() {
    var d = readDevicesSliceEffective();
    applyDevicesDiscoveryPatch({
      primary: {
        imei: imeiInput.value.trim(),
        verified: { imei: false, sim: d.primary.verified.sim },
      },
    });
  }

  /** Centralized: primary SIM ICCID changed → clear SIM verification in store + legacy globals. */
  function invalidatePrimarySimVerificationInStore() {
    var d = readDevicesSliceEffective();
    applyDevicesDiscoveryPatch({
      primary: {
        simIccid: simInput.value.trim(),
        verified: { imei: d.primary.verified.imei, sim: false },
      },
    });
  }

  /** Centralized: secondary SIM ICCID changed → clear secondary SIM verification. */
  function invalidateSecondarySimVerificationInStore() {
    var d = readDevicesSliceEffective();
    applyDevicesDiscoveryPatch({
      secondary: {
        simIccid: document.getElementById("secondarySimInput").value.trim(),
        verified: { imei: d.secondary.verified.imei, sim: false },
      },
    });
  }

  /** Secondary IMEI edits do not currently use API verify; keep persisted values and clear secondary IMEI verified flag. */
  function invalidateSecondaryImeiVerificationInStore() {
    var d = readDevicesSliceEffective();
    applyDevicesDiscoveryPatch({
      secondary: {
        imei: document.getElementById("secondaryImeiInput").value.trim(),
        verified: { imei: false, sim: d.secondary.verified.sim },
      },
    });
  }

  function hydrateDevicesFromStoreAndSync() {
    reconcileDevicesSliceWithJobIfStale();
    var d = readDevicesSliceEffective();
    hydrateDeviceInputsFromSnapshot(d);
    syncDevicesSliceToLegacyGlobals(d);
  }

  window.normalizeDevicesSlice = normalizeDevicesSlice;
  window.readDevicesSliceEffective = readDevicesSliceEffective;
  window.applyDevicesDiscoveryPatch = applyDevicesDiscoveryPatch;
  window.collectDevicesSnapshotFromDom = collectDevicesSnapshotFromDom;
  window.applyDevicesSnapshotFromDom = applyDevicesSnapshotFromDom;
  window.hydrateDeviceInputsFromSnapshot = hydrateDeviceInputsFromSnapshot;
  window.syncDevicesSliceToLegacyGlobals = syncDevicesSliceToLegacyGlobals;
  window.invalidatePrimaryImeiVerificationInStore = invalidatePrimaryImeiVerificationInStore;
  window.invalidatePrimarySimVerificationInStore = invalidatePrimarySimVerificationInStore;
  window.invalidateSecondarySimVerificationInStore = invalidateSecondarySimVerificationInStore;
  window.invalidateSecondaryImeiVerificationInStore = invalidateSecondaryImeiVerificationInStore;
  window.hydrateDevicesFromStoreAndSync = hydrateDevicesFromStoreAndSync;
  window.resetInstallationRunDevicesSlice = resetInstallationRunDevicesSlice;
  window.bindDevicesSliceToJob = bindDevicesSliceToJob;
  window.resetDevicesIfVinOrInstallationChanged = resetDevicesIfVinOrInstallationChanged;
  window.reconcileDevicesSliceWithJobIfStale = reconcileDevicesSliceWithJobIfStale;
})();
