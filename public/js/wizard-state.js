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
let formAlreadyOpened     = false; // Prevent form from opening multiple times

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
  formAlreadyOpened = false;
}

function resetWizardUiToColdStart() {
  // Sections + sidebar
  if (typeof updateStepStatus === "function") {
    for (var step = 1; step <= 6; step++) {
      updateStepStatus(step, "pending");
      if (step >= 2) updateStepStatus(step, "locked");
    }
  }
  if (typeof navigateToStep === "function") {
    navigateToStep(1);
  }

  // Visible success/completion area
  if (typeof successMsg !== "undefined" && successMsg) {
    successMsg.style.display = "none";
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
  resetWizardUiToColdStart();
}

window.clearLegacyWizardSessionKeys = clearLegacyWizardSessionKeys;
window.startNewWizardRunFromUserAction = startNewWizardRunFromUserAction;
