// Wizard: sidebar step navigation + section visibility
function initializeSidebarNavigation() {
  // Add click event listeners to all step navigation items
  document.querySelectorAll('.step-item').forEach(stepItem => {
    stepItem.addEventListener('click', function() {
      const step = this.getAttribute('data-step');
      if (!this.classList.contains('locked')) {
        navigateToStep(parseInt(step));
      }
    });
  });
}

// Navigate to a specific step
function navigateToStep(stepNumber) {
  // Hide all sections first
  document.querySelectorAll('.section').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Remove active class from all step nav items
  document.querySelectorAll('.step-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Show the selected step
  let targetSection;
  switch(stepNumber) {
    case 1:
      targetSection = document.getElementById('clientSection');
      break;
    case 2:
      targetSection = document.getElementById('vinSection');
      break;
    case 3:
      targetSection = document.getElementById('deviceSection');
      break;
    case 4:
      targetSection = document.getElementById('locationSection');
      break;
    case 5:
      targetSection = document.getElementById('formSection');
      break;
    case 6:
      targetSection = document.getElementById('confirmationSection');
      break;
    default:
      targetSection = document.getElementById('clientSection');
  }
  
  if (targetSection) {
    targetSection.classList.remove('hidden');
    // Update active step in sidebar
    document.getElementById(`stepNav${stepNumber}`).classList.add('active');
    // Store current step in session
    sessionStorage.setItem("currentStep", stepNumber.toString());
  }
}

// Update step status in sidebar
function updateStepStatus(stepNumber, status) {
  const stepNav = document.getElementById(`stepNav${stepNumber}`);
  const stepStatus = document.getElementById(`stepStatus${stepNumber}`);
  
  if (stepNav && stepStatus) {
    // Remove all status classes
    stepNav.classList.remove('locked', 'completed');
    stepStatus.classList.remove('completed');
    
    // Apply new status
    switch(status) {
      case 'completed':
        stepNav.classList.add('completed');
        stepStatus.classList.add('completed');
        break;
      case 'active':
        stepNav.classList.add('active');
        break;
      case 'locked':
        stepNav.classList.add('locked');
        break;
    }
  }
}

// Unlock next step
function unlockNextStep(currentStep) {
  if (currentStep < 6) {
    const nextStep = currentStep + 1;
    const nextStepNav = document.getElementById(`stepNav${nextStep}`);
    if (nextStepNav) {
      nextStepNav.classList.remove('locked');
    }
  }
}

