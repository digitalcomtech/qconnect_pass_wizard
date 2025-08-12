// server.js
const express = require("express");
const fetch = require("node-fetch"); // version 2.x import style

const TEST_MODE = false; // Set to false for production

const app = express();
const PORT = process.env.PORT || 8080;

// 1) Serve everything in ./public as static files:
app.use(express.static("public"));

// 2) Parse incoming JSON bodies for POST requests:
app.use(express.json());

// 3) Your Zapier "Catch Hook" URL (no trailing slash):
const ZAPIER_HOOK_INSTALL = "https://hooks.zapier.com/hooks/catch/21949880/uyym1m7/";

// 4) Proxy route: the browser will POST to /api/install (same‐origin)
app.post("/api/install", async (req, res) => {
  try {
    // 1. Pull client_name out of the incoming JSON
    const { client_name, imei, sim_number, vin, installationId, secondary_imei } = req.body;

    // 2. Basic validation (now including client_name)
    if (!client_name || !imei || !sim_number || !vin || !installationId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing one of client_name, imei, sim_number, vin, installationId"
      });
    }

    if (TEST_MODE) {
      console.log("TEST_MODE is ON: Skipping Zapier call.");
      return res.json({ status: "success", message: "Test mode: Zapier not called." });
    }

    // 3. Build the payload including client_name
    const zapPayload = {
      client_name,
      imei,
      sim_number,
      vin,
      installationId
    };
    if (secondary_imei) {
      zapPayload.secondary_imei = secondary_imei;
    }

    // 4. Forward the JSON payload server‐to‐server to Zapier
    const zapResp = await fetch(ZAPIER_HOOK_INSTALL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zapPayload)
    });

    // 5. If Zapier returns a non‐200, forward that error
    if (!zapResp.ok) {
      const text = await zapResp.text();
      return res.status(zapResp.status).json({
        success: false,
        message: `Zapier returned ${zapResp.status}: ${text}`
      });
    }

    // 6. Otherwise parse Zapier's response JSON and send it back to the browser
    const zapJson = await zapResp.json();
    return res.json(zapJson);
  } catch (err) {
    console.error("Error in /api/install:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while forwarding to Zapier"
    });
  }
});

// 4b) Proxy route: the browser will POST to /api/secondary-install (same-origin)
app.post("/api/secondary-install", async (req, res) => {
  try {
    const { client_name, secondary_imei, vin, installationId } = req.body;
    if (!client_name || !secondary_imei || !vin || !installationId) {
      return res.status(400).json({
        success: false,
        message: "Missing one of client_name, secondary_imei, vin, installationId"
      });
    }
    if (TEST_MODE) {
      console.log("TEST_MODE is ON: Skipping Zapier call for secondary unit.");
      return res.json({ status: "success", message: "Test mode: Secondary Zapier not called." });
    }
    const zapPayload = { client_name, secondary_imei, vin, installationId };
    const zapResp = await fetch(ZAPIER_HOOK_SECONDARY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zapPayload)
    });
    if (!zapResp.ok) {
      const text = await zapResp.text();
      return res.status(zapResp.status).json({
        success: false,
        message: `Zapier (secondary) returned ${zapResp.status}: ${text}`
      });
    }
    const zapJson = await zapResp.json();
    return res.json(zapJson);
  } catch (err) {
    console.error("Error in /api/secondary-install:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while forwarding to Zapier (secondary)"
    });
  }
});

app.get("/api/device-status", async (req, res) => {
  const { imei, since } = req.query;
  console.log("Checking device status for IMEI:", imei);
  // Correct endpoint and headers
  const deviceResp = await fetch(`https://api.pegasusgateway.com/devices/${imei}`, {
    headers: {
      "Authenticate": "2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824"
    }
  });
  const deviceData = await deviceResp.json();
  console.log("Platform response:", deviceData);
  const isReporting = !!deviceData.latest?.loc?.valid;
  res.json({ isReporting, latest: deviceData.latest });
});

// New endpoint for IMEI verification
app.post("/api/verify-imei", async (req, res) => {
  try {
    const { imei } = req.body;
    
    if (!imei) {
      return res.status(400).json({
        success: false,
        message: "IMEI is required"
      });
    }

    console.log("Verifying IMEI:", imei);
    
    // Call Pegasus devices API to verify the IMEI
    const deviceResp = await fetch(`https://api.pegasusgateway.com/devices/${imei}`, {
      headers: {
        "Authenticate": "2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824"
      }
    });

    if (!deviceResp.ok) {
      if (deviceResp.status === 404) {
        return res.status(404).json({
          success: false,
          message: "Device not found - IMEI does not exist in the system"
        });
      }
      return res.status(deviceResp.status).json({
        success: false,
        message: `Pegasus API error: ${deviceResp.status}`
      });
    }

    const deviceData = await deviceResp.json();
    console.log("Device verification response:", deviceData);

    // Check if device exists and analyze its state
    if (!deviceData.imei) {
      return res.status(400).json({
        success: false,
        message: "Invalid device data received from Pegasus"
      });
    }

    // Check if device is in the correct state (unlinked or before first link)
    const hasVehicle = deviceData.vehicle && Object.keys(deviceData.vehicle).length > 0;
    const vehicleHasDetails = hasVehicle && deviceData.vehicle.name && deviceData.vehicle.id;
    
    // Device is acceptable if:
    // 1. No vehicle object at all (before link)
    // 2. Vehicle object exists but only has _epoch (after unlink)
    const isAcceptable = !hasVehicle || (hasVehicle && !vehicleHasDetails);

    if (!isAcceptable) {
      return res.status(400).json({
        success: false,
        message: "Device is already linked to a vehicle and cannot be used for installation",
        deviceState: "linked",
        vehicleName: deviceData.vehicle?.name,
        vehicleId: deviceData.vehicle?.id
      });
    }

    // Device is acceptable
    res.json({
      success: true,
      message: "IMEI verified successfully",
      deviceState: hasVehicle ? "unlinked" : "never_linked",
      deviceData: deviceData
    });

  } catch (err) {
    console.error("Error in /api/verify-imei:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while verifying IMEI"
    });
  }
});

// 5) Start the server
app.listen(PORT, () => {
  console.log(`Express proxy running at http://localhost:${PORT}`);
});

function haversineDistance(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371e3; // meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in meters
}

function checkProximityToDevice(userLat, userLon) {
  // Get device location from your backend or sessionStorage
  const inst = JSON.parse(sessionStorage.getItem("selectedInstallation") || "{}");
  const deviceLat = inst.vehiculo?.latest?.loc?.lat;
  const deviceLon = inst.vehiculo?.latest?.loc?.lon;

  if (deviceLat == null || deviceLon == null) {
    alert("Device location not available.");
    return;
  }

  const distance = haversineDistance(userLat, userLon, deviceLat, deviceLon);
  if (distance < 200) { // 200 meters threshold
    // Allow next step
    alert("You are close to the device. Proceed!");
    // ...show closing form or continue...
  } else {
    alert("You are too far from the device location to proceed.");
  }
}

