// Wizard: mutable client/install verification state.
// Do not clear all of sessionStorage here — the wizard persists step/job data and
// installation-run-store uses key "installationRun". Clearing would break resume.

// State
let selectedClientName    = "";
let selectedVIN           = "";
let selectedInstallationId = "";
let imeiVerified          = false;
let simVerified           = false;
let secondarySimVerified  = false;
function clearLegacyWizardSessionKeys() {
  var keys = [
    "step",
    "clientName",
    "filteredInst",
    "selectedVIN",
    "installationId",
    "selectedClientFullName",
    "selectedInstallation",
  ];
  for (var i = 0; i < keys.length; i++) {
    sessionStorage.removeItem(keys[i]);
  }
}

function resetWizardGlobalsForNewRun() {
  selectedClientName = "";
  selectedVIN = "";
  selectedInstallationId = "";
  imeiVerified = false;
  simVerified = false;
  secondarySimVerified = false;
}

function resetWizardUiToColdStart() {
  if (typeof navigateToStep === "function") {
    navigateToStep(1);
  }

  var receiptPanel = document.getElementById("provisioningReceiptPanel");
  if (receiptPanel) {
    receiptPanel.classList.add("hidden");
    receiptPanel.innerHTML = "";
  }
  var previewPanel = document.getElementById("provisioningPreviewPanel");
  if (previewPanel) {
    previewPanel.classList.remove("provisioning-preview-done");
  }

  // Clear obvious wizard inputs/status text (safe even if elements are missing)
  try {
    if (typeof clientNameInput !== "undefined" && clientNameInput) clientNameInput.value = "";
    if (typeof vinSelect !== "undefined" && vinSelect) vinSelect.innerHTML = "";
    if (typeof imeiInput !== "undefined" && imeiInput) imeiInput.value = "";
    if (typeof simInput !== "undefined" && simInput) simInput.value = "";
    if (typeof installStatus !== "undefined" && installStatus) installStatus.textContent = "";
    if (typeof clientStatus !== "undefined" && clientStatus) clientStatus.textContent = "";
    if (typeof vinStatus !== "undefined" && vinStatus) vinStatus.textContent = "";
    if (typeof imeiVerificationStatus !== "undefined" && imeiVerificationStatus) imeiVerificationStatus.innerHTML = "";
    if (typeof simVerificationStatus !== "undefined" && simVerificationStatus) simVerificationStatus.innerHTML = "";
    var secondaryImeiStatus = document.getElementById("secondaryImeiVerificationStatus");
    if (secondaryImeiStatus) secondaryImeiStatus.innerHTML = "";
    var secondaryStatus = document.getElementById("secondarySimVerificationStatus");
    if (secondaryStatus) secondaryStatus.innerHTML = "";
    if (typeof startInstallBtn !== "undefined" && startInstallBtn) startInstallBtn.disabled = true;
  } catch (e) {
    // Best-effort UI cleanup only.
  }
}

function startNewWizardRunFromUserAction() {
  if (typeof resetInstallationRunSlicesForNewWizardRun === "function") {
    resetInstallationRunSlicesForNewWizardRun();
  }
  clearLegacyWizardSessionKeys();
  resetWizardGlobalsForNewRun();
  if (typeof resetLookupPreviewState === "function") resetLookupPreviewState();
  resetWizardUiToColdStart();
  window.scrollTo({ top: 0, behavior: "smooth" });
  var main = document.querySelector(".console-main");
  if (main && typeof main.focus === "function") {
    main.focus({ preventScroll: true });
  }
}

window.clearLegacyWizardSessionKeys = clearLegacyWizardSessionKeys;
window.startNewWizardRunFromUserAction = startNewWizardRunFromUserAction;
