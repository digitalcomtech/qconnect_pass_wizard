/**
 * Single persisted InstallationRunState (Phase 5C foundation).
 * Persists under sessionStorage key "installationRun". Does not drive UI yet.
 */
(function () {
  var STORAGE_KEY = "installationRun";
  var SCHEMA_VERSION = 1;

  var _initialized = false;
  var _state = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function generateRunId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function detectLegacySessionKeys() {
    var markers = ["step", "installationId", "selectedVIN", "clientName", "filteredInst", "selectedInstallation"];
    for (var i = 0; i < markers.length; i++) {
      var v = sessionStorage.getItem(markers[i]);
      if (v != null && v !== "") return true;
    }
    return false;
  }

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

  function defaultDevicesSlice() {
    return {
      boundSelectedInstallationId: null,
      boundSelectedVin: null,
      primary: {
        imei: "",
        simIccid: "",
        imeiConfirm: "",
        simIccidConfirm: "",
        verified: { imei: false, sim: false },
      },
      secondary: {
        enabled: false,
        imei: "",
        simIccid: "",
        simIccidConfirm: "",
        verified: { imei: false, sim: false },
      },
      validationNotes: [],
    };
  }

  function defaultInstallSlice() {
    return {
      phase: "idle",
      lastSubmitAt: null,
      lastRequest: null,
      lastResponseSummary: null,
      serverRunCorrelationId: null,
    };
  }

  function defaultReportingSlice() {
    return {
      phase: "idle",
      polling: {
        startedAt: null,
        attemptCount: 0,
        lastDeviceStatusAt: null,
        lastSnapshot: null,
      },
      proximity: {
        method: null,
        lastDistanceMeters: null,
      },
      bypass: {
        offeredAt: null,
        chosen: false,
      },
    };
  }

  function defaultPaperworkSlice() {
    return {
      formOpenedAt: null,
      formUrl: null,
      operatorAcknowledgedAt: null,
    };
  }

  function defaultConfirmationSlice() {
    return {
      phase: "not_started",
      lastAttempt: null,
      lastResponseSummary: null,
      dangerousFallbackUsed: false,
    };
  }

  function createDefaultInstallationRunState(preserveRunId) {
    return {
      schemaVersion: SCHEMA_VERSION,
      runId: preserveRunId && typeof preserveRunId === "string" && preserveRunId.length > 0 ? preserveRunId : generateRunId(),
      status: "idle",
      updatedAt: nowIso(),
      job: defaultJobSlice(),
      devices: defaultDevicesSlice(),
      install: defaultInstallSlice(),
      reporting: defaultReportingSlice(),
      paperwork: defaultPaperworkSlice(),
      confirmation: defaultConfirmationSlice(),
    };
  }

  /**
   * Normalize parsed JSON to current schema. Tolerates missing fields; keeps unknown keys.
   */
  function migrateToCurrentSchema(parsed) {
    var next = Object.assign({}, parsed);
    if (typeof next.runId !== "string" || next.runId.length === 0) {
      next.runId = generateRunId();
    }
    if (typeof next.status !== "string" || next.status.length === 0) {
      next.status = "idle";
    }
    if (typeof next.updatedAt !== "string" || next.updatedAt.length === 0) {
      next.updatedAt = nowIso();
    }
    next.schemaVersion = SCHEMA_VERSION;
    if (!next.job || typeof next.job !== "object" || Array.isArray(next.job)) {
      next.job = defaultJobSlice();
    }
    if (!next.devices || typeof next.devices !== "object" || Array.isArray(next.devices)) {
      next.devices = defaultDevicesSlice();
    }
    if (!next.install || typeof next.install !== "object" || Array.isArray(next.install)) {
      next.install = defaultInstallSlice();
    }
    if (!next.reporting || typeof next.reporting !== "object" || Array.isArray(next.reporting)) {
      next.reporting = defaultReportingSlice();
    }
    if (!next.paperwork || typeof next.paperwork !== "object" || Array.isArray(next.paperwork)) {
      next.paperwork = defaultPaperworkSlice();
    }
    if (!next.confirmation || typeof next.confirmation !== "object" || Array.isArray(next.confirmation)) {
      next.confirmation = defaultConfirmationSlice();
    }
    return next;
  }

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn("[InstallationRunStore] persist failed", e);
    }
  }

  function initInstallationRunStore() {
    if (_initialized) {
      return _state;
    }
    _initialized = true;

    var raw = sessionStorage.getItem(STORAGE_KEY);

    if (raw === null || raw === "") {
      _state = createDefaultInstallationRunState();
      var hadLegacy = detectLegacySessionKeys();
      persist();
      console.log(
        "[InstallationRunStore] new run runId=" +
          _state.runId +
          (hadLegacy ? " (legacy wizard session keys present)" : "")
      );
      return _state;
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.warn("[InstallationRunStore] discarded malformed persisted state; new run", e);
      _state = createDefaultInstallationRunState();
      persist();
      console.log("[InstallationRunStore] new run runId=" + _state.runId + " (after malformed JSON)");
      return _state;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("[InstallationRunStore] discarded malformed persisted state (expected object); new run");
      _state = createDefaultInstallationRunState();
      persist();
      console.log("[InstallationRunStore] new run runId=" + _state.runId + " (after invalid shape)");
      return _state;
    }

    _state = migrateToCurrentSchema(parsed);
    persist();
    console.log("[InstallationRunStore] hydrated runId=" + _state.runId + " status=" + _state.status);
    return _state;
  }

  function getInstallationRunState() {
    if (!_initialized) {
      initInstallationRunStore();
    }
    return clone(_state);
  }

  function setInstallationRunState(next) {
    if (!_initialized) {
      initInstallationRunStore();
    }
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      console.warn("[InstallationRunStore] setInstallationRunState ignored: expected plain object");
      return clone(_state);
    }
    var base = createDefaultInstallationRunState(
      typeof next.runId === "string" && next.runId.length > 0 ? next.runId : _state.runId
    );
    _state = Object.assign({}, base, next, {
      schemaVersion: SCHEMA_VERSION,
      runId:
        typeof next.runId === "string" && next.runId.length > 0 ? next.runId : base.runId,
      updatedAt: nowIso(),
    });
    persist();
    return clone(_state);
  }

  function patchInstallationRunState(patch) {
    if (!_initialized) {
      initInstallationRunStore();
    }
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return clone(_state);
    }
    var key;
    for (key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        _state[key] = patch[key];
      }
    }
    _state.schemaVersion = SCHEMA_VERSION;
    _state.updatedAt = nowIso();
    persist();
    return clone(_state);
  }

  function resetInstallationRunState() {
    if (!_initialized) {
      initInstallationRunStore();
    }
    _state = createDefaultInstallationRunState();
    persist();
    return clone(_state);
  }

  /**
   * New wizard run: new runId + reset job/devices/install/reporting/paperwork/confirmation.
   * Does not run on page load. Does not clear legacy session keys (caller may sync separately).
   */
  function resetInstallationRunSlicesForNewWizardRun() {
    if (!_initialized) {
      initInstallationRunStore();
    }
    _state.runId = generateRunId();
    _state.status = "idle";
    _state.updatedAt = nowIso();
    _state.job = defaultJobSlice();
    _state.devices = defaultDevicesSlice();
    _state.install = defaultInstallSlice();
    _state.reporting = defaultReportingSlice();
    _state.paperwork = defaultPaperworkSlice();
    _state.confirmation = defaultConfirmationSlice();
    persist();
    return clone(_state);
  }

  window.INSTALLATION_RUN_SCHEMA_VERSION = SCHEMA_VERSION;
  window.initInstallationRunStore = initInstallationRunStore;
  window.getInstallationRunState = getInstallationRunState;
  window.setInstallationRunState = setInstallationRunState;
  window.patchInstallationRunState = patchInstallationRunState;
  window.resetInstallationRunState = resetInstallationRunState;
  window.resetInstallationRunSlicesForNewWizardRun = resetInstallationRunSlicesForNewWizardRun;
})();
