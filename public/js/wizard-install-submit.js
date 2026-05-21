// Wizard: POST /api/install (office provisioning console)
async function onStartInstallation() {
  installStatus.innerText = "";

  if (window.activityTracker) {
    const installationData = {
      imei: imeiInput.value.trim(),
      sim_number: simInput.value.trim() || null,
      secondary_imei: document.getElementById("secondaryImeiInput").value.trim() || null,
      secondary_sim_number: document.getElementById("secondarySimInput").value.trim() || null,
      vin: selectedVIN,
      client_name: selectedClientName,
      installationId: selectedInstallationId,
    };
    window.activityTracker.trackInstallationStart(installationData);
  }

  if (!imeiVerified) {
    installStatus.innerText = "🚨 IMEI must be found in Pegasus before provisioning.";
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

  if (sim) {
    if (sim !== simConfirm) {
      installStatus.innerText = "🚨 SIM values do not match.";
      return;
    }
    if (!simVerified) {
      installStatus.innerText = "🚨 SIM must be found in Pegasus before provisioning.";
      return;
    }
  }

  if (addSecondary && !secondaryImei) {
    installStatus.innerText = "🚨 Please enter the secondary IMEI.";
    return;
  }

  if (addSecondary && secondaryImei && !window.secondaryImeiVerified) {
    installStatus.innerText =
      "🚨 Secondary IMEI must be found in Pegasus before provisioning.";
    return;
  }

  if (addSecondary && secondarySim) {
    if (secondarySim !== secondarySimConfirm) {
      installStatus.innerText = "🚨 Secondary SIM values do not match.";
      return;
    }
    if (!secondarySimVerified) {
      installStatus.innerText = "🚨 Secondary SIM must be found in Pegasus before provisioning.";
      return;
    }
  }

  installStatus.innerText = "↻ Running provisioning in Pegasus…";

  var receiptPanel = document.getElementById("provisioningReceiptPanel");
  if (receiptPanel) {
    receiptPanel.classList.add("hidden");
    receiptPanel.innerHTML = "";
  }

  let resp = null;
  let data = null;
  let installPayload = null;
  try {
    let clientName = sessionStorage.getItem("selectedClientFullName") || selectedClientName;
    clientName = clientName.replace(/\s+NA\s*\/?\s*$/i, "").trim();

    const payload = {
      client_name: clientName,
      imei,
      vin: selectedVIN,
      installationId: selectedInstallationId,
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
    if (sim) {
      payload.sim_number = sim;
    }
    if (addSecondary && secondaryImei) {
      payload.secondary_imei = secondaryImei;
    }
    if (addSecondary && secondarySim) {
      payload.secondary_sim_number = secondarySim;
    }

    installPayload = payload;
    recordInstallSubmitStarted(summarizeInstallRequestForStore(payload));

    resp = await fetch("/api/install", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    try {
      data = await resp.json();
    } catch (parseJsonErr) {
      console.warn("Install response JSON parse failed:", parseJsonErr);
      data = null;
    }
    var installOk =
      resp.ok && data && (data.status === "success" || data.success === true);
    if (!installOk) {
      throw new Error((data && data.message) || `Status: ${data && data.status}` || `HTTP ${resp.status}`);
    }

    recordInstallSubmitSuccess(resp, data);
  } catch (err) {
    console.error(err);
    recordInstallSubmitFailure(resp, err, data);
    if (typeof showProvisioningFailureAfterInstall === "function") {
      showProvisioningFailureAfterInstall(err, resp, data, installPayload);
    } else {
      installStatus.innerText = "❌ " + err.message;
    }
    return;
  }

  showProvisioningSuccessAfterInstall(data, installPayload, resp);
}
