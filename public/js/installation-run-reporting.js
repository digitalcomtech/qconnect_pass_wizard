/**
 * installationRun.reporting — primary device-status polling + proximity + bypass (structured only).
 * Structured reporting slice for installationRun (office console skips yard polling UI).
 */
(function () {
  var TOP_PHASES = { idle: true, polling: true, proximity: true, bypassed: true, failed: true };

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

  function normalizeTopPhase(p) {
    if (p && TOP_PHASES[p]) return p;
    return "idle";
  }

  function normalizeReportingSlice(raw) {
    var r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var out = defaultReportingSlice();
    out.phase = normalizeTopPhase(r.phase);
    var pol = r.polling && typeof r.polling === "object" && !Array.isArray(r.polling) ? r.polling : {};
    out.polling.startedAt =
      typeof pol.startedAt === "string" && pol.startedAt.length > 0 ? pol.startedAt : null;
    out.polling.attemptCount =
      typeof pol.attemptCount === "number" && pol.attemptCount >= 0 ? Math.floor(pol.attemptCount) : 0;
    out.polling.lastDeviceStatusAt =
      typeof pol.lastDeviceStatusAt === "string" && pol.lastDeviceStatusAt.length > 0
        ? pol.lastDeviceStatusAt
        : null;
    out.polling.lastSnapshot =
      pol.lastSnapshot != null && typeof pol.lastSnapshot === "object" && !Array.isArray(pol.lastSnapshot)
        ? pol.lastSnapshot
        : null;
    var prox = r.proximity && typeof r.proximity === "object" && !Array.isArray(r.proximity) ? r.proximity : {};
    out.proximity.method =
      prox.method == null || prox.method === "" ? null : String(prox.method);
    out.proximity.lastDistanceMeters =
      typeof prox.lastDistanceMeters === "number" && !isNaN(prox.lastDistanceMeters)
        ? prox.lastDistanceMeters
        : prox.lastDistanceMeters == null
          ? null
          : Number(prox.lastDistanceMeters);
    if (out.proximity.lastDistanceMeters != null && isNaN(out.proximity.lastDistanceMeters)) {
      out.proximity.lastDistanceMeters = null;
    }
    var byp = r.bypass && typeof r.bypass === "object" && !Array.isArray(r.bypass) ? r.bypass : {};
    out.bypass.offeredAt =
      typeof byp.offeredAt === "string" && byp.offeredAt.length > 0 ? byp.offeredAt : null;
    out.bypass.chosen = !!byp.chosen;
    return out;
  }

  function mergeReporting(prevNorm, partial) {
    var out = normalizeReportingSlice(prevNorm);
    if (!partial || typeof partial !== "object") return out;
    if (partial.phase !== undefined) out.phase = normalizeTopPhase(partial.phase);
    if (partial.polling && typeof partial.polling === "object") {
      var p = partial.polling;
      out.polling = Object.assign({}, out.polling);
      if (p.startedAt !== undefined) out.polling.startedAt = p.startedAt == null || p.startedAt === "" ? null : String(p.startedAt);
      if (p.attemptCount !== undefined) {
        out.polling.attemptCount =
          typeof p.attemptCount === "number" && p.attemptCount >= 0 ? Math.floor(p.attemptCount) : 0;
      }
      if (p.lastDeviceStatusAt !== undefined) {
        out.polling.lastDeviceStatusAt =
          p.lastDeviceStatusAt == null || p.lastDeviceStatusAt === "" ? null : String(p.lastDeviceStatusAt);
      }
      if (p.lastSnapshot !== undefined) {
        out.polling.lastSnapshot =
          p.lastSnapshot == null
            ? null
            : typeof p.lastSnapshot === "object" && !Array.isArray(p.lastSnapshot)
              ? p.lastSnapshot
              : null;
      }
    }
    if (partial.proximity && typeof partial.proximity === "object") {
      var x = partial.proximity;
      out.proximity = Object.assign({}, out.proximity);
      if (x.method !== undefined) out.proximity.method = x.method == null || x.method === "" ? null : String(x.method);
      if (x.lastDistanceMeters !== undefined) {
        if (x.lastDistanceMeters == null || x.lastDistanceMeters === "") {
          out.proximity.lastDistanceMeters = null;
        } else {
          var d = Number(x.lastDistanceMeters);
          out.proximity.lastDistanceMeters = isNaN(d) ? null : d;
        }
      }
    }
    if (partial.bypass && typeof partial.bypass === "object") {
      var b = partial.bypass;
      out.bypass = Object.assign({}, out.bypass);
      if (b.offeredAt !== undefined) {
        out.bypass.offeredAt = b.offeredAt == null || b.offeredAt === "" ? null : String(b.offeredAt);
      }
      if (b.chosen !== undefined) out.bypass.chosen = !!b.chosen;
    }
    return normalizeReportingSlice(out);
  }

  function readReportingSliceEffective() {
    initInstallationRunStore();
    return normalizeReportingSlice(getInstallationRunState().reporting);
  }

  function applyReportingSlicePatch(partial) {
    initInstallationRunStore();
    var state = getInstallationRunState();
    var merged = mergeReporting(state.reporting, partial || {});
    patchInstallationRunState({ reporting: merged });
    return normalizeReportingSlice(getInstallationRunState().reporting);
  }

  /** Bounded summary of /api/device-status JSON (no raw Pegasus blobs). */
  function summarizeDeviceStatusForStore(data, resp) {
    var httpStatus = resp && typeof resp.status === "number" ? resp.status : null;
    if (!data || typeof data !== "object") {
      return { ok: false, httpStatus: httpStatus, parseOrEmpty: true };
    }
    var loc = data.latest && data.latest.loc ? data.latest.loc : null;
    var lat = loc && loc.lat != null ? Math.round(Number(loc.lat) * 1e4) / 1e4 : null;
    var lon = loc && loc.lon != null ? Math.round(Number(loc.lon) * 1e4) / 1e4 : null;
    var locationAge = loc && (loc.age != null ? loc.age : null);
    return {
      ok: true,
      httpStatus: httpStatus,
      isReporting: !!data.isReporting,
      isOnline: data.isOnline === true,
      hasRecentConnection: !!data.hasRecentConnection,
      hasRecentActivity: !!data.hasRecentActivity,
      hasRecentLocation: !!(loc && lat != null && lon != null && (locationAge || 0) <= 60),
      locationAgeSec: locationAge != null ? Number(locationAge) : null,
      latRounded: lat,
      lonRounded: lon,
      dataFreshness: data.dataFreshness != null ? data.dataFreshness : null,
    };
  }

  function recordPollingStarted(startTimeMs) {
    var t = typeof startTimeMs === "number" ? startTimeMs : Date.now();
    applyReportingSlicePatch({
      phase: "polling",
      proximity: { method: null, lastDistanceMeters: null },
      bypass: { offeredAt: null, chosen: false },
      polling: {
        startedAt: new Date(t).toISOString(),
        attemptCount: 0,
        lastDeviceStatusAt: null,
        lastSnapshot: null,
      },
    });
  }

  function recordPollingSnapshot(attemptCount, data, resp) {
    var snap = summarizeDeviceStatusForStore(data, resp);
    applyReportingSlicePatch({
      phase: "polling",
      polling: {
        attemptCount: attemptCount,
        lastDeviceStatusAt: new Date().toISOString(),
        lastSnapshot: snap,
      },
    });
  }

  /** Non-fatal device-status or network error while polling continues (phase stays polling). */
  function recordPollingFailure(message) {
    applyReportingSlicePatch({
      phase: "polling",
      polling: {
        lastDeviceStatusAt: new Date().toISOString(),
        lastSnapshot: {
          ok: false,
          transientFailure: true,
          message: String(message || "").slice(0, 240),
        },
      },
    });
  }

  function recordReportingPhase(phase) {
    applyReportingSlicePatch({ phase: phase });
  }

  function recordProximityResult(method, distanceMeters) {
    var dist =
      distanceMeters == null || distanceMeters === ""
        ? null
        : Math.round(Number(distanceMeters) * 100) / 100;
    if (dist != null && isNaN(dist)) dist = null;
    applyReportingSlicePatch({
      phase: "proximity",
      proximity: {
        method: method == null ? null : String(method),
        lastDistanceMeters: dist,
      },
    });
  }

  function recordBypassOffered() {
    applyReportingSlicePatch({
      bypass: {
        offeredAt: new Date().toISOString(),
      },
    });
  }

  function recordBypassChosen() {
    applyReportingSlicePatch({
      phase: "bypassed",
      bypass: {
        chosen: true,
      },
    });
  }

  window.normalizeReportingSlice = normalizeReportingSlice;
  window.readReportingSliceEffective = readReportingSliceEffective;
  window.applyReportingSlicePatch = applyReportingSlicePatch;
  window.summarizeDeviceStatusForStore = summarizeDeviceStatusForStore;
  window.recordPollingStarted = recordPollingStarted;
  window.recordPollingSnapshot = recordPollingSnapshot;
  window.recordPollingFailure = recordPollingFailure;
  window.recordReportingPhase = recordReportingPhase;
  window.recordProximityResult = recordProximityResult;
  window.recordBypassOffered = recordBypassOffered;
  window.recordBypassChosen = recordBypassChosen;
})();
