// Wizard: optional workflow status bar in content area
function showWorkflowStatusBar() {
  const statusBar = document.getElementById('workflowStatusBar');
  if (statusBar) {
    statusBar.style.display = 'block';
  }
}

function updateWorkflowStatus(updates) {
  // Check if status bar exists before proceeding
  const statusBar = document.getElementById('workflowStatusBar');
  if (!statusBar) {
    return; // Exit early if status bar doesn't exist
  }
  
  // Show the status bar if it's hidden
  showWorkflowStatusBar();
  
  // Update each field if provided, with null checks
  if (updates.currentStep) {
    const stepElement = document.getElementById('currentStepDisplay');
    if (stepElement) stepElement.textContent = updates.currentStep;
  }
  if (updates.vin) {
    const vinElement = document.getElementById('currentVinDisplay');
    if (vinElement) vinElement.textContent = updates.vin;
  }
  if (updates.primaryImei) {
    const primaryElement = document.getElementById('currentPrimaryImeiDisplay');
    if (primaryElement) primaryElement.textContent = updates.primaryImei;
  }
  if (updates.secondaryImei) {
    const secondaryElement = document.getElementById('currentSecondaryImeiDisplay');
    if (secondaryElement) secondaryElement.textContent = updates.secondaryImei;
  }
  if (updates.status) {
    const statusElement = document.getElementById('currentStatusDisplay');
    if (statusElement) statusElement.textContent = updates.status;
  }
}

function clearWorkflowStatus() {
  // Check if status bar exists before proceeding
  const statusBar = document.getElementById('workflowStatusBar');
  if (!statusBar) {
    return; // Exit early if status bar doesn't exist
  }
  
  const stepElement = document.getElementById('currentStepDisplay');
  const vinElement = document.getElementById('currentVinDisplay');
  const primaryElement = document.getElementById('currentPrimaryImeiDisplay');
  const secondaryElement = document.getElementById('currentSecondaryImeiDisplay');
  const statusElement = document.getElementById('currentStatusDisplay');
  
  if (stepElement) stepElement.textContent = '1';
  if (vinElement) vinElement.textContent = '-';
  if (primaryElement) primaryElement.textContent = '-';
  if (secondaryElement) secondaryElement.textContent = '-';
  if (statusElement) statusElement.textContent = 'Ready to start';
}
