// Wizard: POST /api/install + start primary device polling
async function onStartInstallation() {
  installStatus.innerText = "";
  
  // Track installation start
  if (window.activityTracker) {
    const installationData = {
      imei: imeiInput.value.trim(),
      sim_number: simInput.value.trim() || null,
      secondary_imei: secondaryImeiInput.value.trim() || null,
      secondary_sim_number: document.getElementById("secondarySimInput").value.trim() || null,
      vin: selectedVIN,
      client_name: selectedClientName,
      installationId: selectedInstallationId
    };
    window.activityTracker.trackInstallationStart(installationData);
  }
  
  // Reset form opened flag for new installation
  formAlreadyOpened = false;
  
  // Check if IMEI has been verified
  if (!imeiVerified) {
    installStatus.innerText = "🚨 Please verify the IMEI before proceeding with installation.";
    return;
  }
  
  const imei = imeiInput.value.trim();
  const imeiConfirm = document.getElementById("imeiConfirmInput").value.trim();
  const sim = simInput.value.trim();
  const simConfirm = document.getElementById("simConfirmInput").value.trim();
  const secondaryImei = document.getElementById("secondaryImeiInput").value.trim();
  const secondarySim = document.getElementById("secondarySimInput").value.trim();
  const secondarySimConfirm = document.getElementById("secondarySimConfirmInput").value.trim();
  const addSecondary = document.getElementById("addSecondaryUnit").checked;
  
  if (!imei) {
    installStatus.innerText = "🚨 Please enter IMEI.";
    return;
  }
  if (imei !== imeiConfirm) {
    installStatus.innerText = "🚨 IMEI values do not match.";
    return;
  }
  
  // Validate SIM if provided
  if (sim) {
    if (sim !== simConfirm) {
      installStatus.innerText = "🚨 SIM values do not match.";
      return;
    }
    if (!simVerified) {
      installStatus.innerText = "🚨 Please verify the SIM card before proceeding with installation.";
      return;
    }
  }
  
  if (addSecondary && !secondaryImei) {
    installStatus.innerText = "🚨 Please enter the secondary IMEI.";
    return;
  }
  
  // Validate secondary SIM if provided
  if (addSecondary && secondarySim) {
    if (secondarySim !== secondarySimConfirm) {
      installStatus.innerText = "🚨 Secondary SIM values do not match.";
      return;
    }
    if (!secondarySimVerified) {
      installStatus.innerText = "🚨 Please verify the secondary SIM card before proceeding with installation.";
      return;
    }
  }
  installStatus.innerText = "↻ Sending IMEI & SIM to server…";

  let resp = null;
  let data = null;
  try {
    // Clean client name to remove unwanted "NA" suffixes (handles " NA", " NA/", " NA /", etc.)
    let clientName = sessionStorage.getItem("selectedClientFullName") || selectedClientName;
    clientName = clientName.replace(/\s+NA\s*\/?\s*$/i, "").trim();
    
    const payload = {
      client_name: clientName,
      imei,
      vin: selectedVIN,
      installationId: selectedInstallationId
    };
    const selectedInstallationRaw = sessionStorage.getItem("selectedInstallation");
    if (selectedInstallationRaw) {
      try {
        const selectedInstallation = JSON.parse(selectedInstallationRaw);
        const licensePlate = selectedInstallation?.vehiculo?.placas;
        if (licensePlate) {
          payload.license_plate = licensePlate;
        }
        const vehiculoSubmarca = selectedInstallation?.vehiculo?.submarca;
        if (vehiculoSubmarca) {
          payload.vehiculo_submarca = vehiculoSubmarca;
        }
      } catch (parseError) {
        console.warn("Failed to parse selected installation for license plate:", parseError);
      }
    }
    // Only include SIM if provided
    if (sim) {
      payload.sim_number = sim;
    }
    if (addSecondary && secondaryImei) {
      payload.secondary_imei = secondaryImei;
    }
    if (addSecondary && secondarySim) {
      payload.secondary_sim_number = secondarySim;
    }

    recordInstallSubmitStarted(summarizeInstallRequestForStore(payload));

    resp = await fetch("/api/install", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    try {
      data = await resp.json();
    } catch (parseJsonErr) {
      console.warn("Install response JSON parse failed:", parseJsonErr);
      data = null;
    }
    if (!resp.ok || !data || data.status !== "success") {
      throw new Error((data && data.message) || `Status: ${data && data.status}` || `HTTP ${resp.status}`);
    }

    recordInstallSubmitSuccess(resp, data);
  } catch (err) {
    console.error(err);
    recordInstallSubmitFailure(resp, err, data);
    installStatus.innerText = "❌ " + err.message;
    return;
  }

  try {
    sessionStorage.setItem("step", "waitingForDevice");
    
    // Update workflow status for device monitoring
    updateWorkflowStatus({
      currentStep: '4',
      status: 'Monitoring device location...'
    });
    
    const testModeNote = document.getElementById("enableTestMode").checked ? 
      '<div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-top: 12px; color: #92400e;">🧪 <strong>Test Mode Active:</strong> Will use custom coordinates instead of GPS</div>' : '';
    
    installStatus.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 1.2rem; color: #6B21A8; margin-bottom: 12px; font-weight: 700;">
          ⏳ Starting device location monitoring...
        </div>
        <div style="font-size: 0.95rem; color: #475569; margin-bottom: 12px; line-height: 1.5;">
          <strong>Initial interval:</strong> 10 seconds | <strong>Maximum duration:</strong> 30 minutes
        </div>
        <div class="info-box" style="margin-bottom: 12px;">
          💡 <strong>Smart polling:</strong> We'll check less frequently over time to avoid overwhelming the system.
        </div>
        ${testModeNote}
      </div>
      <button id="stopPollingBtn" type="button" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); margin-top: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">🛑 Stop Waiting</button>
    `;

    // Initialize polling control
    window.stopPolling = false;

    // Add stop polling functionality
    document.getElementById("stopPollingBtn").addEventListener("click", () => {
      window.stopPolling = true;
      installStatus.innerHTML = "🛑 Stopped waiting for device. You can restart the installation process.";
    });

    // Update sidebar: Step 3 completed, unlock Step 4
    updateStepStatus(3, 'completed');
    unlockNextStep(3);
    
    // Start polling for device status
    pollForDeviceReporting();
  } catch (err2) {
    console.error(err2);
    installStatus.innerText = "❌ " + (err2 && err2.message ? err2.message : "Installation started but follow-up failed.");
  }
}
