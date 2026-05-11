// Final confirmation step (Pegasus confirm-installation)
// SHOW CONFIRMATION STEP
function showConfirmationStep() {
  deviceSection.classList.add("hidden");
  confirmationSection.classList.remove("hidden");
  sessionStorage.setItem("step", "confirmation");
}

// FINAL CONFIRMATION HANDLER
async function onFinalConfirmation() {
  confirmationStatus.innerText = "🔄 Sending final confirmation to system...";
  finalConfirmBtn.disabled = true;
  
  // Track final confirmation step
  if (window.activityTracker) {
    window.activityTracker.trackFormCompletion({
      timestamp: new Date().toISOString(),
      step: 'finalConfirmation'
    });
  }

  recordConfirmationStarted();

  let resp = null;
  let data = null;
  try {
    resp = await fetch("/api/confirm-installation", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        installationId: selectedInstallationId 
      })
    });

    try {
      data = await resp.json();
    } catch (parseErr) {
      console.warn("Confirm-installation response JSON parse failed:", parseErr);
      data = null;
    }

    if (resp.ok && data && data.success) {
      recordConfirmationSuccess(resp, data);

      // Update sidebar: Step 6 completed
      updateStepStatus(6, 'completed');
      
      // Update workflow status
      updateWorkflowStatus({
        currentStep: '6',
        status: 'Installation confirmed successfully! 🎉'
      });
      
      confirmationStatus.innerText = "✅ Installation confirmed successfully!";
      setTimeout(() => {
        confirmationSection.classList.add("hidden");
        successMsg.style.display = "block";
        sessionStorage.setItem("step", "done");
      }, 1500);
    } else {
      recordConfirmationFailure(resp, new Error((data && data.message) || "Confirmation failed"), data);
      confirmationStatus.innerText = `❌ Confirmation failed: ${(data && data.message) || "Unknown error"}`;
      finalConfirmBtn.disabled = false;
      console.error("Confirmation failed:", data);
    }
  } catch (err) {
    console.error("Error confirming installation:", err);
    recordConfirmationFailure(resp, err, data);
    confirmationStatus.innerText = "❌ Error confirming installation. Please try again.";
    finalConfirmBtn.disabled = false;
  }
}
