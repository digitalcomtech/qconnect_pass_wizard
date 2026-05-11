// Wizard: primary device location polling + proximity (nested helpers)
function pollForDeviceReporting() {
  // Steady polling at 1 per minute
  const MAX_DURATION = 30 * 60 * 1000; // 30 minutes total
  const BYPASS_OPTION_TIME = 15 * 60 * 1000; // 15 minutes - show bypass option
  const STEADY_INTERVAL = 60000; // Steady 1 minute between checks
  
  let attempts = 0;
  let currentInterval = STEADY_INTERVAL;
  let startTime = Date.now();
  recordPollingStarted(startTime);
  let lastLocationCheck = null;
  let consecutiveLocationFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3; // Allow some wrong locations before giving up

  // Update the status display with better information
  function updateStatusDisplay() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const nextCheckIn = Math.ceil(currentInterval / 1000);
    
    // Reset form opened flag when starting device monitoring
    formAlreadyOpened = false;
    console.log("🔍 Reset formAlreadyOpened flag to false");
    
    installStatus.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 1.2rem; color: #6B21A8; margin-bottom: 12px; font-weight: 700;">
          ⏳ Waiting for device to report location...
        </div>
        <div style="font-size: 0.95rem; color: #475569; margin-bottom: 10px; line-height: 1.5;">
          <strong>Elapsed time:</strong> ${timeStr} | <strong>Next check in:</strong> ${nextCheckIn}s
        </div>
        <div style="font-size: 0.95rem; color: #475569; margin-bottom: 12px; line-height: 1.5;">
          <strong>Attempts:</strong> ${attempts} | <strong>Current interval:</strong> ${Math.ceil(currentInterval/1000)}s
        </div>
        <div class="info-box" style="margin-bottom: 12px;">
          💡 <strong>Tip:</strong> Device may take up to 30 minutes to report. We'll check every minute at a steady pace.
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; color: #92400e;">
          🔍 <strong>Enhanced Requirements:</strong> Device must be online, have recent connection data (≤5min), recent network activity (≤5min), AND fresh location data (≤60s old)
        </div>
        ${elapsed >= 15 ? '<div class="info-box" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 2px solid #3b82f6; color: #1e40af; margin-top: 12px;"><strong>💡 Bypass Available:</strong> After 15 minutes, you can bypass the location check and proceed with installation</div>' : ''}
      </div>
      <button id="stopPollingBtn" type="button" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); margin-top: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">🛑 Stop Waiting</button>
                  <button id="forceLocationCheckBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); margin-left: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔍 Check Now</button>
    `;

    // Add event listeners for the new buttons
    document.getElementById("stopPollingBtn").addEventListener("click", () => {
      window.stopPolling = true;
      installStatus.innerHTML = "🛑 Stopped waiting for device. You can restart the installation process.";
    });

    document.getElementById("forceLocationCheckBtn").addEventListener("click", () => {
      // Force an immediate check
      currentInterval = 1000; // Check in 1 second
      checkStatus();
    });
  }

  async function checkStatus() {
    // Check if polling was stopped
    if (window.stopPolling) {
      console.log("Polling stopped by user");
      return;
    }

    // Check if we've exceeded the bypass option time (15 minutes)
    if (Date.now() - startTime > BYPASS_OPTION_TIME && Date.now() - startTime <= MAX_DURATION) {
      recordBypassOffered();
      installStatus.innerHTML = `
        <div style="color: #f59e0b; margin-bottom: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">⏰ 15 minutes elapsed - Bypass option available</div>
          <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
            The device has not reported location yet. You can continue waiting or bypass the location check:
          </div>
          <ul style="font-size: 0.95rem; margin-bottom: 16px; padding-left: 24px; line-height: 1.6;">
            <li>Continue waiting (up to 30 minutes total)</li>
            <li>Bypass location check and proceed with installation</li>
          </ul>
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">
          <strong>Options:</strong>
          <div style="margin-top: 12px;">
            <button id="bypassLocationCheckBtn" type="button" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); margin-right: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">✅ Bypass Location Check</button>
            <button id="continueWaitingBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">⏳ Continue Waiting</button>
          </div>
        </div>
      `;

      // Add event listeners for the options
      document.getElementById("bypassLocationCheckBtn").addEventListener("click", () => {
        console.log("User chose to bypass location check");
        // Proceed to the next step without location validation
        proceedWithoutLocationCheck();
      });

      document.getElementById("continueWaitingBtn").addEventListener("click", () => {
        console.log("User chose to continue waiting");
        // Continue with normal polling
        checkStatus();
      });

      return;
    }

    // Check if we've exceeded the maximum duration (30 minutes)
    if (Date.now() - startTime > MAX_DURATION) {
      recordBypassOffered();
      installStatus.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">⏰ Time limit reached (30 minutes)</div>
          <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
            The device has not reported location within the expected timeframe. This could indicate:
          </div>
          <ul style="font-size: 0.95rem; margin-bottom: 16px; padding-left: 24px; line-height: 1.6;">
            <li>Device is not properly connected or powered</li>
            <li>Network connectivity issues</li>
            <li>Device configuration problems</li>
          </ul>
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">
          <strong>Options:</strong>
          <div style="margin-top: 12px;">
            <button id="bypassLocationCheckBtn" type="button" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); margin-right: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">✅ Bypass Location Check</button>
            <button id="retryPollingBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔄 Restart Polling</button>
          </div>
        </div>
      `;

      // Add event listeners for the options
      document.getElementById("bypassLocationCheckBtn").addEventListener("click", () => {
        console.log("User chose to bypass location check after timeout");
        proceedWithoutLocationCheck();
      });

      document.getElementById("retryPollingBtn").addEventListener("click", () => {
        startTime = Date.now();
        attempts = 0;
        currentInterval = STEADY_INTERVAL;
        consecutiveLocationFailures = 0;
        checkStatus();
      });

      return;
    }

    attempts++;
    console.log(`Checking device status (attempt ${attempts}, interval: ${Math.ceil(currentInterval/1000)}s)...`);
    
    // Update status display
    updateStatusDisplay();

    try {
              // Call backend endpoint to check device status
    const resp = await fetch(`/api/device-status?imei=${encodeURIComponent(imeiInput.value.trim())}`, {
      headers: getAuthHeaders()
    });
    const data = await resp.json();

    recordPollingSnapshot(attempts, data, resp);
    
    // Log detailed device status for debugging
    console.log("Device status check:", {
      isReporting: data.isReporting,
      hasValidLocation: data.latest?.loc?.lat != null && data.latest?.loc?.lon != null && (data.latest?.loc?.age || 0) <= 60,
      isOnline: data.connection?.online,
      connectionState: data.connection?.state,
      locationAge: data.latest?.loc?.age,
      locationData: data.latest?.loc
    });
    
    // Also log the full response for debugging
    console.log("Full device status response:", data);

      // Enhanced validation using backend analysis
      const isDeviceOnline = data.isOnline === true;
      // Use the same logic as the backend: check if coordinates exist and are fresh
      const hasValidLocation = data.latest?.loc?.lat != null && data.latest?.loc?.lon != null && (data.latest?.loc?.age || 0) <= 60;
      const locationAge = data.latest?.loc?.age || 0; // Age in seconds
      const hasRecentConnection = data.hasRecentConnection === true;
      const hasRecentActivity = data.hasRecentActivity === true;
      
      // Debug: Log each validation check individually
      console.log("🔍 VALIDATION DEBUG:", {
        isReporting: data.isReporting,
        hasValidLocation,
        isDeviceOnline,
        hasRecentConnection,
        hasRecentActivity,
        locationAge,
        dataKeys: Object.keys(data)
      });
      
      // Update device location display for test mode
      if (document.getElementById("enableTestMode").checked) {
        updateDeviceLocationDisplay();
      }
      
      // Comprehensive validation - ALL conditions must be true
      if (data.isReporting && hasValidLocation && isDeviceOnline && hasRecentConnection && hasRecentActivity && locationAge <= 60) {
        console.log("Device is online and reporting fresh location, checking proximity...");
        
        // Update workflow status
        updateWorkflowStatus({
          status: `Device ready! Location age: ${locationAge}s`
        });
        
        // Get device location data
        const deviceLat = data.latest.loc.lat;
        const deviceLon = data.latest.loc.lon;

        if (deviceLat == null || deviceLon == null) {
          console.log("Device location data incomplete, continuing to poll...");
          scheduleNextCheck();
          return;
        }

        // Check if this is a reasonable location (not obviously wrong)
        if (Math.abs(deviceLat) > 90 || Math.abs(deviceLon) > 180) {
          console.log("Device reported invalid coordinates, continuing to poll...");
          scheduleNextCheck();
          return;
        }

        // Check location age - if it's very old, it might be stale data
        if (locationAge > 300) { // 5 minutes old
          console.log(`Device location is ${locationAge}s old, might be stale. Continuing to poll...`);
          scheduleNextCheck();
          return;
        }

        // Now check user proximity to device (only if form hasn't been opened yet)
        console.log("🔍 About to check proximity. formAlreadyOpened:", formAlreadyOpened);
        if (!formAlreadyOpened) {
          console.log("🔍 Calling checkUserProximity with device coordinates:", deviceLat, deviceLon);
          await checkUserProximity(deviceLat, deviceLon);
        } else {
          console.log("Form already opened, skipping proximity check");
          recordReportingPhase("polling");
          scheduleNextCheck();
        }
        
      } else {
        // Enhanced logging showing exactly why each check failed
        console.log("🔍 Device validation failed - analyzing reasons:");
        
        if (!data.isReporting) {
          console.log("❌ Device not reporting data yet");
        } else {
          console.log("✅ Device is reporting data");
        }
        
        if (!hasValidLocation) {
          console.log("❌ Device data available but no valid location");
        } else {
          console.log("✅ Device has valid location");
        }
        
        if (!isDeviceOnline) {
          console.log("❌ Device has location but is offline");
        } else {
          console.log("✅ Device connection is online");
        }
        
        if (!hasRecentConnection) {
          console.log("❌ Device connection data is stale (>5 minutes old)");
        } else {
          console.log("✅ Device has recent connection data");
        }
        
        if (!hasRecentActivity) {
          console.log("❌ Device has no recent network activity (>5 minutes)");
        } else {
          console.log("✅ Device has recent network activity");
        }
        
        if (locationAge > 60) {
          console.log(`❌ Device location is too old (${locationAge}s > 60s)`);
        } else {
          console.log(`✅ Device location is fresh (${locationAge}s ≤ 60s)`);
        }
        
        console.log("📊 Summary:", {
          isReporting: data.isReporting,
          hasValidLocation,
          isDeviceOnline,
          hasRecentConnection,
          hasRecentActivity,
          locationAge,
          dataFreshness: data.dataFreshness
        });
        
        scheduleNextCheck();
      }

    } catch (error) {
      console.error("Error checking device status:", error);
      recordPollingFailure(error && error.message ? error.message : "device-status error");
      // Don't stop polling on errors, just continue
      scheduleNextCheck();
    }
  }

          // Function to check user proximity to device
    async function checkUserProximity(deviceLat, deviceLon) {
      console.log("🔍 checkUserProximity called with:", deviceLat, deviceLon);

      recordReportingPhase("proximity");
      
      // Double-check to prevent multiple form openings
      if (formAlreadyOpened) {
        console.log("Form already opened, skipping proximity check");
        recordReportingPhase("polling");
        return;
      }
      
      try {
        // Check if test mode is enabled (Admin only)
        const testModeEnabled = document.getElementById("enableTestMode").checked;
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        
        console.log("🔍 Test mode enabled:", testModeEnabled, "User role:", userInfo.role);
        
        if (testModeEnabled && userInfo.role === 'admin') {
          // Use test coordinates
          const testLat = parseFloat(document.getElementById("testLatInput").value);
          const testLon = parseFloat(document.getElementById("testLonInput").value);
          
          if (isNaN(testLat) || isNaN(testLon)) {
            console.log("Test coordinates not entered, continuing to poll...");
            recordReportingPhase("polling");
            scheduleNextCheck();
            return;
          }
          
          console.log(`🧪 Test Mode: Using coordinates ${testLat}, ${testLon}`);
          console.log(`🧪 Device coordinates: ${deviceLat}, ${deviceLon}`);
          const distance = haversineDistance(testLat, testLon, deviceLat, deviceLon);
          console.log(`🧪 Calculated distance: ${distance.toFixed(2)}m`);
          
          if (distance < 200) {
            handleProximitySuccess("Test Mode");
          } else {
            handleProximityFailure(distance, "Test Mode");
          }
        } else {
          // Use GPS location
          console.log("🔍 Using GPS location for proximity check");
          navigator.geolocation.getCurrentPosition(
            function(position) {
              console.log("🔍 GPS position received:", position.coords);
              const userLat = position.coords.latitude;
              const userLon = position.coords.longitude;
              const distance = haversineDistance(userLat, userLon, deviceLat, deviceLon);
              
              console.log("🔍 GPS proximity check - User:", userLat, userLon, "Device:", deviceLat, deviceLon, "Distance:", distance);
              
              if (distance < 200) {
                console.log("🔍 GPS proximity check PASSED");
                handleProximitySuccess("GPS");
              } else {
                console.log("🔍 GPS proximity check FAILED - too far");
                handleProximityFailure(distance, "GPS");
              }
            },
            function(error) {
              console.log("🔍 GPS error:", error);
              console.log("GPS error, showing manual location options...");
              showManualLocationOverride(deviceLat, deviceLon);
            },
            { 
              enableHighAccuracy: true, 
              timeout: 15000, 
              maximumAge: 60000 
            }
          );
        }

    } catch (error) {
      console.error("Error in proximity check:", error);
      recordReportingPhase("polling");
      scheduleNextCheck();
    }
  }

  // Handle bypassing location check
  function proceedWithoutLocationCheck() {
    console.log("Proceeding without location check - bypassing proximity validation");
    
    // Prevent multiple form openings
    if (formAlreadyOpened) {
      console.log("Form already opened, skipping bypass");
      return;
    }

    recordBypassChosen();
    formAlreadyOpened = true; // Set flag to prevent multiple openings
    
    installStatus.innerHTML = `
      <div style="color: #f59e0b; margin-bottom: 20px;">
        <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">⚠️ Location check bypassed</div>
        <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
          You have chosen to bypass the location check. Opening installation form...
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">
          ⚠️ <strong>Note:</strong> Location validation was bypassed. Please ensure you are at the correct installation site.
        </div>
      </div>
      <div style="color: #059669; margin-bottom: 12px; font-weight: 700;">✅ Location check bypassed!</div>
      <div class="info-box" style="margin-bottom: 12px;">
        <div style="font-weight: 700; color: #6B21A8; margin-bottom: 10px; font-size: 1rem;">📋 Form Opened</div>
        <div style="font-size: 0.95rem; color: #374151; margin-bottom: 16px; line-height: 1.5;">
          The installation form has been opened. Please fill out the required information to complete the installation.
        </div>
      </div>
    `;
    
    // Open the installation form
    setTimeout(() => {
      openInstallationForm();
    }, 1000);
  }

  // Handle successful proximity check
  function handleProximitySuccess(method) {
    // Prevent multiple form openings
    if (formAlreadyOpened) {
      console.log("Form already opened, skipping duplicate call");
      return;
    }
    
    console.log(`Proximity check successful via ${method}`);
    recordProximityResult(method, null);
    recordReportingPhase("idle");
    formAlreadyOpened = true; // Set flag to prevent multiple openings
    
    const testModeIndicator = method === "Test Mode" ? 
      '<div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">🧪 <strong>Test Mode Active:</strong> Using custom coordinates for proximity check</div>' : '';
    
    installStatus.innerHTML = `
      <div style="color: #059669; margin-bottom: 20px;">
        <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">✅ Location check passed!</div>
        <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
          You are within 200 meters of the device. Opening installation form...
        </div>
        ${testModeIndicator}
      </div>
    `;
    
    setTimeout(() => {
      console.log("Opening prefilled form...");
      openPrefilledForm();
      console.log("Form opened successfully");
      
      // Update sidebar: Step 4 completed, unlock Step 5
      updateStepStatus(4, 'completed');
      unlockNextStep(4);
      
      // Show form completion interface
      installStatus.innerHTML = `
        <div style="color: #059669; margin-bottom: 12px; font-weight: 700;">✅ Location check passed!</div>
        <div class="info-box" style="margin-bottom: 12px;">
          <div style="font-weight: 700; color: #6B21A8; margin-bottom: 10px; font-size: 1rem;">📋 Form Opened</div>
          <div style="font-size: 0.95rem; color: #374151; margin-bottom: 16px; line-height: 1.5;">
            The installation form has been opened in a new tab. Please complete the form, then return here and click the button below to continue.
          </div>
          <button id="formCompletedBtn" type="button" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
            ✅ I've Completed the Form - Continue to Confirmation
          </button>
        </div>
      `;
      
      // Add event listener for the form completion button
      document.getElementById("formCompletedBtn").addEventListener("click", function() {
        recordPaperworkAcknowledged();
        // Check if secondary device needs to be processed
        const addSecondary = document.getElementById("addSecondaryUnit").checked;
        const secondaryImei = document.getElementById("secondaryImeiInput").value.trim();
        
        if (addSecondary && secondaryImei && window.secondaryImeiVerified) {
          // Start secondary device workflow (Steps 35-40)
          startSecondaryDeviceWorkflow(secondaryImei);
        } else {
          // Update sidebar: Step 5 completed, unlock Step 6
          updateStepStatus(5, 'completed');
          unlockNextStep(5);
          
          showConfirmationStep();
        }
      });
    }, 1000);
  }

  // Handle proximity check failure
  function handleProximityFailure(distance, method) {
    recordProximityResult(method, distance);
    consecutiveLocationFailures++;
    console.log(`Proximity check failed via ${method}. Distance: ${distance.toFixed(0)}m. Failures: ${consecutiveLocationFailures}`);
    
    if (consecutiveLocationFailures >= MAX_CONSECUTIVE_FAILURES) {
      // Too many consecutive failures, show manual options
      installStatus.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">📍 Location mismatch detected</div>
          <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
            Device location: ${distance.toFixed(0)}m away from your position.<br>
            This could be due to:
          </div>
          <ul style="font-size: 0.95rem; margin-bottom: 16px; padding-left: 24px; line-height: 1.6;">
            <li>Device reporting its last known location (not current)</li>
            <li>GPS accuracy issues on either device</li>
            <li>Device not yet moved to installation location</li>
          </ul>
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">
          <strong>Options:</strong>
          <div style="margin-top: 12px;">
            <button id="continuePollingBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); margin-right: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔄 Continue Waiting</button>
          </div>
        </div>
      `;

      // Add event listeners
      document.getElementById("continuePollingBtn").addEventListener("click", () => {
        consecutiveLocationFailures = 0; // Reset counter
        recordReportingPhase("polling");
        scheduleNextCheck();
      });

    } else {
      // Just continue polling, but show the issue
      installStatus.innerHTML = `
        <div style="color: #d97706; margin-bottom: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">⚠️ Location mismatch (${consecutiveLocationFailures}/${MAX_CONSECUTIVE_FAILURES})</div>
          <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
            Device is ${distance.toFixed(0)}m away. This might be stale location data.<br>
            Continuing to monitor for updated location...
          </div>
        </div>
        <button id="stopPollingBtn" type="button" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); margin-top: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">🛑 Stop Waiting</button>
        <button id="forceLocationCheckBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); margin-left: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔍 Check Now</button>
      `;

      // Add event listeners
      document.getElementById("stopPollingBtn").addEventListener("click", () => {
        window.stopPolling = true;
        installStatus.innerHTML = "🛑 Stopped waiting for device. You can restart the installation process.";
      });

      document.getElementById("forceLocationCheckBtn").addEventListener("click", () => {
        currentInterval = 1000; // Check in 1 second
        checkStatus();
      });

      recordReportingPhase("polling");
      scheduleNextCheck();
    }
  }


  // Schedule the next check at steady 1-minute intervals
  function scheduleNextCheck() {
    if (window.stopPolling) return;
    
    // Keep interval steady at 1 minute
    currentInterval = STEADY_INTERVAL;
    
    console.log(`Scheduling next check in ${Math.ceil(currentInterval/1000)}s (steady interval)`);
    setTimeout(checkStatus, currentInterval);
  }

  // Start the first check
  checkStatus();
}
