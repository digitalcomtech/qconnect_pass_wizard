// Wizard: secondary IMEI completion path (+ historical commented polling)
// Secondary Device Workflow (Steps 35-40) - Simplified workflow without location validation
async function startSecondaryDeviceWorkflow(secondaryImei) {
  console.log("🚀 Starting secondary device workflow for IMEI:", secondaryImei);
  
  // Update status to show secondary device processing
  installStatus.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 1.2rem; color: #6B21A8; margin-bottom: 12px; font-weight: 700;">
        🔄 Starting Secondary Device Installation
      </div>
      <div style="font-size: 0.95rem; color: #475569; margin-bottom: 12px; line-height: 1.5;">
        <strong>Secondary IMEI:</strong> ${secondaryImei}<br>
        <strong>Status:</strong> Completing secondary device setup...
    </div>
    <div class="info-box" style="margin-bottom: 12px;">
      💡 <strong>Secondary Device:</strong> No location validation required - completing secondary device setup.
    </div>
    </div>
  `;
  
  // Skip location validation and proceed directly to completion
  setTimeout(() => {
    // Complete secondary device workflow directly without form
    completeSecondaryDeviceWorkflow(false); // false = not skipped
  }, 1000);
}


// REMOVED: pollForSecondaryDeviceReporting function - no longer needed since secondary device doesn't require location validation
/*
function pollForSecondaryDeviceReporting(secondaryImei) {
  // Smart polling with progressive backoff and extended timeout
  const MAX_DURATION = 30 * 60 * 1000; // 30 minutes total
  const BYPASS_OPTION_TIME = 15 * 60 * 1000; // 15 minutes - show bypass option
  const INITIAL_INTERVAL = 10000; // Start with 10 seconds
  const MAX_INTERVAL = 120000; // Max 2 minutes between checks
  const BACKOFF_MULTIPLIER = 1.5; // Increase interval by 50% each time
  
  let attempts = 0;
  let currentInterval = INITIAL_INTERVAL;
  let startTime = Date.now();
  let consecutiveLocationFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;
  
  // Update the status display with better information
  function updateSecondaryStatusDisplay() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const nextCheckIn = Math.ceil(currentInterval / 1000);
    
    installStatus.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 1.2rem; color: #6B21A8; margin-bottom: 12px; font-weight: 700;">
          ⏳ Waiting for Secondary Device to Report Location...
        </div>
        <div style="font-size: 0.95rem; color: #475569; margin-bottom: 10px; line-height: 1.5;">
          <strong>Secondary IMEI:</strong> ${secondaryImei}<br>
          <strong>Elapsed time:</strong> ${timeStr} | <strong>Next check in:</strong> ${nextCheckIn}s
        </div>
        <div style="font-size: 0.95rem; color: #475569; margin-bottom: 12px; line-height: 1.5;">
          <strong>Attempts:</strong> ${attempts} | <strong>Current interval:</strong> ${Math.ceil(currentInterval/1000)}s
        </div>
        <div class="info-box" style="margin-bottom: 12px;">
          💡 <strong>Secondary Device:</strong> Device may take up to 30 minutes to report. We'll check less frequently over time.
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; color: #92400e;">
          🔍 <strong>Enhanced Requirements:</strong> Secondary device must be online, have recent connection data (≤5min), recent network activity (≤5min), AND fresh location data (≤60s old)
        </div>
      </div>
      <button id="stopSecondaryPollingBtn" type="button" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); margin-top: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">🛑 Stop Waiting</button>
      <button id="forceSecondaryLocationCheckBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); margin-left: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔍 Check Now</button>
    `;

    // Add event listeners for the new buttons
    document.getElementById("stopSecondaryPollingBtn").addEventListener("click", () => {
      window.stopSecondaryPolling = true;
      installStatus.innerHTML = "🛑 Stopped waiting for secondary device. You can restart the installation process.";
    });

    document.getElementById("forceSecondaryLocationCheckBtn").addEventListener("click", () => {
      // Force an immediate check
      currentInterval = 1000; // Check in 1 second
      checkSecondaryStatus();
    });
  }

  async function checkSecondaryStatus() {
    // Check if polling was stopped
    if (window.stopSecondaryPolling) {
      console.log("Secondary device polling stopped by user");
      return;
    }

    // Check if we've exceeded the maximum duration
    if (Date.now() - startTime > MAX_DURATION) {
      installStatus.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">⏰ Secondary Device Time Limit Reached (30 minutes)</div>
          <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
            The secondary device has not reported location within the expected timeframe. This could indicate:
          </div>
          <ul style="font-size: 0.95rem; margin-bottom: 16px; padding-left: 24px; line-height: 1.6;">
            <li>Secondary device is not properly connected or powered</li>
            <li>Network connectivity issues</li>
            <li>Secondary device configuration problems</li>
          </ul>
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">
          <strong>Options:</strong>
          <div style="margin-top: 12px;">
            <button id="retrySecondaryPollingBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); margin-right: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔄 Restart Secondary Device Polling</button>
            <button id="skipSecondaryDeviceBtn" type="button" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); margin-left: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);">⏭️ Skip Secondary Device</button>
          </div>
        </div>
      `;

      // Add event listeners for the options
      document.getElementById("retrySecondaryPollingBtn").addEventListener("click", () => {
        startTime = Date.now();
        attempts = 0;
        currentInterval = INITIAL_INTERVAL;
        consecutiveLocationFailures = 0;
        checkSecondaryStatus();
      });

      document.getElementById("skipSecondaryDeviceBtn").addEventListener("click", () => {
        // Skip secondary device and proceed to final confirmation
        completeSecondaryDeviceWorkflow(true); // true = skipped
      });

      return;
    }

    attempts++;
    console.log(`Checking secondary device status (attempt ${attempts}, interval: ${Math.ceil(currentInterval/1000)}s)...`);
    
    // Update status display
    updateSecondaryStatusDisplay();

    try {
      // Call backend endpoint to check secondary device status
      const resp = await fetch(`/api/device-status?imei=${encodeURIComponent(secondaryImei)}`, {
        headers: getAuthHeaders()
      });
      const data = await resp.json();
      
      // Log detailed secondary device status for debugging
      console.log("Secondary device status check:", {
        isReporting: data.isReporting,
        hasValidLocation: data.latest?.loc?.lat != null && data.latest?.loc?.lon != null && (data.latest?.loc?.age || 0) <= 60,
        isOnline: data.connection?.online,
        connectionState: data.connection?.state,
        locationAge: data.latest?.loc?.age,
        locationData: data.latest?.loc
      });
      
      // Enhanced validation using backend analysis
      const isDeviceOnline = data.isOnline === true;
      const hasValidLocation = data.latest?.loc?.lat != null && data.latest?.loc?.lon != null && (data.latest?.loc?.age || 0) <= 60;
      const locationAge = data.latest?.loc?.age || 0;
      const hasRecentConnection = data.hasRecentConnection === true;
      const hasRecentActivity = data.hasRecentActivity === true;
      
      // Comprehensive validation - ALL conditions must be true
      if (data.isReporting && hasValidLocation && isDeviceOnline && hasRecentConnection && hasRecentActivity && locationAge <= 60) {
        console.log("Secondary device is online and reporting fresh location, checking proximity...");
        
        // Get secondary device location data
        const deviceLat = data.latest.loc.lat;
        const deviceLon = data.latest.loc.lon;

        if (deviceLat == null || deviceLon == null) {
          console.log("Secondary device location data incomplete, continuing to poll...");
          scheduleNextSecondaryCheck();
          return;
        }

        // Check if this is a reasonable location (not obviously wrong)
        if (Math.abs(deviceLat) > 90 || Math.abs(deviceLon) > 180) {
          console.log("Secondary device reported invalid coordinates, continuing to poll...");
          scheduleNextSecondaryCheck();
          return;
        }

        // Check location age - if it's very old, it might be stale data
        if (locationAge > 300) { // 5 minutes old
          console.log(`Secondary device location is ${locationAge}s old, might be stale. Continuing to poll...`);
          scheduleNextSecondaryCheck();
          return;
        }

        // Now check user proximity to secondary device
        await checkSecondaryDeviceProximity(deviceLat, deviceLon);
        
      } else {
        // Enhanced logging showing exactly why each check failed
        console.log("🔍 Secondary device validation failed - analyzing reasons:");
        
        if (!data.isReporting) {
          console.log("❌ Secondary device not reporting data yet");
        } else {
          console.log("✅ Secondary device is reporting data");
        }
        
        if (!hasValidLocation) {
          console.log("❌ Secondary device data available but no valid location");
        } else {
          console.log("✅ Secondary device has valid location");
        }
        
        if (!isDeviceOnline) {
          console.log("❌ Secondary device has location but is offline");
        } else {
          console.log("✅ Secondary device connection is online");
        }
        
        if (!hasRecentConnection) {
          console.log("❌ Secondary device connection data is stale (>5 minutes old)");
        } else {
          console.log("✅ Secondary device has recent connection");
        }
        
        if (!hasRecentActivity) {
          console.log("❌ Secondary device network activity is stale (>5 minutes old)");
        } else {
          console.log("✅ Secondary device has recent network activity");
        }
        
        if (locationAge > 60) {
          console.log(`❌ Secondary device location is ${locationAge}s old (max 60s)`);
        } else {
          console.log("✅ Secondary device location is fresh");
        }
        
        // Continue polling
        scheduleNextSecondaryCheck();
      }
      
    } catch (error) {
      console.error("Error checking secondary device status:", error);
      scheduleNextSecondaryCheck();
    }
  }

  // Function to check user proximity to secondary device
  async function checkSecondaryDeviceProximity(deviceLat, deviceLon) {
    try {
      // Check if test mode is enabled (Admin only)
      const testModeEnabled = document.getElementById("enableTestMode").checked;
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      
      if (testModeEnabled && userInfo.role === 'admin') {
        // Use test coordinates
        const testLat = parseFloat(document.getElementById("testLatInput").value);
        const testLon = parseFloat(document.getElementById("testLonInput").value);
        
        if (isNaN(testLat) || isNaN(testLon)) {
          console.log("Test coordinates not entered, continuing to poll...");
          scheduleNextSecondaryCheck();
          return;
        }
        
        console.log(`🧪 Test Mode: Using coordinates ${testLat}, ${testLon}`);
        console.log(`🧪 Secondary device coordinates: ${deviceLat}, ${deviceLon}`);
        const distance = haversineDistance(testLat, testLon, deviceLat, deviceLon);
        console.log(`🧪 Calculated distance: ${distance.toFixed(2)}m`);
        
        if (distance < 200) {
          handleSecondaryDeviceProximitySuccess("Test Mode");
        } else {
          handleSecondaryDeviceProximityFailure(distance, "Test Mode");
        }
      } else {
        // Use GPS location
        navigator.geolocation.getCurrentPosition(
          function(position) {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            const distance = haversineDistance(userLat, userLon, deviceLat, deviceLon);
            
            if (distance < 200) {
              handleSecondaryDeviceProximitySuccess("GPS");
            } else {
              handleSecondaryDeviceProximityFailure(distance, "GPS");
            }
          },
          function(error) {
            console.log("GPS error, showing manual location options...");
            showSecondaryDeviceManualLocationOverride(deviceLat, deviceLon);
          },
          { 
            enableHighAccuracy: true, 
            timeout: 15000, 
            maximumAge: 60000 
          }
        );
      }

    } catch (error) {
      console.error("Error in secondary device proximity check:", error);
      scheduleNextSecondaryCheck();
    }
  }

  // Handle successful secondary device proximity check
  function handleSecondaryDeviceProximitySuccess(method) {
    console.log(`Secondary device proximity check successful via ${method}`);
    
    const testModeIndicator = method === "Test Mode" ? 
      '<div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">🧪 <strong>Test Mode Active:</strong> Using custom coordinates for secondary device proximity check</div>' : '';
    
    installStatus.innerHTML = `
      <div style="color: #059669; margin-bottom: 20px;">
        <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">✅ Secondary Device Location Check Passed!</div>
        <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
          You are within 200 meters of the secondary device. Completing secondary device setup...
        </div>
        ${testModeIndicator}
      </div>
    `;
    
    setTimeout(() => {
      console.log("Secondary device location verified, completing workflow...");
      
      // Update sidebar: Secondary device workflow completed
      updateStepStatus(4, 'completed'); // This represents the secondary device completion
      
      // Complete secondary device workflow directly without form
      completeSecondaryDeviceWorkflow(false); // false = not skipped
    }, 1000);
  }

  // Handle secondary device proximity check failure
  function handleSecondaryDeviceProximityFailure(distance, method) {
    consecutiveLocationFailures++;
    console.log(`Secondary device proximity check failed via ${method}. Distance: ${distance.toFixed(0)}m. Failures: ${consecutiveLocationFailures}`);
    
    if (consecutiveLocationFailures >= MAX_CONSECUTIVE_FAILURES) {
      // Too many consecutive failures, show manual options
      installStatus.innerHTML = `
        <div style="color: #dc2626; margin-bottom: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">📍 Secondary Device Location Mismatch Detected</div>
          <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
            Secondary device location: ${distance.toFixed(0)}m away from your position.<br>
            This could be due to:
          </div>
          <ul style="font-size: 0.95rem; margin-bottom: 16px; padding-left: 24px; line-height: 1.6;">
            <li>Secondary device reporting its last known location (not current)</li>
            <li>GPS accuracy issues on either device</li>
            <li>Secondary device not yet moved to installation location</li>
          </ul>
        </div>
        <div class="info-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; margin-bottom: 16px; color: #92400e;">
          <strong>Options:</strong>
          <div style="margin-top: 12px;">
            <button id="continueSecondaryPollingBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); margin-right: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔄 Continue Waiting</button>
            <button id="skipSecondaryDeviceBtn" type="button" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); margin-left: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);">⏭️ Skip Secondary Device</button>
          </div>
        </div>
      `;

      // Add event listeners
      document.getElementById("continueSecondaryPollingBtn").addEventListener("click", () => {
        consecutiveLocationFailures = 0; // Reset counter
        scheduleNextSecondaryCheck();
      });

      document.getElementById("skipSecondaryDeviceBtn").addEventListener("click", () => {
        // Skip secondary device and proceed to final confirmation
        completeSecondaryDeviceWorkflow(true); // true = skipped
      });

    } else {
      // Just continue polling, but show the issue
      installStatus.innerHTML = `
        <div style="color: #d97706; margin-bottom: 20px;">
          <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">⚠️ Secondary Device Location Mismatch (${consecutiveLocationFailures}/${MAX_CONSECUTIVE_FAILURES})</div>
          <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
            Secondary device is ${distance.toFixed(0)}m away. This might be stale location data.<br>
            Continuing to monitor for updated location...
          </div>
        </div>
        <button id="stopSecondaryPollingBtn" type="button" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); margin-top: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">🛑 Stop Waiting</button>
        <button id="forceSecondaryLocationCheckBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); margin-left: 12px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(134, 43, 171, 0.3);">🔍 Check Now</button>
      `;

      // Add event listeners
      document.getElementById("stopSecondaryPollingBtn").addEventListener("click", () => {
        window.stopSecondaryPolling = true;
        installStatus.innerHTML = "🛑 Stopped waiting for secondary device. You can restart the installation process.";
      });

      document.getElementById("forceSecondaryLocationCheckBtn").addEventListener("click", () => {
        currentInterval = 1000; // Check in 1 second
        checkSecondaryStatus();
      });

      scheduleNextSecondaryCheck();
    }
  }

  // Schedule the next secondary device check with progressive backoff
  function scheduleNextSecondaryCheck() {
    if (window.stopSecondaryPolling) return;
    
    // Increase interval progressively, but cap it
    currentInterval = Math.min(currentInterval * BACKOFF_MULTIPLIER, MAX_INTERVAL);
    
    console.log(`Scheduling next secondary device check in ${Math.ceil(currentInterval/1000)}s`);
    setTimeout(checkSecondaryStatus, currentInterval);
  }

  // Start the first secondary device check
  checkSecondaryStatus();
}
*/

// Complete secondary device workflow and proceed to final confirmation
function completeSecondaryDeviceWorkflow(skipped) {
  if (skipped) {
    console.log("Secondary device installation skipped");
    installStatus.innerHTML = `
      <div style="color: #d97706; margin-bottom: 20px;">
        <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">⏭️ Secondary Device Installation Skipped</div>
        <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
          The secondary device installation has been skipped.<br>
          Proceeding to final confirmation for primary device only.
        </div>
      </div>
    `;
  } else {
    console.log("Secondary device installation completed");
    installStatus.innerHTML = `
      <div style="color: #059669; margin-bottom: 20px;">
        <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">✅ Secondary Device Installation Completed</div>
        <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
          The secondary device installation has been completed successfully.<br>
          Both primary and secondary devices are now installed.
        </div>
      </div>
    `;
  }
  
  // Wait a moment then proceed to final confirmation
  setTimeout(() => {
    // Update sidebar: Step 5 completed, unlock Step 6
    updateStepStatus(5, 'completed');
    unlockNextStep(5);
    
    showConfirmationStep();
  }, 2000);
}
