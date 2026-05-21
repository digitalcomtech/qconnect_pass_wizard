// Wizard: section navigation (3-step provisioning console)

function navigateToStep(stepNumber) {
  if (stepNumber > provisioningMaxStep()) {
    return;
  }

  document.querySelectorAll(".section").forEach(function (section) {
    section.classList.add("hidden");
  });

  var targetSection;
  switch (stepNumber) {
    case 1:
      targetSection = document.getElementById("clientSection");
      break;
    case 2:
      targetSection = document.getElementById("vinSection");
      break;
    case 3:
      targetSection = document.getElementById("deviceSection");
      break;
    default:
      targetSection = document.getElementById("clientSection");
  }

  if (targetSection) {
    targetSection.classList.remove("hidden");
    sessionStorage.setItem("currentStep", stepNumber.toString());
  }
}

function updateStepStatus(stepNumber, status) {
  var stepNav = document.getElementById("stepNav" + stepNumber);
  var stepStatus = document.getElementById("stepStatus" + stepNumber);
  if (!stepNav || !stepStatus) return;

  stepNav.classList.remove("locked", "completed");
  stepStatus.classList.remove("completed");

  switch (status) {
    case "completed":
      stepNav.classList.add("completed");
      stepStatus.classList.add("completed");
      break;
    case "active":
      stepNav.classList.add("active");
      break;
    case "locked":
      stepNav.classList.add("locked");
      break;
  }
}

function unlockNextStep(currentStep) {
  if (currentStep < provisioningMaxStep()) {
    var nextStepNav = document.getElementById("stepNav" + (currentStep + 1));
    if (nextStepNav) {
      nextStepNav.classList.remove("locked");
    }
  }
}
