// Wizard: wire DOM events after all wizard modules load
document.addEventListener("DOMContentLoaded", async () => {
  initInstallationRunStore();
  readJobSliceEffective();

  setupUserInfo();
  await loadAppConfig();

  clientForm.addEventListener("submit", onNextClient);
  nextVinBtn.addEventListener("click", onNextVin);
  startInstallBtn.addEventListener("click", onStartInstallation);
  initDeviceLookupListeners();

  document.getElementById("backToClientBtn").addEventListener("click", onBackToClient);
  document.getElementById("backToVinBtn").addEventListener("click", onBackToVin);

  document.getElementById("imeiConfirmInput").addEventListener("input", () => {
    applyDevicesDiscoveryPatch({
      primary: { imeiConfirm: document.getElementById("imeiConfirmInput").value.trim() },
    });
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
  });

  document.getElementById("simConfirmInput").addEventListener("input", () => {
    applyDevicesDiscoveryPatch({
      primary: { simIccidConfirm: document.getElementById("simConfirmInput").value.trim() },
    });
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
  });

  document.getElementById("secondarySimConfirmInput").addEventListener("input", () => {
    applyDevicesDiscoveryPatch({
      secondary: {
        simIccidConfirm: document.getElementById("secondarySimConfirmInput").value.trim(),
      },
    });
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
  });

  document.getElementById("addSecondaryUnit").addEventListener("change", function (e) {
    document.getElementById("secondaryUnitFields").classList.toggle("hidden", !e.target.checked);
    applyDevicesDiscoveryPatch({ secondary: { enabled: e.target.checked } });
    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
  });

  var startOverHeaderBtn = document.getElementById("startOverHeaderBtn");
  if (startOverHeaderBtn) {
    startOverHeaderBtn.addEventListener("click", function () {
      if (window.activityTracker) {
        window.activityTracker.trackStep("navigation", {
          action: "start_over",
          from: sessionStorage.getItem("step") || sessionStorage.getItem("currentStep") || "unknown",
          to: "1",
        });
      }
      startNewWizardRunFromUserAction();
    });
  }

  restoreState();
  if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
});
