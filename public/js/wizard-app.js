// Wizard: wire DOM events after all wizard modules load
document.addEventListener("DOMContentLoaded", async () => {
  initInstallationRunStore();
  readJobSliceEffective();

  // Setup user info and logout
  setupUserInfo();
  
  // Check geolocation support
  if (!navigator.geolocation) {
    console.warn("Geolocation not supported by this browser");
    // Add a warning to the UI
    const locationWarning = document.createElement("div");
    locationWarning.style.cssText = "background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 8px; margin: 8px 0; color: #721c24; font-size: 0.9rem;";
    locationWarning.innerHTML = "⚠️ Geolocation not supported by your browser. You'll need to use manual location override.";
    document.querySelector(".content-container").insertBefore(locationWarning, document.getElementById("clientSection"));
  }
  
  // Load app configuration first
  await loadAppConfig();
  
  // Initialize sidebar navigation
  initializeSidebarNavigation();
  
  clientForm.addEventListener("submit", onNextClient);
  nextVinBtn.addEventListener("click", onNextVin);
  startInstallBtn.addEventListener("click", onStartInstallation);
  verifyImeiBtn.addEventListener("click", onVerifyImei);
  verifySimBtn.addEventListener("click", onVerifySim);
  document.getElementById("verifySecondarySimBtn").addEventListener("click", onVerifySecondarySim);
  
  // Back button event listeners
  document.getElementById("backToClientBtn").addEventListener("click", onBackToClient);
  document.getElementById("backToVinBtn").addEventListener("click", onBackToVin);
  
  // Persist primary IMEI; invalidate IMEI verification when it was previously verified
  imeiInput.addEventListener("input", () => {
    var d = readDevicesSliceEffective();
    if (!d.primary.verified.imei) {
      applyDevicesDiscoveryPatch({ primary: { imei: imeiInput.value.trim() } });
      return;
    }
    invalidatePrimaryImeiVerificationInStore();
    startInstallBtn.disabled = true;
    imeiVerificationStatus.innerHTML =
      '<span style="color:#f39c12;">⚠️ IMEI changed - please verify again</span>';
  });

  // Persist primary SIM ICCID; invalidate SIM verification when it was previously verified
  simInput.addEventListener("input", () => {
    var d = readDevicesSliceEffective();
    if (!d.primary.verified.sim) {
      applyDevicesDiscoveryPatch({ primary: { simIccid: simInput.value.trim() } });
      return;
    }
    invalidatePrimarySimVerificationInStore();
    simVerificationStatus.innerHTML =
      '<span style="color:#f39c12;">⚠️ SIM changed - please verify again</span>';
  });

  document.getElementById("imeiConfirmInput").addEventListener("input", () => {
    applyDevicesDiscoveryPatch({
      primary: { imeiConfirm: document.getElementById("imeiConfirmInput").value.trim() },
    });
  });

  document.getElementById("simConfirmInput").addEventListener("input", () => {
    applyDevicesDiscoveryPatch({
      primary: { simIccidConfirm: document.getElementById("simConfirmInput").value.trim() },
    });
  });

  document.getElementById("secondaryImeiInput").addEventListener("input", () => {
    invalidateSecondaryImeiVerificationInStore();
  });

  // Persist secondary SIM; invalidate secondary SIM verification when it was previously verified
  document.getElementById("secondarySimInput").addEventListener("input", () => {
    var d = readDevicesSliceEffective();
    if (!d.secondary.verified.sim) {
      applyDevicesDiscoveryPatch({
        secondary: { simIccid: document.getElementById("secondarySimInput").value.trim() },
      });
      return;
    }
    invalidateSecondarySimVerificationInStore();
    document.getElementById("secondarySimVerificationStatus").innerHTML =
      '<span style="color:#f39c12;">⚠️ Secondary SIM changed - please verify again</span>';
  });

  document.getElementById("secondarySimConfirmInput").addEventListener("input", () => {
    applyDevicesDiscoveryPatch({
      secondary: {
        simIccidConfirm: document.getElementById("secondarySimConfirmInput").value.trim(),
      },
    });
  });
  
  document.getElementById("addSecondaryUnit").addEventListener("change", function (e) {
    document.getElementById("secondaryUnitFields").classList.toggle("hidden", !e.target.checked);
    applyDevicesDiscoveryPatch({ secondary: { enabled: e.target.checked } });
  });
  
  // Test mode toggle (Admin only)
  document.getElementById("enableTestMode").addEventListener("change", function(e) {
    // Check if user is admin before allowing test mode
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.role !== 'admin') {
      e.target.checked = false;
      alert('Test mode is only available for admin users.');
      return;
    }
    
    document.getElementById("testModeFields").classList.toggle("hidden", !e.target.checked);
    if (e.target.checked) {
      updateDeviceLocationDisplay();
    }
  });
  
  // Copy device location to test fields
  document.addEventListener("click", function(e) {
    if (e.target.id === "copyDeviceLocationBtn") {
      const inst = JSON.parse(sessionStorage.getItem("selectedInstallation") || "{}");
      const deviceLat = inst.vehiculo?.latest?.loc?.lat;
      const deviceLon = inst.vehiculo?.latest?.loc?.lon;
      
      if (deviceLat && deviceLon) {
        document.getElementById("testLatInput").value = deviceLat.toFixed(5);
        document.getElementById("testLonInput").value = deviceLon.toFixed(5);
        e.target.textContent = "✅ Copied!";
        setTimeout(() => {
          e.target.textContent = "📋 Copy to Test Fields";
        }, 2000);
      } else {
        alert("Device location not available yet. Please wait for the device to report its location.");
      }
    }
  });
  
  // Final confirmation button
  finalConfirmBtn.addEventListener("click", onFinalConfirmation);

  // Start over (explicit user action only; does not change page-load behavior)
  var startOverBtn = document.getElementById("startOverBtn");
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
});
