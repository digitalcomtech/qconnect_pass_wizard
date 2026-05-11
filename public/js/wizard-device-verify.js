// Wizard: IMEI / SIM verification against API
async function onVerifyImei() {
  const imei = imeiInput.value.trim();
  if (!imei) {
    imeiVerificationStatus.innerHTML = '<span style="color:#e74c3c;">🚨 Please enter an IMEI to verify.</span>';
    return;
  }
  
  // Track device setup step
  if (window.activityTracker) {
    const secondaryImei = document.getElementById("secondaryImeiInput").value.trim() || null;
    const secondarySim = document.getElementById("secondarySimInput").value.trim() || null;
    window.activityTracker.trackDeviceSetup(imei, null, secondaryImei, secondarySim);
  }

  imeiVerificationStatus.innerHTML = '<span style="color:#f39c12;">⏳ Verifying IMEI...</span>';
  verifyImeiBtn.disabled = true;

  try {
    const resp = await fetch("/api/verify-imei", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ imei })
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      var dImei = readDevicesSliceEffective();
      applyDevicesDiscoveryPatch({
        primary: {
          imei: imei,
          verified: { imei: true, sim: dImei.primary.verified.sim },
        },
      });
      startInstallBtn.disabled = false;
      imeiVerificationStatus.innerHTML = `<span style="color:#27ae60;">✅ IMEI verified successfully! Device state: ${data.deviceState}</span>`;
      
      // Update workflow status
      updateWorkflowStatus({
        primaryImei: imei,
        status: `Primary IMEI verified: ${data.deviceState}`
      });
    } else {
      var dImeiFail = readDevicesSliceEffective();
      applyDevicesDiscoveryPatch({
        primary: { verified: { imei: false, sim: dImeiFail.primary.verified.sim } },
      });
      startInstallBtn.disabled = true;
      imeiVerificationStatus.innerHTML = `<span style="color:#e74c3c;">❌ ${data.message}</span>`;
    }
  } catch (err) {
    console.error("Error verifying IMEI:", err);
    var dImeiErr = readDevicesSliceEffective();
    applyDevicesDiscoveryPatch({
      primary: { verified: { imei: false, sim: dImeiErr.primary.verified.sim } },
    });
    startInstallBtn.disabled = true;
    imeiVerificationStatus.innerHTML = '<span style="color:#e74c3c;">❌ Error connecting to verification service</span>';
  } finally {
    verifyImeiBtn.disabled = false;
  }
}

// SIM Verification
async function onVerifySim() {
  const iccid = simInput.value.trim();
  if (!iccid) {
    simVerificationStatus.innerHTML = '<span style="color:#e74c3c;">🚨 Please enter an ICCID to verify.</span>';
    return;
  }

  simVerificationStatus.innerHTML = '<span style="color:#f39c12;">⏳ Verifying SIM...</span>';
  verifySimBtn.disabled = true;

  try {
    const resp = await fetch("/api/verify-sim", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ iccid })
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      var dSim = readDevicesSliceEffective();
      applyDevicesDiscoveryPatch({
        primary: {
          simIccid: iccid,
          verified: { imei: dSim.primary.verified.imei, sim: true },
        },
      });
      simVerificationStatus.innerHTML = `<span style="color:#27ae60;">✅ ${data.simData.simType} SIM verified successfully! Found in ${data.simData.foundIn} | Status: ${data.simData.status}</span>`;
    } else {
      var dSimFail = readDevicesSliceEffective();
      applyDevicesDiscoveryPatch({
        primary: { verified: { imei: dSimFail.primary.verified.imei, sim: false } },
      });
      simVerificationStatus.innerHTML = `<span style="color:#e74c3c;">❌ ${data.message}</span>`;
    }
  } catch (err) {
    console.error("Error verifying SIM:", err);
    var dSimErr = readDevicesSliceEffective();
    applyDevicesDiscoveryPatch({
      primary: { verified: { imei: dSimErr.primary.verified.imei, sim: false } },
    });
    simVerificationStatus.innerHTML = '<span style="color:#e74c3c;">❌ Error connecting to verification service</span>';
  } finally {
    verifySimBtn.disabled = false;
  }
}

async function onVerifySecondarySim() {
  const iccid = document.getElementById("secondarySimInput").value.trim();
  if (!iccid) {
    document.getElementById("secondarySimVerificationStatus").innerHTML = '<span style="color:#e74c3c;">🚨 Please enter an ICCID to verify.</span>';
    return;
  }

  document.getElementById("secondarySimVerificationStatus").innerHTML = '<span style="color:#f39c12;">⏳ Verifying Secondary SIM...</span>';
  document.getElementById("verifySecondarySimBtn").disabled = true;

  try {
    const resp = await fetch("/api/verify-sim", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ iccid })
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      var dSec = readDevicesSliceEffective();
      applyDevicesDiscoveryPatch({
        secondary: {
          simIccid: iccid,
          verified: { imei: dSec.secondary.verified.imei, sim: true },
        },
      });
      document.getElementById("secondarySimVerificationStatus").innerHTML = `<span style="color:#27ae60;">✅ ${data.simData.simType} Secondary SIM verified successfully! Found in ${data.simData.foundIn} | Status: ${data.simData.status}</span>`;
    } else {
      var dSecFail = readDevicesSliceEffective();
      applyDevicesDiscoveryPatch({
        secondary: { verified: { imei: dSecFail.secondary.verified.imei, sim: false } },
      });
      document.getElementById("secondarySimVerificationStatus").innerHTML = `<span style="color:#e74c3c;">❌ ${data.message}</span>`;
    }
  } catch (err) {
    console.error("Error verifying secondary SIM:", err);
    var dSecErr = readDevicesSliceEffective();
    applyDevicesDiscoveryPatch({
      secondary: { verified: { imei: dSecErr.secondary.verified.imei, sim: false } },
    });
    document.getElementById("secondarySimVerificationStatus").innerHTML = '<span style="color:#e74c3c;">❌ Error connecting to verification service</span>';
  } finally {
    document.getElementById("verifySecondarySimBtn").disabled = false;
  }
}

