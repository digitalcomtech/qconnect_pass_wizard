// Shared POST /api/install request body builder (provision + dry-run).

function buildInstallRequestPayload() {
  let clientName = sessionStorage.getItem("selectedClientFullName") || selectedClientName;
  clientName = (clientName || "").replace(/\s+NA\s*\/?\s*$/i, "").trim();

  const imei = imeiInput ? imeiInput.value.trim() : "";
  const sim = simInput ? simInput.value.trim() : "";
  const addSecondary =
    document.getElementById("addSecondaryUnit") &&
    document.getElementById("addSecondaryUnit").checked;
  const secondaryImei = document.getElementById("secondaryImeiInput")
    ? document.getElementById("secondaryImeiInput").value.trim()
    : "";
  const secondarySim = document.getElementById("secondarySimInput")
    ? document.getElementById("secondarySimInput").value.trim()
    : "";

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
      const licensePlate = selectedInstallation && selectedInstallation.vehiculo
        ? selectedInstallation.vehiculo.placas
        : null;
      if (licensePlate) payload.license_plate = licensePlate;
      const vehiculoSubmarca = selectedInstallation && selectedInstallation.vehiculo
        ? selectedInstallation.vehiculo.submarca
        : null;
      if (vehiculoSubmarca) payload.vehiculo_submarca = vehiculoSubmarca;
    } catch (parseError) {
      console.warn("Failed to parse selected installation:", parseError);
    }
  }

  if (sim) payload.sim_number = sim;
  if (addSecondary && secondaryImei) payload.secondary_imei = secondaryImei;
  if (addSecondary && secondarySim) payload.secondary_sim_number = secondarySim;

  return payload;
}

window.buildInstallRequestPayload = buildInstallRequestPayload;
