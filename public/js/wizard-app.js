// Wizard: wire DOM events after all wizard modules load
document.addEventListener("DOMContentLoaded", async () => {
  initInstallationRunStore();
  readJobSliceEffective();

  setupUserInfo();
  await loadAppConfig();

  clientForm.addEventListener("submit", onNextClient);
  vinSelect.addEventListener("change", applyVinSelection);
  startInstallBtn.addEventListener("click", onStartInstallation);
  var serverDryRunBtn = document.getElementById("serverDryRunBtn");
  if (serverDryRunBtn && typeof onServerDryRun === "function") {
    serverDryRunBtn.addEventListener("click", onServerDryRun);
  }
  initDeviceLookupListeners();

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

  var startOverBtn = document.getElementById("consoleStartOverBtn");
  if (startOverBtn) {
    startOverBtn.addEventListener("click", function () {
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

  navigateToStep(1);
  restoreState();
  if (vinSelect.value && typeof applyVinSelection === "function") {
    applyVinSelection();
  }
  if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
});
