// Single-page console: all sections stay visible (no step wizard navigation).

function navigateToStep(stepNumber) {
  document.querySelectorAll(".section").forEach(function (section) {
    section.classList.remove("hidden");
  });
  if (stepNumber != null) {
    sessionStorage.setItem("currentStep", String(stepNumber));
  }
}

function updateStepStatus() {
  /* no-op: sidebar step UI removed */
}

function unlockNextStep() {
  /* no-op */
}

window.navigateToStep = navigateToStep;
