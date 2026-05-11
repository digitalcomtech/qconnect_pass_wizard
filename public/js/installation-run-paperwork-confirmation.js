/**
 * installationRun.paperwork + installationRun.confirmation — FleetMetriks form + final confirm (structured only).
 */
(function () {
  var CONF_PHASES = { not_started: true, submitting: true, succeeded: true, failed: true };

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

  function normalizePaperworkSlice(raw) {
    var p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return {
      formOpenedAt:
        typeof p.formOpenedAt === "string" && p.formOpenedAt.length > 0 ? p.formOpenedAt : null,
      formUrl: typeof p.formUrl === "string" && p.formUrl.length > 0 ? p.formUrl.slice(0, 4000) : null,
      operatorAcknowledgedAt:
        typeof p.operatorAcknowledgedAt === "string" && p.operatorAcknowledgedAt.length > 0
          ? p.operatorAcknowledgedAt
          : null,
    };
  }

  function normalizeConfirmationPhase(ph) {
    if (ph && CONF_PHASES[ph]) return ph;
    return "not_started";
  }

  function normalizeConfirmationSlice(raw) {
    var c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var lastAttempt = null;
    if (c.lastAttempt != null && typeof c.lastAttempt === "object" && !Array.isArray(c.lastAttempt)) {
      lastAttempt = {
        at: typeof c.lastAttempt.at === "string" ? c.lastAttempt.at : null,
        httpStatus:
          typeof c.lastAttempt.httpStatus === "number" && !isNaN(c.lastAttempt.httpStatus)
            ? c.lastAttempt.httpStatus
            : null,
      };
    }
    var summary = null;
    if (
      c.lastResponseSummary != null &&
      typeof c.lastResponseSummary === "object" &&
      !Array.isArray(c.lastResponseSummary)
    ) {
      summary = c.lastResponseSummary;
    }
    return {
      phase: normalizeConfirmationPhase(c.phase),
      lastAttempt: lastAttempt,
      lastResponseSummary: summary,
      dangerousFallbackUsed: !!c.dangerousFallbackUsed,
    };
  }

  function mergePaperwork(prevNorm, partial) {
    var out = normalizePaperworkSlice(prevNorm);
    if (!partial || typeof partial !== "object") return out;
    if (partial.formOpenedAt !== undefined) {
      out.formOpenedAt =
        partial.formOpenedAt == null || partial.formOpenedAt === ""
          ? null
          : String(partial.formOpenedAt);
    }
    if (partial.formUrl !== undefined) {
      out.formUrl =
        partial.formUrl == null || partial.formUrl === ""
          ? null
          : String(partial.formUrl).slice(0, 4000);
    }
    if (partial.operatorAcknowledgedAt !== undefined) {
      out.operatorAcknowledgedAt =
        partial.operatorAcknowledgedAt == null || partial.operatorAcknowledgedAt === ""
          ? null
          : String(partial.operatorAcknowledgedAt);
    }
    return normalizePaperworkSlice(out);
  }

  function mergeConfirmation(prevNorm, partial) {
    var out = normalizeConfirmationSlice(prevNorm);
    if (!partial || typeof partial !== "object") return out;
    if (partial.phase !== undefined) out.phase = normalizeConfirmationPhase(partial.phase);
    if (partial.lastAttempt !== undefined) {
      if (partial.lastAttempt == null) {
        out.lastAttempt = null;
      } else if (typeof partial.lastAttempt === "object" && !Array.isArray(partial.lastAttempt)) {
        var la = partial.lastAttempt;
        out.lastAttempt = {
          at: la.at != null ? String(la.at) : null,
          httpStatus:
            typeof la.httpStatus === "number" && !isNaN(la.httpStatus) ? la.httpStatus : null,
        };
      }
    }
    if (partial.lastResponseSummary !== undefined) {
      out.lastResponseSummary =
        partial.lastResponseSummary == null
          ? null
          : typeof partial.lastResponseSummary === "object" && !Array.isArray(partial.lastResponseSummary)
            ? partial.lastResponseSummary
            : null;
    }
    if (partial.dangerousFallbackUsed !== undefined) {
      out.dangerousFallbackUsed = !!partial.dangerousFallbackUsed;
    }
    return normalizeConfirmationSlice(out);
  }

  function applyPaperworkSlicePatch(partial) {
    initInstallationRunStore();
    var state = getInstallationRunState();
    var merged = mergePaperwork(state.paperwork, partial || {});
    patchInstallationRunState({ paperwork: merged });
    return normalizePaperworkSlice(getInstallationRunState().paperwork);
  }

  function applyConfirmationSlicePatch(partial) {
    initInstallationRunStore();
    var state = getInstallationRunState();
    var merged = mergeConfirmation(state.confirmation, partial || {});
    patchInstallationRunState({ confirmation: merged });
    return normalizeConfirmationSlice(getInstallationRunState().confirmation);
  }

  function recordPaperworkOpened(formUrl) {
    var now = new Date().toISOString();
    var url = formUrl == null ? null : String(formUrl).slice(0, 4000);
    applyPaperworkSlicePatch({
      formOpenedAt: now,
      formUrl: url,
    });
  }

  function recordPaperworkAcknowledged() {
    applyPaperworkSlicePatch({
      operatorAcknowledgedAt: new Date().toISOString(),
    });
  }

  function recordConfirmationStarted() {
    applyConfirmationSlicePatch({
      phase: "submitting",
      lastResponseSummary: null,
      dangerousFallbackUsed: false,
      lastAttempt: {
        at: new Date().toISOString(),
        httpStatus: null,
      },
    });
  }

  function isDangerousConfirmationResponse(data) {
    if (!data || typeof data !== "object") return false;
    if (data.dangerousUnconfirmedPegasusSuccess === true) return true;
    if (data.fallbackMode === true) return true;
    if (data.pegasusResponse && data.pegasusResponse.dangerous === true) return true;
    return false;
  }

  function recordConfirmationSuccess(resp, data) {
    var body = data && typeof data === "object" ? data : {};
    var dangerous = isDangerousConfirmationResponse(body);
    var msg = body.message != null ? String(body.message).slice(0, 500) : null;
    applyConfirmationSlicePatch({
      phase: "succeeded",
      lastAttempt: {
        at: new Date().toISOString(),
        httpStatus: resp && typeof resp.status === "number" ? resp.status : null,
      },
      lastResponseSummary: {
        ok: true,
        httpStatus: resp && typeof resp.status === "number" ? resp.status : null,
        success: body.success === true,
        message: msg,
        dangerousUnconfirmedPegasusSuccess: !!body.dangerousUnconfirmedPegasusSuccess,
        fallbackMode: !!body.fallbackMode,
      },
      dangerousFallbackUsed: dangerous,
    });
  }

  function recordConfirmationFailure(resp, err, data) {
    var body = data && typeof data === "object" ? data : {};
    var msg =
      err && err.message
        ? String(err.message).slice(0, 500)
        : body.message != null
          ? String(body.message).slice(0, 500)
          : "Unknown error";
    applyConfirmationSlicePatch({
      phase: "failed",
      lastAttempt: {
        at: new Date().toISOString(),
        httpStatus: resp && typeof resp.status === "number" ? resp.status : null,
      },
      lastResponseSummary: {
        ok: false,
        httpStatus: resp && typeof resp.status === "number" ? resp.status : null,
        success: body.success === true,
        message: msg,
        dangerousUnconfirmedPegasusSuccess: !!body.dangerousUnconfirmedPegasusSuccess,
      },
      dangerousFallbackUsed: false,
    });
  }

  window.normalizePaperworkSlice = normalizePaperworkSlice;
  window.normalizeConfirmationSlice = normalizeConfirmationSlice;
  window.applyPaperworkSlicePatch = applyPaperworkSlicePatch;
  window.applyConfirmationSlicePatch = applyConfirmationSlicePatch;
  window.recordPaperworkOpened = recordPaperworkOpened;
  window.recordPaperworkAcknowledged = recordPaperworkAcknowledged;
  window.recordConfirmationStarted = recordConfirmationStarted;
  window.recordConfirmationSuccess = recordConfirmationSuccess;
  window.recordConfirmationFailure = recordConfirmationFailure;
})();
