// Wizard: manual location overrides + test-mode device coords + permission prompt
// Show manual location override for primary device
function showManualLocationOverride(deviceLat, deviceLon) {
  installStatus.innerHTML = `
    <div style="color: #d97706; margin-bottom: 20px;">
      <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">📍 Manual Location Entry Required</div>
      <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
        GPS location could not be determined automatically.<br>
        <strong>Device Location:</strong> ${deviceLat}, ${deviceLon}<br>
        Please enter your current coordinates manually.
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
      <div>
        <label for="manualLatInput" style="font-size: 0.9rem; color: #92400e; font-weight: 600;">Your Latitude:</label>
        <input type="number" id="manualLatInput" placeholder="e.g., 25.78395" step="0.00001" style="font-size: 0.9rem; padding: 10px 12px; border: 2px solid #f59e0b; border-radius: 8px; background: #fff;" />
      </div>
      <div>
        <label for="manualLonInput" style="font-size: 0.9rem; color: #92400e; font-weight: 600;">Your Longitude:</label>
        <input type="number" id="manualLonInput" placeholder="e.g., -100.26345" step="0.00001" style="font-size: 0.9rem; padding: 10px 12px; border: 2px solid #f59e0b; border-radius: 8px; background: #fff;" />
      </div>
    </div>
    <button id="checkManualProximityBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 0.9rem; cursor: pointer; font-weight: 600; box-shadow: 0 2px 6px rgba(134, 43, 171, 0.3);">
      🔍 Check Proximity
    </button>
  `;
  
  // Add event listener for manual proximity check
  document.getElementById("checkManualProximityBtn").addEventListener("click", function() {
    const manualLat = parseFloat(document.getElementById("manualLatInput").value);
    const manualLon = parseFloat(document.getElementById("manualLonInput").value);
    
    if (isNaN(manualLat) || isNaN(manualLon)) {
      alert("Please enter valid latitude and longitude values.");
      return;
    }
    
    const distance = calculateDistance(manualLat, manualLon, deviceLat, deviceLon);
    console.log(`🔍 Manual proximity check: ${distance.toFixed(2)}m`);
    
    if (distance <= 200) {
      console.log("🔍 Manual proximity check SUCCESS");
      handleProximitySuccess("Manual");
    } else {
      console.log("🔍 Manual proximity check FAILED - too far");
      handleProximityFailure(distance, "Manual");
    }
  });
}

// Show manual location override for secondary device
function showSecondaryDeviceManualLocationOverride(deviceLat, deviceLon) {
  installStatus.innerHTML = `
    <div style="color: #d97706; margin-bottom: 20px;">
      <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;">📍 Manual Location Entry Required</div>
      <div style="font-size: 0.95rem; margin-bottom: 16px; line-height: 1.5;">
        GPS location could not be determined automatically.<br>
        <strong>Secondary Device Location:</strong> ${deviceLat}, ${deviceLon}<br>
        Please enter your current coordinates manually.
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
      <div>
        <label for="manualLatInput" style="font-size: 0.9rem; color: #92400e; font-weight: 600;">Your Latitude:</label>
        <input type="number" id="manualLatInput" placeholder="e.g., 25.78395" step="0.00001" style="font-size: 0.9rem; padding: 10px 12px; border: 2px solid #f59e0b; border-radius: 8px; background: #fff;" />
      </div>
      <div>
        <label for="manualLonInput" style="font-size: 0.9rem; color: #92400e; font-weight: 600;">Your Longitude:</label>
        <input type="number" id="manualLonInput" placeholder="e.g., -100.26345" step="0.00001" style="font-size: 0.9rem; padding: 10px 12px; border: 2px solid #f59e0b; border-radius: 8px; background: #fff;" />
      </div>
    </div>
    <button id="checkManualProximityBtn" type="button" style="background: linear-gradient(135deg, #862BAB 0%, #6B21A8 100%); color: white; border: none; border-radius: 6px; padding: 8px 16px; font-size: 0.9rem; cursor: pointer; font-weight: 600; box-shadow: 0 2px 6px rgba(134, 43, 171, 0.3);">
      🔍 Check Proximity
    </button>
  `;
  
  // Add event listener for manual proximity check
  document.getElementById("checkManualProximityBtn").addEventListener("click", function() {
    const manualLat = parseFloat(document.getElementById("manualLatInput").value);
    const manualLon = parseFloat(document.getElementById("manualLonInput").value);
    
    if (isNaN(manualLat) || isNaN(manualLon)) {
      alert("Please enter valid coordinates");
      return;
    }
    
    const distance = haversineDistance(manualLat, manualLon, deviceLat, deviceLon);
    console.log(`Manual coordinates: ${manualLat}, ${manualLon}`);
    console.log(`Secondary device coordinates: ${deviceLat}, ${deviceLon}`);
    console.log(`Calculated distance: ${distance.toFixed(2)}m`);
    
    if (distance < 200) {
      handleSecondaryDeviceProximitySuccess("Manual Entry");
    } else {
      handleSecondaryDeviceProximityFailure(distance, "Manual Entry");
    }
  });
}

// Update device location display for test mode
function updateDeviceLocationDisplay() {
  const inst = JSON.parse(sessionStorage.getItem("selectedInstallation") || "{}");
  const deviceLat = inst.vehiculo?.latest?.loc?.lat;
  const deviceLon = inst.vehiculo?.latest?.loc?.lon;
  
  const displayElement = document.getElementById("deviceLocationDisplay");
  if (displayElement && deviceLat && deviceLon) {
    displayElement.innerHTML = `${deviceLat.toFixed(5)}, ${deviceLon.toFixed(5)}`;
    
    // Auto-populate test coordinates with device location for easy testing
    const testLatInput = document.getElementById("testLatInput");
    const testLonInput = document.getElementById("testLonInput");
    if (testLatInput) testLatInput.value = deviceLat.toFixed(5);
    if (testLonInput) testLonInput.value = deviceLon.toFixed(5);
  } else if (displayElement) {
    displayElement.innerHTML = "Device location not available yet";
  }
}

// Request location permission proactively
function requestLocationPermission() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    function(position) {
      alert("✅ Location permission granted! Your coordinates: " + 
            position.coords.latitude.toFixed(6) + ", " + 
            position.coords.longitude.toFixed(6));
    },
    function(error) {
      let errorMsg = "";
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = "Location permission denied. Please:\n1. Click the location icon in your browser's address bar\n2. Select 'Allow' for location access\n3. Refresh the page";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = "Location information unavailable. Please check your device's location services.";
          break;
        case error.TIMEOUT:
          errorMsg = "Location request timed out. Please try again.";
          break;
        default:
          errorMsg = "Location error: " + error.message;
      }
      alert("❌ " + errorMsg);
    },
    { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 60000 
    }
  );
}
