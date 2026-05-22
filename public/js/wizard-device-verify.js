// Wizard: debounced IMEI / SIM lookup (read-only; no Pegasus mutations)

const LOOKUP_DEBOUNCE_MS = 450;
const IMEI_MIN_LENGTH = 10;
const SIM_MIN_LENGTH = 10;

let imeiLookupTimer = null;
let secondaryImeiLookupTimer = null;
let simLookupTimer = null;
let secondarySimLookupTimer = null;
let imeiLookupSeq = 0;
let secondaryImeiLookupSeq = 0;
let simLookupSeq = 0;
let secondarySimLookupSeq = 0;

function lookupStatusHtml(kind, text) {
  const colors = {
    loading: "#f39c12",
    ok: "#27ae60",
    warn: "#f39c12",
    err: "#e74c3c",
    idle: "#64748b",
  };
  const c = colors[kind] || colors.idle;
  return `<span style="color:${c};">${text}</span>`;
}

async function fetchVerifyImei(imei) {
  const resp = await fetch("/api/verify-imei", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ imei }),
  });
  const data = await resp.json();
  return { resp, data };
}

async function fetchVerifySim(iccid) {
  const resp = await fetch("/api/verify-sim", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ iccid }),
  });
  const data = await resp.json();
  return { resp, data };
}

function getImeiLookupTarget(isSecondary) {
  if (isSecondary) {
    return {
      isSecondary: true,
      input: document.getElementById("secondaryImeiInput"),
      statusEl: document.getElementById("secondaryImeiVerificationStatus"),
      nextSeq: () => ++secondaryImeiLookupSeq,
      isCurrentSeq: (seq) => seq === secondaryImeiLookupSeq,
      schedule: (fn) => {
        clearTimeout(secondaryImeiLookupTimer);
        secondaryImeiLookupTimer = setTimeout(fn, LOOKUP_DEBOUNCE_MS);
      },
    };
  }
  return {
    isSecondary: false,
    input: imeiInput,
    statusEl: imeiVerificationStatus,
    nextSeq: () => ++imeiLookupSeq,
    isCurrentSeq: (seq) => seq === imeiLookupSeq,
    schedule: (fn) => {
      clearTimeout(imeiLookupTimer);
      imeiLookupTimer = setTimeout(fn, LOOKUP_DEBOUNCE_MS);
    },
  };
}

function getSimLookupTarget(isSecondary) {
  if (isSecondary) {
    return {
      isSecondary: true,
      input: document.getElementById("secondarySimInput"),
      statusEl: document.getElementById("secondarySimVerificationStatus"),
      nextSeq: () => ++secondarySimLookupSeq,
      isCurrentSeq: (seq) => seq === secondarySimLookupSeq,
      schedule: (fn) => {
        clearTimeout(secondarySimLookupTimer);
        secondarySimLookupTimer = setTimeout(fn, LOOKUP_DEBOUNCE_MS);
      },
    };
  }
  return {
    isSecondary: false,
    input: simInput,
    statusEl: simVerificationStatus,
    nextSeq: () => ++simLookupSeq,
    isCurrentSeq: (seq) => seq === simLookupSeq,
    schedule: (fn) => {
      clearTimeout(simLookupTimer);
      simLookupTimer = setTimeout(fn, LOOKUP_DEBOUNCE_MS);
    },
  };
}

function applyImeiVerifiedToStore(isSecondary, imei, verified) {
  const d = readDevicesSliceEffective();
  if (isSecondary) {
    applyDevicesDiscoveryPatch({
      secondary: {
        imei: imei,
        verified: { imei: verified, sim: d.secondary.verified.sim },
      },
    });
    return;
  }
  applyDevicesDiscoveryPatch({
    primary: {
      imei: imei,
      verified: { imei: verified, sim: d.primary.verified.sim },
    },
  });
  if (typeof refreshProvisioningPreview === "function") {
    refreshProvisioningPreview();
  } else if (typeof startInstallBtn !== "undefined" && startInstallBtn) {
    startInstallBtn.disabled = !verified;
  }
}

function runImeiLookupDebounced(isSecondary) {
  getImeiLookupTarget(isSecondary).schedule(() =>
    runImeiLookup(isSecondary)
  );
}

async function runImeiLookup(isSecondary) {
  const target = getImeiLookupTarget(isSecondary);
  const statusEl = target.statusEl;
  const input = target.input;
  if (!statusEl || !input) return;

  const imei = input.value.trim();
  const seq = target.nextSeq();
  const idleMsg = isSecondary
    ? "Enter secondary IMEI to search Pegasus."
    : "Enter IMEI to search Pegasus.";

  if (!imei) {
    statusEl.innerHTML = lookupStatusHtml("idle", idleMsg);
    setImeiLookupPreview(isSecondary, { phase: "idle", message: idleMsg });
    applyImeiVerifiedToStore(isSecondary, "", false);
    return;
  }

  if (imei.length < IMEI_MIN_LENGTH) {
    statusEl.innerHTML = lookupStatusHtml(
      "idle",
      `Type at least ${IMEI_MIN_LENGTH} digits…`
    );
    setImeiLookupPreview(isSecondary, { phase: "warn", message: "Too short" });
    applyImeiVerifiedToStore(isSecondary, imei, false);
    return;
  }

  if (!isSecondary && window.activityTracker) {
    const secondaryImei =
      document.getElementById("secondaryImeiInput").value.trim() || null;
    const secondarySim =
      document.getElementById("secondarySimInput").value.trim() || null;
    window.activityTracker.trackDeviceSetup(imei, null, secondaryImei, secondarySim);
  }

  const loadingMsg = isSecondary
    ? "⏳ Looking up secondary IMEI…"
    : "⏳ Looking up IMEI…";
  statusEl.innerHTML = lookupStatusHtml("loading", loadingMsg);
  setImeiLookupPreview(isSecondary, { phase: "loading" });
  applyImeiVerifiedToStore(isSecondary, imei, false);

  try {
    const { resp, data } = await fetchVerifyImei(imei);
    if (!target.isCurrentSeq(seq)) return;

    if (resp.ok && data.success) {
      applyImeiVerifiedToStore(isSecondary, imei, true);
      setImeiLookupPreview(isSecondary, {
        phase: "ok",
        deviceState: data.deviceState,
        message: data.message,
      });
      const linked =
        data.deviceState === "linked"
          ? ""
          : ` Device state: ${data.deviceState}.`;
      const okPrefix = isSecondary ? "✅ Secondary IMEI found in Pegasus." : "✅ IMEI found in Pegasus.";
      statusEl.innerHTML = lookupStatusHtml("ok", `${okPrefix}${linked}`);
      if (!isSecondary && typeof updateWorkflowStatus === "function") {
        updateWorkflowStatus({
          primaryImei: imei,
          status: `Primary IMEI verified: ${data.deviceState}`,
        });
      }
    } else {
      applyImeiVerifiedToStore(isSecondary, imei, false);
      const linked = data && data.deviceState === "linked";
      setImeiLookupPreview(isSecondary, {
        phase: linked ? "linked" : "error",
        message: data && data.message,
        deviceState: data && data.deviceState,
        vehicleName: data && data.vehicleName,
        vehicleId: data && data.vehicleId,
      });
      const imeiErrMsg =
        typeof formatPegasusApiError === "function"
          ? formatPegasusApiError(resp, data, "imei")
          : data.message || "IMEI not available for provisioning";
      statusEl.innerHTML = lookupStatusHtml("err", `❌ ${imeiErrMsg}`);
    }
  } catch (err) {
    if (!target.isCurrentSeq(seq)) return;
    console.error(isSecondary ? "Secondary IMEI lookup error:" : "IMEI lookup error:", err);
    applyImeiVerifiedToStore(isSecondary, imei, false);
    setImeiLookupPreview(isSecondary, { phase: "error", message: "Lookup service error" });
    statusEl.innerHTML = lookupStatusHtml(
      "err",
      "❌ Error connecting to lookup service"
    );
  }
}

function runSimLookupDebounced(isSecondary) {
  getSimLookupTarget(isSecondary).schedule(() => runSimLookup(isSecondary));
}

async function runSimLookup(isSecondary) {
  const target = getSimLookupTarget(isSecondary);
  const statusEl = target.statusEl;
  const input = target.input;
  if (!statusEl || !input) return;

  const iccid = input.value.trim();
  const seq = target.nextSeq();
  const idleMsg = isSecondary
    ? "Optional — leave blank or enter secondary ICCID to search."
    : "Optional — leave blank or enter ICCID to search.";

  if (!iccid) {
    statusEl.innerHTML = lookupStatusHtml("idle", idleMsg);
    setSimLookupPreview(isSecondary, { phase: "idle" });
    const d = readDevicesSliceEffective();
    if (isSecondary) {
      applyDevicesDiscoveryPatch({
        secondary: { verified: { imei: d.secondary.verified.imei, sim: false } },
      });
    } else {
      applyDevicesDiscoveryPatch({
        primary: { verified: { imei: d.primary.verified.imei, sim: false } },
      });
    }
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
    return;
  }

  if (iccid.length < SIM_MIN_LENGTH) {
    statusEl.innerHTML = lookupStatusHtml(
      "idle",
      `Type at least ${SIM_MIN_LENGTH} characters…`
    );
    setSimLookupPreview(isSecondary, { phase: "warn", message: "Too short" });
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
    return;
  }

  if (!iccid.startsWith("8988") && !iccid.startsWith("8901")) {
    statusEl.innerHTML = lookupStatusHtml(
      "warn",
      "ICCID must start with 8988 (SuperSIM) or 8901 (Wireless)."
    );
    setSimLookupPreview(isSecondary, {
      phase: "warn",
      message: "Invalid prefix (use 8988 or 8901)",
    });
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
    return;
  }

  statusEl.innerHTML = lookupStatusHtml(
    "loading",
    "⏳ Looking up SIM (Pegasus256 → Pegasus1)…"
  );
  setSimLookupPreview(isSecondary, { phase: "loading" });

  try {
    const { resp, data } = await fetchVerifySim(iccid);
    if (!target.isCurrentSeq(seq)) return;

    const d = readDevicesSliceEffective();

    if (resp.ok && data.success && data.simData) {
      applyDevicesDiscoveryPatch(
        isSecondary
          ? {
              secondary: {
                simIccid: iccid,
                verified: { imei: d.secondary.verified.imei, sim: true },
              },
            }
          : {
              primary: {
                simIccid: iccid,
                verified: { imei: d.primary.verified.imei, sim: true },
              },
            }
      );
      setSimLookupPreview(isSecondary, {
        phase: "ok",
        simType: data.simData.simType,
        foundIn: data.simData.foundIn,
        status: data.simData.status,
        message: data.message,
      });
      statusEl.innerHTML = lookupStatusHtml(
        "ok",
        `✅ ${data.simData.simType}${isSecondary ? " (secondary)" : ""} found in ${data.simData.foundIn} · status: ${data.simData.status}`
      );
    } else {
      applyDevicesDiscoveryPatch(
        isSecondary
          ? {
              secondary: {
                verified: { imei: d.secondary.verified.imei, sim: false },
              },
            }
          : {
              primary: {
                verified: { imei: d.primary.verified.imei, sim: false },
              },
            }
      );
      setSimLookupPreview(isSecondary, {
        phase: "error",
        message: data && data.message,
        checkedInstances: data && data.checkedInstances,
      });
      const checked =
        data.checkedInstances && data.checkedInstances.length
          ? ` Checked: ${data.checkedInstances.join(", ")}.`
          : "";
      const simErrMsg =
        typeof formatPegasusApiError === "function"
          ? formatPegasusApiError(resp, data, "sim")
          : data.message || "SIM not found";
      statusEl.innerHTML = lookupStatusHtml("err", `❌ ${simErrMsg}${checked}`);
    }
  } catch (err) {
    if (!target.isCurrentSeq(seq)) return;
    console.error("SIM lookup error:", err);
    setSimLookupPreview(isSecondary, { phase: "error", message: "Lookup service error" });
    statusEl.innerHTML = lookupStatusHtml("err", "❌ Error connecting to lookup service");
  }
  if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
}

function initDeviceLookupListeners() {
  imeiInput.addEventListener("input", () => {
    applyDevicesDiscoveryPatch({ primary: { imei: imeiInput.value.trim() } });
    invalidatePrimaryImeiVerificationInStore();
    runImeiLookupDebounced(false);
  });

  simInput.addEventListener("input", () => {
    applyDevicesDiscoveryPatch({ primary: { simIccid: simInput.value.trim() } });
    var d = readDevicesSliceEffective();
    if (d.primary.verified.sim) {
      invalidatePrimarySimVerificationInStore();
    }
    runSimLookupDebounced(false);
  });

  const secondaryImeiInput = document.getElementById("secondaryImeiInput");
  if (secondaryImeiInput) {
    secondaryImeiInput.addEventListener("input", () => {
      applyDevicesDiscoveryPatch({
        secondary: { imei: secondaryImeiInput.value.trim() },
      });
      invalidateSecondaryImeiVerificationInStore();
      runImeiLookupDebounced(true);
    });
  }

  const secondarySimInput = document.getElementById("secondarySimInput");
  if (secondarySimInput) {
    secondarySimInput.addEventListener("input", () => {
      applyDevicesDiscoveryPatch({
        secondary: { simIccid: secondarySimInput.value.trim() },
      });
      var dSec = readDevicesSliceEffective();
      if (dSec.secondary.verified.sim) {
        invalidateSecondarySimVerificationInStore();
      }
      runSimLookupDebounced(true);
    });
  }

  const addSecondaryUnit = document.getElementById("addSecondaryUnit");
  if (addSecondaryUnit) {
    addSecondaryUnit.addEventListener("change", () => {
      if (addSecondaryUnit.checked && secondaryImeiInput && secondaryImeiInput.value.trim()) {
        runImeiLookupDebounced(true);
      }
      if (addSecondaryUnit.checked && secondarySimInput && secondarySimInput.value.trim()) {
        runSimLookupDebounced(true);
      }
      if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
    });
  }
}

async function onVerifyImei() {
  return runImeiLookup(false);
}
async function onVerifySim() {
  return runSimLookup(false);
}
async function onVerifySecondaryImei() {
  return runImeiLookup(true);
}
async function onVerifySecondarySim() {
  return runSimLookup(true);
}
