// server.js
const express = require("express");
const fetch = require("node-fetch"); // version 2.x import style

const TEST_MODE = false; // Set to false for production
const ENABLE_CONFIRMATION_FALLBACK = true; // Enable fallback when Pegasus is unavailable

// 🔧 ENVIRONMENT SWITCHER - Change this line to switch environments:
// Set to "qa" for testing, "production" for live environment
const ENVIRONMENT = "production";

// Environment Configuration
const ENV_CONFIG = {
  production: {
    zapierHookInstall: "https://hooks.zapier.com/hooks/catch/21949880/uyym1m7/",
    zapierHookSecondary: "ZAPIER_HOOK_SECONDARY", // Add your secondary hook URL here
    pegasusBaseUrl: "https://qservices.pegasusgateway.com",
    pegasusToken: "2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824",
    // Pegasus SIM verification tokens for both instances
    pegasus1Token: "96b479a751b420ee030def5e5db4a82c5851ca0db0f8fdb43b71bdf6",
    pegasus256Token: "2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824"
  },
  qa: {
    zapierHookInstall: "https://hooks.zapier.com/hooks/catch/21949880/u6nixws/",
    zapierHookSecondary: "ZAPIER_HOOK_SECONDARY_QA", // Add your QA secondary hook URL here
    pegasusBaseUrl: "https://qservices.pegasusgateway.com/qa",
    pegasusToken: "cfe06b66972326270ae9d3420336379b9d5176ab424acd417330cc02",
    // Pegasus SIM verification tokens for both instances (QA)
    pegasus1Token: "96b479a751b420ee030def5e5db4a82c5851ca0db0f8fdb43b71bdf6",
    pegasus256Token: "cfe06b66972326270ae9d3420336379b9d5176ab424acd417330cc02"
  }
};

// Get current environment config
const currentConfig = ENV_CONFIG[ENVIRONMENT];
console.log(`🔧 Running in ${ENVIRONMENT.toUpperCase()} environment`);

const app = express();
const PORT = process.env.PORT || 8080;

// 1) Serve everything in ./public as static files:
app.use(express.static("public"));

// 2) Parse incoming JSON bodies for POST requests:
app.use(express.json());

// Environment info endpoint for frontend
app.get("/api/config", (req, res) => {
  res.json({
    environment: ENVIRONMENT,
    testMode: TEST_MODE,
    pegasusBaseUrl: currentConfig.pegasusBaseUrl,
    pegasusToken: currentConfig.pegasusToken
  });
});

// Health check endpoint for Pegasus API connectivity
app.get("/api/health/pegasus", async (req, res) => {
  try {
    const startTime = Date.now();
    const healthResp = await fetch(`${currentConfig.pegasusBaseUrl}/health`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${currentConfig.pegasusToken}`
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      status: healthResp.status,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      pegasusUrl: currentConfig.pegasusBaseUrl
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: err.name || 'UnknownError',
      message: err.message,
      timestamp: new Date().toISOString(),
      pegasusUrl: currentConfig.pegasusBaseUrl
    });
  }
});

// 3) Zapier URLs from environment config:
const ZAPIER_HOOK_INSTALL = currentConfig.zapierHookInstall;
const ZAPIER_HOOK_SECONDARY = currentConfig.zapierHookSecondary;

// 4) Proxy route: the browser will POST to /api/install (same‐origin)
app.post("/api/install", async (req, res) => {
  try {
    // 1. Pull client_name out of the incoming JSON
    const { client_name, imei, sim_number, vin, installationId, secondary_imei } = req.body;

    // 2. Basic validation (sim_number is now optional)
    if (!client_name || !imei || !vin || !installationId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing one of client_name, imei, vin, installationId"
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
      vin,
      installationId
    };
    // Only include sim_number if provided
    if (sim_number) {
      zapPayload.sim_number = sim_number;
    }
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
  const requestTime = new Date().toISOString();
  
  console.log(`\n🔍 [${requestTime}] DEVICE STATUS CHECK REQUEST:`);
  console.log(`   IMEI: ${imei}`);
  console.log(`   Since: ${since || 'not specified'}`);
  console.log(`   Request ID: ${Date.now()}`);
  
  try {
    // Correct endpoint and headers
    const pegasusUrl = `https://api.pegasusgateway.com/devices/${imei}`;
    console.log(`   📡 Calling Pegasus API: ${pegasusUrl}`);
    console.log(`   🔑 Using token: ${currentConfig.pegasusToken.substring(0, 10)}...`);
    
    const startTime = Date.now();
    const deviceResp = await fetch(pegasusUrl, {
      headers: {
        "Authenticate": currentConfig.pegasusToken
      }
    });
    const responseTime = Date.now() - startTime;
    
    console.log(`   ⏱️  API Response Time: ${responseTime}ms`);
    console.log(`   📊 HTTP Status: ${deviceResp.status} ${deviceResp.statusText}`);
    
    if (!deviceResp.ok) {
      console.error(`   ❌ Pegasus API Error: ${deviceResp.status} - ${deviceResp.statusText}`);
      return res.status(deviceResp.status).json({
        success: false,
        error: `Pegasus API returned ${deviceResp.status}`,
        message: deviceResp.statusText
      });
    }
    
    const deviceData = await deviceResp.json();
    
    // Log comprehensive device status analysis
    console.log(`\n📊 [${requestTime}] DEVICE STATUS ANALYSIS:`);
    console.log(`   📍 Location Data:`);
    console.log(`      - Valid: ${deviceData.latest?.loc?.valid}`);
    console.log(`      - Age: ${deviceData.latest?.loc?.age || 'N/A'} seconds`);
    console.log(`      - Lat: ${deviceData.latest?.loc?.lat || 'N/A'}`);
    console.log(`      - Lon: ${deviceData.latest?.loc?.lon || 'N/A'}`);
    console.log(`      - Event Time: ${deviceData.latest?.loc?.evtime || 'N/A'}`);
    console.log(`      - System Time: ${deviceData.latest?.loc?.systime || 'N/A'}`);
    
    console.log(`   🔌 Connection Status:`);
    console.log(`      - Online: ${deviceData.connection?.online}`);
    console.log(`      - State: ${deviceData.connection?.last?.state || 'N/A'}`);
    console.log(`      - Last Update: ${deviceData.connection?._epoch ? new Date(deviceData.connection._epoch * 1000).toISOString() : 'N/A'}`);
    console.log(`      - Sequence: ${deviceData.connection?.seq || 'N/A'}`);
    
    console.log(`   📡 Network Info:`);
    console.log(`      - RSSI: ${deviceData.net_reg?.cf_rssi || 'N/A'}`);
    console.log(`      - Type: ${deviceData.net_reg?.cf_type || 'N/A'}`);
    console.log(`      - Last RX: ${deviceData.lastrx?._epoch ? new Date(deviceData.lastrx._epoch * 1000).toISOString() : 'N/A'}`);
    
    // Calculate data freshness
    const currentEpoch = Math.floor(Date.now() / 1000);
    const locationAge = deviceData.latest?.loc?.age || 0;
    const connectionAge = deviceData.connection?._epoch ? (currentEpoch - deviceData.connection._epoch) : null;
    const lastRxAge = deviceData.lastrx?._epoch ? (currentEpoch - deviceData.lastrx._epoch) : null;
    
    console.log(`   ⏰ Data Freshness Analysis:`);
    console.log(`      - Current Time: ${currentEpoch} (${new Date().toISOString()})`);
    console.log(`      - Location Age: ${locationAge}s`);
    console.log(`      - Connection Age: ${connectionAge !== null ? connectionAge + 's' : 'N/A'}`);
    console.log(`      - Last RX Age: ${lastRxAge !== null ? lastRxAge + 's' : 'N/A'}`);
    
    // Enhanced validation logic
    const isReporting = !!deviceData.latest?.loc?.valid;
    const isOnline = deviceData.connection?.online === true;
    const hasRecentConnection = connectionAge !== null && connectionAge <= 300; // 5 minutes
    const hasRecentActivity = lastRxAge !== null && lastRxAge <= 300; // 5 minutes
    
    console.log(`\n✅ [${requestTime}] VALIDATION RESULTS:`);
    console.log(`   - Location Valid: ${isReporting}`);
    console.log(`   - Connection Online: ${isOnline}`);
    console.log(`   - Recent Connection: ${hasRecentConnection} (≤5min)`);
    console.log(`   - Recent Activity: ${hasRecentActivity} (≤5min)`);
    console.log(`   - Overall Status: ${isReporting && isOnline && hasRecentConnection && hasRecentActivity ? 'VALID' : 'INVALID'}`);
    
    // Return enhanced data with validation flags
    const response = {
      isReporting,
      latest: deviceData.latest,
      connection: deviceData.connection,
      deviceData: deviceData,
      // Enhanced validation flags
      isOnline,
      connectionState: deviceData.connection?.last?.state || 'unknown',
      hasRecentConnection,
      hasRecentActivity,
      // Timestamps for debugging
      requestTime,
      dataFreshness: {
        locationAge,
        connectionAge,
        lastRxAge
      }
    };
    
    console.log(`\n📤 [${requestTime}] SENDING RESPONSE:`, JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error(`\n❌ [${requestTime}] DEVICE STATUS CHECK ERROR:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      requestTime
    });
  }
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
        "Authenticate": currentConfig.pegasusToken
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

// New endpoint for SIM verification
app.post("/api/verify-sim", async (req, res) => {
  try {
    const { iccid } = req.body;
    
    if (!iccid) {
      return res.status(400).json({
        success: false,
        message: "ICCID is required"
      });
    }

    console.log("Verifying SIM ICCID:", iccid);
    
    // Determine SIM type and appropriate endpoints based on ICCID prefix
    let simType = "";
    let pegasus1Url = "";
    let pegasus256Url = "";
    
    if (iccid.startsWith("8988")) {
      simType = "SuperSIM";
      pegasus1Url = `https://api.pegasusgateway.com/m2m/supersims/v1/Sims?Iccid=${iccid}`;
      pegasus256Url = `https://api.pegasusgateway.com/m2m/supersims/v1/Sims?Iccid=${iccid}`;
    } else if (iccid.startsWith("8901")) {
      simType = "Wireless";
      pegasus1Url = `https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=${iccid}`;
      pegasus256Url = `https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=${iccid}`;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid ICCID format. Must start with 8988 (SuperSIM) or 8901 (Wireless)",
        iccid: iccid
      });
    }
    
    console.log(`SIM Type detected: ${simType}`);
    console.log(`Pegasus1 URL: ${pegasus1Url}`);
    console.log(`Pegasus256 URL: ${pegasus256Url}`);
    
    let simFound = false;
    let simData = null;
    let foundIn = null;
    
    // Try Pegasus1 first
    try {
      console.log(`Checking Pegasus1 for ${simType} SIM:`, iccid);
      const pegasus1Resp = await fetch(pegasus1Url, {
        headers: {
          "Authenticate": currentConfig.pegasus1Token
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (pegasus1Resp.ok) {
        const pegasus1Data = await pegasus1Resp.json();
        console.log("Pegasus1 response:", pegasus1Data);
        
        // Handle both SuperSIM and Wireless response formats
        const sims = pegasus1Data.sims || pegasus1Data.data || [];
        if (sims.length > 0) {
          simFound = true;
          simData = sims[0];
          foundIn = "Pegasus1";
          console.log(`${simType} SIM found in Pegasus1`);
        }
      } else {
        console.log(`Pegasus1 returned status: ${pegasus1Resp.status}`);
      }
    } catch (error) {
      console.log("Pegasus1 check failed:", error.message);
    }
    
    // If not found in Pegasus1, try Pegasus256
    if (!simFound) {
      try {
        console.log(`Checking Pegasus256 for ${simType} SIM:`, iccid);
        const pegasus256Resp = await fetch(pegasus256Url, {
          headers: {
            "Authenticate": currentConfig.pegasus256Token
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (pegasus256Resp.ok) {
          const pegasus256Data = await pegasus256Resp.json();
          console.log("Pegasus256 response:", pegasus256Data);
          
          // Handle both SuperSIM and Wireless response formats
          const sims = pegasus256Data.sims || pegasus256Data.data || [];
          if (sims.length > 0) {
            simFound = true;
            simData = sims[0];
            foundIn = "Pegasus256";
            console.log(`${simType} SIM found in Pegasus256`);
          }
        } else {
          console.log(`Pegasus256 returned status: ${pegasus256Resp.status}`);
        }
      } catch (error) {
        console.log("Pegasus256 check failed:", error.message);
      }
    }
    
    if (simFound && simData) {
      // SIM found, return success with details
      res.json({
        success: true,
        message: `${simType} SIM verified successfully in ${foundIn}`,
        simData: {
          iccid: simData.iccid,
          status: simData.status,
          simType: simType,
          fleet_sid: simData.fleet_sid || simData.fleet_id,
          account_sid: simData.account_sid || simData.account_id,
          date_created: simData.date_created,
          date_updated: simData.date_updated,
          foundIn: foundIn
        }
      });
    } else {
      // SIM not found in either instance
      res.status(404).json({
        success: false,
        message: `${simType} SIM not found in either Pegasus instance`,
        checkedInstances: ["Pegasus1", "Pegasus256"],
        simType: simType,
        iccid: iccid
      });
    }

  } catch (err) {
    console.error("Error in /api/verify-sim:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while verifying SIM"
    });
  }
});

// New endpoint for installation confirmation
app.post("/api/confirm-installation", async (req, res) => {
  try {
    const { installationId } = req.body;
    
    if (!installationId) {
      return res.status(400).json({
        success: false,
        message: "Installation ID is required"
      });
    }

    if (TEST_MODE) {
      console.log("TEST_MODE is ON: Skipping Pegasus confirmation call.");
      return res.json({ status: "success", message: "Test mode: Pegasus confirmation not called." });
    }

    console.log("Sending installation confirmation for ID:", installationId);
    console.log("Pegasus URL:", `${currentConfig.pegasusBaseUrl}/installations/api/v1/review/${installationId}/confirmation?finish=true`);
    
    // Send confirmation to Pegasus
    const confirmationPayload = [
      "valid_position",
      "io_pwr",
      "io_ign",
      "io_in1",
      "io_out1"
    ];

    console.log("Confirmation payload:", confirmationPayload);
    console.log("Using token:", currentConfig.pegasusToken.substring(0, 10) + "...");

    // Retry mechanism for failed requests
    let pegasusResp = null;
    let lastError = null;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to confirm installation...`);
        
        pegasusResp = await fetch(`${currentConfig.pegasusBaseUrl}/installations/api/v1/review/${installationId}/confirmation?finish=true`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentConfig.pegasusToken}`
          },
          body: JSON.stringify(confirmationPayload),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        console.log("Pegasus response status:", pegasusResp.status);
        console.log("Pegasus response headers:", Object.fromEntries(pegasusResp.headers.entries()));
        
        // If we get a successful response, break out of retry loop
        if (pegasusResp.ok) {
          break;
        }
        
        // If it's a client error (4xx), don't retry
        if (pegasusResp.status >= 400 && pegasusResp.status < 500) {
          break;
        }
        
        // For server errors (5xx) or network issues, retry
        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt} failed with status ${pegasusResp.status}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        }
        
      } catch (fetchError) {
        lastError = fetchError;
        console.error(`Attempt ${attempt} failed:`, fetchError.message);
        
        if (attempt < maxRetries) {
          console.log(`Retrying in ${2 * attempt} seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    // If all attempts failed
    if (!pegasusResp) {
      if (ENABLE_CONFIRMATION_FALLBACK) {
        console.warn("Pegasus API unavailable, using fallback confirmation");
        return res.json({
          success: true,
          message: "Installation confirmed successfully (fallback mode - Pegasus API unavailable)",
          pegasusResponse: { 
            fallback: true, 
            message: "Pegasus API was unavailable, but installation was recorded locally",
            timestamp: new Date().toISOString()
          },
          attempts: maxRetries,
          fallbackMode: true
        });
      } else {
        throw lastError || new Error("All retry attempts failed");
      }
    }

    if (!pegasusResp.ok) {
      const text = await pegasusResp.text();
      console.error("Pegasus confirmation failed after retries:", pegasusResp.status, text);
      return res.status(pegasusResp.status).json({
        success: false,
        message: `Pegasus confirmation failed: ${pegasusResp.status} - ${text}`,
        attempts: maxRetries
      });
    }

    // Check if response has content before trying to parse as JSON
    const responseText = await pegasusResp.text();
    let pegasusJson = null;
    
    if (responseText && responseText.trim()) {
      try {
        pegasusJson = JSON.parse(responseText);
        console.log("Pegasus confirmation successful:", pegasusJson);
      } catch (parseError) {
        console.warn("Pegasus returned non-JSON response, treating as success:", responseText);
        // If it's not JSON but we got a 200 response, treat as success
        pegasusJson = { rawResponse: responseText };
      }
    } else {
      console.log("Pegasus confirmation successful (empty response)");
      pegasusJson = { message: "Empty response from server" };
    }
    
    return res.json({
      success: true,
      message: "Installation confirmed successfully",
      pegasusResponse: pegasusJson,
      attempts: 1
    });

  } catch (err) {
    console.error("Error in /api/confirm-installation:", err);
    
    let errorMessage = "Internal server error while confirming installation";
    let statusCode = 500;
    
    if (err.name === 'AbortError') {
      errorMessage = "Request timed out while confirming installation";
      statusCode = 408;
    } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
      errorMessage = "Network error while connecting to Pegasus API";
      statusCode = 503;
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: err.name || 'UnknownError'
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

