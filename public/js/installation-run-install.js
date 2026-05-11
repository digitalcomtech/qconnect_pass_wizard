/**
 * installationRun.install — /api/install submit metadata (redacted, non-secret).
 * All install-slice writes go through helpers in this module.
 */
(function () {
  var PHASES = { idle: true, submitting: true, succeeded: true, failed: true };

  function defaultInstallSlice() {
    return {
      phase: "idle",
      lastSubmitAt: null,
      lastRequest: null,
      lastResponseSummary: null,
      serverRunCorrelationId: null,
    };
  }

  function normalizePhase(p) {
    if (p && PHASES[p]) return p;
    return "idle";
  }

  function normalizeInstallSlice(raw) {
    var x = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var out = defaultInstallSlice();
    out.phase = normalizePhase(x.phase);
    out.lastSubmitAt = typeof x.lastSubmitAt === "string" && x.lastSubmitAt.length > 0 ? x.lastSubmitAt : null;
    out.lastRequest = x.lastRequest != null && typeof x.lastRequest === "object" && !Array.isArray(x.lastRequest) ? x.lastRequest : null;
    out.lastResponseSummary =
      x.lastResponseSummary != null && typeof x.lastResponseSummary === "object" && !Array.isArray(x.lastResponseSummary)
        ? x.lastResponseSummary
        : null;
    out.serverRunCorrelationId =
      x.serverRunCorrelationId != null && x.serverRunCorrelationId !== ""
        ? String(x.serverRunCorrelationId)
        : null;
    return out;
  }

  function mergeInstall(prevNorm, partial) {
    var out = normalizeInstallSlice(prevNorm);
    if (!partial || typeof partial !== "object") return out;
    if (partial.phase !== undefined) out.phase = normalizePhase(partial.phase);
    if (partial.lastSubmitAt !== undefined) {
      out.lastSubmitAt =
        partial.lastSubmitAt == null || partial.lastSubmitAt === ""
          ? null
          : String(partial.lastSubmitAt);
    }
    if (partial.lastRequest !== undefined) {
      out.lastRequest =
        partial.lastRequest == null
          ? null
          : typeof partial.lastRequest === "object" && !Array.isArray(partial.lastRequest)
            ? partial.lastRequest
            : null;
    }
    if (partial.lastResponseSummary !== undefined) {
      out.lastResponseSummary =
        partial.lastResponseSummary == null
          ? null
          : typeof partial.lastResponseSummary === "object" && !Array.isArray(partial.lastResponseSummary)
            ? partial.lastResponseSummary
            : null;
    }
    if (partial.serverRunCorrelationId !== undefined) {
      out.serverRunCorrelationId =
        partial.serverRunCorrelationId == null || partial.serverRunCorrelationId === ""
          ? null
          : String(partial.serverRunCorrelationId);
    }
    return normalizeInstallSlice(out);
  }

  function readInstallSliceEffective() {
    initInstallationRunStore();
    var state = getInstallationRunState();
    return normalizeInstallSlice(state.install);
  }

  function applyInstallSlicePatch(partial) {
    initInstallationRunStore();
    var state = getInstallationRunState();
    var merged = mergeInstall(state.install, partial || {});
    patchInstallationRunState({ install: merged });
    return normalizeInstallSlice(getInstallationRunState().install);
  }

  /** Last N characters for debug; do not store full IMEI/ICCID. */
  function tailPublicDigits(value, keep) {
    if (value == null) return null;
    var s = String(value).replace(/\s/g, "");
    if (!s.length) return null;
    var k = typeof keep === "number" ? keep : 4;
    if (s.length <= k) return "***";
    return "***" + s.slice(-k);
  }

  /**
   * Redacted summary safe to persist (no tokens, no full PII, no full identifiers).
   */
  function summarizeInstallRequestForStore(payload) {
    if (!payload || typeof payload !== "object") return null;
    return {
      installationId: payload.installationId != null ? String(payload.installationId) : null,
      vin: payload.vin != null ? String(payload.vin) : null,
      client_name_char_length: payload.client_name ? String(payload.client_name).length : 0,
      imei_tail: tailPublicDigits(payload.imei, 4),
      has_sim_number: !!payload.sim_number,
      sim_number_tail: payload.sim_number ? tailPublicDigits(payload.sim_number, 4) : null,
      has_secondary_imei: !!payload.secondary_imei,
      secondary_imei_tail: payload.secondary_imei ? tailPublicDigits(payload.secondary_imei, 4) : null,
      has_secondary_sim_number: !!payload.secondary_sim_number,
      secondary_sim_number_tail: payload.secondary_sim_number
        ? tailPublicDigits(payload.secondary_sim_number, 4)
        : null,
      license_plate_present: !!payload.license_plate,
      has_vehiculo_submarca: !!payload.vehiculo_submarca,
    };
  }

  function recordInstallSubmitStarted(redactedRequestSummary) {
    applyInstallSlicePatch({
      phase: "submitting",
      lastSubmitAt: new Date().toISOString(),
      lastRequest: redactedRequestSummary,
      lastResponseSummary: null,
      serverRunCorrelationId: null,
    });
  }

  function pickCorrelationId(data) {
    if (!data || typeof data !== "object") return null;
    var id = data.correlationId || data.correlation_id || data.requestId || data.request_id || data.runId || data.run_id;
    return id != null && id !== "" ? String(id) : null;
  }

  function recordInstallSubmitSuccess(resp, data) {
    var body = data && typeof data === "object" ? data : {};
    var msg = body.message != null ? String(body.message).slice(0, 240) : null;
    applyInstallSlicePatch({
      phase: "succeeded",
      lastSubmitAt: new Date().toISOString(),
      lastResponseSummary: {
        ok: true,
        httpStatus: resp && typeof resp.status === "number" ? resp.status : null,
        pegasusStatus: body.status != null ? body.status : null,
        message: msg,
      },
      serverRunCorrelationId: pickCorrelationId(body),
    });
  }

  function recordInstallSubmitFailure(resp, err, data) {
    var body = data && typeof data === "object" ? data : {};
    var msg =
      err && err.message
        ? String(err.message).slice(0, 480)
        : body.message != null
          ? String(body.message).slice(0, 480)
          : "Unknown error";
    applyInstallSlicePatch({
      phase: "failed",
      lastSubmitAt: new Date().toISOString(),
      lastResponseSummary: {
        ok: false,
        httpStatus: resp && typeof resp.status === "number" ? resp.status : null,
        pegasusStatus: body.status != null ? body.status : null,
        message: msg,
      },
      serverRunCorrelationId: pickCorrelationId(body),
    });
  }

  window.normalizeInstallSlice = normalizeInstallSlice;
  window.readInstallSliceEffective = readInstallSliceEffective;
  window.applyInstallSlicePatch = applyInstallSlicePatch;
  window.summarizeInstallRequestForStore = summarizeInstallRequestForStore;
  window.recordInstallSubmitStarted = recordInstallSubmitStarted;
  window.recordInstallSubmitSuccess = recordInstallSubmitSuccess;
  window.recordInstallSubmitFailure = recordInstallSubmitFailure;
})();
