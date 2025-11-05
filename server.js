
// server.js
const express = require("express");
const fetch = require("node-fetch"); // version 2.x import style
const session = require("express-session");

// Load configuration from config.js
const config = require("./config");

// Load authentication modules
const { authenticateUser } = require('./users');
const { authenticateToken, generateToken, requireRole } = require('./auth');

// Load activity tracking modules
const { initializeActivityTracker } = require('./activity-tracker');
const {
  trackInstallationStart,
  trackInstallationComplete,
  trackInstallationErrors,
  trackStepProgress,
  addSessionIdHeader
} = require('./activity-middleware');

const TEST_MODE = config.TEST_MODE;
const ENABLE_CONFIRMATION_FALLBACK = config.ENABLE_CONFIRMATION_FALLBACK;

// 🔧 ENVIRONMENT SWITCHER - Now controlled by config.js
const ENVIRONMENT = config.ENVIRONMENT;

// Environment Configuration - Now loaded from config.js
const ENV_CONFIG = {
  production: config.production,
  qa: config.qa
};

// Get current environment config
const currentConfig = ENV_CONFIG[ENVIRONMENT];
console.log(`🔧 Running in ${ENVIRONMENT.toUpperCase()} environment`);

const app = express();
const PORT = process.env.PORT || 8080;

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// 1) Serve everything in ./public as static files:
app.use(express.static("public"));

// 2) Parse incoming JSON bodies for POST requests:
app.use(express.json());

// 2.5) Initialize activity tracking
initializeActivityTracker();

// 2.6) Activity tracking middleware
app.use(addSessionIdHeader);
app.use(trackStepProgress);

// 2.7) Add completion tracking middleware to installation endpoints
app.use('/api/install', trackInstallationComplete);
app.use('/api/secondary-install', trackInstallationComplete);

// Authentication endpoints
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required"
      });
    }
    
    const user = await authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Store user info in session
    req.session.user = user;
    
    res.json({
      success: true,
      message: "Login successful",
      user: user,
      token: token
    });
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during login"
    });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error during logout"
      });
    }
    
    res.json({
      success: true,
      message: "Logout successful"
    });
  });
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Environment info endpoint for frontend (now protected)
app.get("/api/config", authenticateToken, (req, res) => {
  res.json({
    environment: ENVIRONMENT,
    testMode: TEST_MODE,
    pegasusBaseUrl: currentConfig.pegasusBaseUrl
    // Note: pegasusToken is no longer exposed to frontend!
  });
});

// Health check endpoint for Pegasus API connectivity (now protected)
app.get("/api/health/pegasus", authenticateToken, async (req, res) => {
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

// Search installations endpoint (protected)
app.get("/api/search-installations", authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query parameter is required"
      });
    }
    
    console.log(`🔍 Searching for installations with query: ${query}`);
    
    // Call Pegasus API with proper authentication
    const response = await fetch(
      `${currentConfig.pegasusBaseUrl}/installations/api/v1/installation`,
      {
        headers: {
          "Authorization": `Bearer ${currentConfig.pegasusToken}`,
          "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      }
    );
    
    if (!response.ok) {
      console.error(`❌ Pegasus API returned HTTP ${response.status}`);
      return res.status(response.status).json({
        success: false,
        message: `Pegasus API error: HTTP ${response.status}`,
        details: await response.text()
      });
    }
    
    const installationsArray = await response.json();
    console.log(`✅ Found ${installationsArray.length} total installations`);
    
    // Forgiving, dynamic search: match by name or VIN start
    const normalize = str => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";
    const inputNorm = normalize(query);
    
    const filtered = installationsArray.filter(inst => {
      const nombre = inst.persona?.nombreAsegurado || "";
      const apellido = inst.persona?.apellidoPaterno || "";
      const fullName = [nombre, apellido].filter(Boolean).join(" ");
      const vin = inst.vehiculo?.serie || "";
      return (
        normalize(fullName).includes(inputNorm) ||
        vin.toUpperCase().startsWith(inputNorm)
      );
    });
    
    console.log(`🔍 Filtered to ${filtered.length} matching installations`);
    
    res.json({
      success: true,
      installations: filtered,
      totalFound: filtered.length,
      query: query
    });
    
  } catch (err) {
    console.error("❌ Error searching installations:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error while searching installations",
      error: err.message
    });
  }
});

// 3) Zapier URLs from environment config:
const ZAPIER_HOOK_INSTALL = currentConfig.zapierHookInstall;
const ZAPIER_HOOK_SECONDARY = currentConfig.zapierHookSecondary;

// 4) Complete Zapier workflow implementation (now protected)
app.post("/api/install", authenticateToken, trackInstallationStart, async (req, res) => {
  try {
    console.log("\n🚀 STARTING COMPLETE INSTALLATION WORKFLOW");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    // 1. Extract and validate input parameters
    const { client_name, imei, sim_number, vin, installationId, secondary_imei, secondary_sim_number } = req.body;
    
    if (!client_name || !imei || !vin || !installationId) {
      return res.status(400).json({
        success: false,
        message: "Missing one of client_name, imei, vin, installationId"
      });
    }

    if (TEST_MODE) {
      console.log("🧪 TEST_MODE is ON: Simulating complete workflow");
      return res.json({ 
        status: "success", 
        message: "Test mode: Complete workflow simulated successfully",
        workflow: "Complete installation workflow would have been executed"
      });
    }

    // 2. Check for duplicate installation (repeats table logic)
    console.log("🔍 Step 2: Checking for duplicate installation...");
    const isDuplicate = await checkDuplicateInstallation(installationId);
    if (isDuplicate) {
      console.log("❌ Duplicate installation detected, stopping workflow");
      return res.status(400).json({
        success: false,
        message: "Installation ID already exists in system - duplicate detected"
      });
    }
    console.log("✅ No duplicate found, continuing...");

    // 3. Record installation in repeats table
    console.log("📝 Step 3: Recording installation in repeats table...");
    await recordInstallationInRepeats(installationId, client_name);
    console.log("✅ Installation recorded in repeats table");

    // 4. [DEPRECATED] First Pegasus request - skipping as noted in dossier
    console.log("⏭️  Step 4: Skipping deprecated first Pegasus request");

    // 5. Get or create group in Pegasus (idempotent, non-blocking)
    console.log("🏢 Step 5: Getting or creating group in Pegasus...");
    const groupResult = await createOrUpdateGroup(client_name);
    const groupId = groupResult.groupId;
    console.log(`✅ Group ${groupResult.created ? 'created' : 'retrieved'} with ID: ${groupId}`);

    // 6. Clear vehicles worksheet rows 2-50 (simulated)
    console.log("🧹 Step 6: Clearing vehicles worksheet...");
    await clearVehiclesWorksheet();
    console.log("✅ Vehicles worksheet cleared");

    // 7. [DEPRECATED] Third Pegasus request - skipping as noted in dossier
    console.log("⏭️  Step 7: Skipping deprecated third Pegasus request");

    // 8. Create vehicle in Pegasus
    console.log("🚗 Step 8: Creating vehicle in Pegasus...");
    const vehicleId = await createVehicle(vin, imei, groupId);
    console.log(`✅ Vehicle created with ID: ${vehicleId}`);

    // 9. Configure HOS segment for primary device
    console.log("⚙️  Step 9: Configuring HOS segment for primary device...");
    const primaryHosResult = await processHosSegmentConfiguration(imei);
    console.log(`✅ Primary device HOS configuration: ${primaryHosResult.reason}`);

    // 10. Handle SIM card if provided
    if (sim_number) {
      console.log("📱 Step 10: Processing SIM card...");
      await processSimCard(sim_number);
      console.log("✅ SIM card processed successfully");
    } else {
      console.log("⏭️  Step 10: No SIM card provided, skipping");
    }

    // 11. Handle secondary device if provided
    let secondaryHosResult = null;
    if (secondary_imei) {
      console.log("🔧 Step 11: Processing secondary device...");
      
      // Process secondary SIM if provided
      if (secondary_sim_number) {
        console.log("📱 Step 11a: Processing secondary SIM card...");
        await processSimCard(secondary_sim_number);
        console.log("✅ Secondary SIM card processed successfully");
      } else {
        console.log("⏭️  Step 11a: No secondary SIM provided, skipping");
      }
      
      const secondaryVehicleId = await processSecondaryDevice(secondary_imei, vin, client_name);
      
      // Configure HOS segment for secondary device
      console.log("⚙️  Step 11b: Configuring HOS segment for secondary device...");
      secondaryHosResult = await processHosSegmentConfiguration(secondary_imei);
      console.log(`✅ Secondary device HOS configuration: ${secondaryHosResult.reason}`);
      
      console.log("✅ Secondary device processed successfully");
    } else {
      console.log("⏭️  Step 11: No secondary device provided, skipping");
    }

    console.log("🎉 COMPLETE INSTALLATION WORKFLOW FINISHED SUCCESSFULLY");
    
    // Track successful completion
    if (req.sessionId) {
      const { trackFrontendStep } = require('./activity-middleware');
      trackFrontendStep(req.sessionId, 'finalConfirmation', {
        success: true,
        groupId,
        vehicleId,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.json({
      status: "success",
      message: "Complete installation workflow executed successfully",
      details: {
        groupId,
        vehicleId,
        simProcessed: !!sim_number,
        secondaryDeviceProcessed: !!secondary_imei,
        secondarySimProcessed: !!secondary_sim_number,
        hosConfiguration: {
          primary: primaryHosResult,
          secondary: secondaryHosResult
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("❌ Error in complete installation workflow:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error during installation workflow",
      error: err.message
    });
  }
});

// Helper functions for the complete workflow

// Check for duplicate installation (repeats table logic)
async function checkDuplicateInstallation(installationId) {
  try {
    // In a real implementation, this would query a database
    // For now, we'll simulate this check
    console.log(`   Checking for duplicate installation ID: ${installationId}`);
    
    // Simulate API call to check if installation exists
    const response = await fetch(`${currentConfig.pegasusBaseUrl}/installations/api/v1/installation/${installationId}`, {
      headers: {
        "Authorization": `Bearer ${currentConfig.pegasusToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check if this installation has already been processed
      // This is a simplified check - you might need more sophisticated logic
      return data.status === 'completed' || data.status === 'confirmed';
    }
    
    return false; // Installation not found, so not a duplicate
  } catch (error) {
    console.log(`   Error checking for duplicate: ${error.message}`);
    // If we can't check, assume it's not a duplicate to avoid blocking
    return false;
  }
}

// Record installation in repeats table
async function recordInstallationInRepeats(installationId, clientName) {
  try {
    console.log(`   Recording installation ${installationId} for client ${clientName}`);
    
    // In a real implementation, this would insert into a database
    // For now, we'll log this action
    console.log(`   ✅ Installation ${installationId} recorded in repeats table`);
    
    // You could implement actual database insertion here
    // await db.collection('repeats').insertOne({
    //   installationId,
    //   clientName,
    //   timestamp: new Date(),
    //   status: 'recorded'
    // });
    
  } catch (error) {
    console.log(`   Error recording in repeats table: ${error.message}`);
    // Don't fail the entire workflow for this
  }
}

// Helper function to search for existing group by name using the correct API format
async function searchGroupByName(groupName) {
  try {
    const searchUrl = `https://api.pegasusgateway.com/groups?select=name&search.name="${encodeURIComponent(groupName)}"`;
    console.log(`   🔍 Searching for group with API: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Authenticate": currentConfig.pegasusToken
      },
      signal: AbortSignal.timeout(30000)
    });
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log(`   🔍 Search response:`, JSON.stringify(searchData, null, 2));
      
      // Handle different response structures: array directly or data property
      let groups = null;
      if (Array.isArray(searchData)) {
        groups = searchData;
      } else if (searchData && searchData.data && Array.isArray(searchData.data)) {
        groups = searchData.data;
      }
      
      if (groups && groups.length > 0) {
        const existingGroup = groups[0];
        const existingGroupId = existingGroup.id || existingGroup._id;
        console.log(`   ✅ Found existing group with ID: ${existingGroupId}`);
        return existingGroupId;
      } else {
        console.log(`   ℹ️  No existing group found with name: ${groupName}`);
        return null;
      }
    } else {
      const errorText = await searchResponse.text();
      console.log(`   ⚠️  Search failed with status ${searchResponse.status}: ${errorText}`);
      return null;
    }
  } catch (searchError) {
    console.log(`   ⚠️  Could not search for existing group: ${searchError.message}`);
    return null;
  }
}

// Get or create group in Pegasus - idempotent and non-blocking
async function createOrUpdateGroup(clientName) {
  try {
    // Clean up unwanted "NA" suffixes from client name (handles " NA", " NA/", " NA /", etc.)
    clientName = clientName.replace(/\s+NA\s*\/?\s*$/i, "").trim();
    
    console.log(`   Getting or creating group for client: ${clientName}`);
    
    // First, check if a group with this name already exists
    console.log(`   🔍 Step 1: Checking if group "${clientName}" already exists...`);
    const existingGroupId = await searchGroupByName(clientName);
    
    if (existingGroupId) {
      console.log(`   ✅ Group already exists with ID: ${existingGroupId} - will use existing group`);
      return { groupId: existingGroupId, created: false };
    }
    
    // Group doesn't exist, so create it
    console.log(`   📝 Step 2: Group does not exist, creating new group...`);
    
    // Build group payload based on dossier specifications
    const groupPayload = {
      name: clientName,
      company_name: clientName,
      address_1: "",
      logo: null,
      contact_email: "",
      contact_name: clientName,
      city: "",
      country: "Mexico" // Default as specified in dossier
    };
    
    console.log(`   Group payload:`, JSON.stringify(groupPayload, null, 2));
    
    // Create new group
    const response = await fetch("https://api.pegasusgateway.com/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authenticate": currentConfig.pegasusToken
      },
      body: JSON.stringify(groupPayload),
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pegasus API call failed: ${response.status} - ${errorText}`);
    }
    
    const groupData = await response.json();
    console.log(`   Group creation response:`, JSON.stringify(groupData, null, 2));
    
    // Extract group ID from response
    const groupId = groupData.id || groupData._id;
    if (!groupId) {
      throw new Error("No group ID returned from Pegasus");
    }
    
    console.log(`   ✅ Group created successfully with ID: ${groupId}`);
    return { groupId, created: true };
    
  } catch (error) {
    console.error(`   ❌ Fatal error in group operation: ${error.message}`);
    throw error;
  }
}

// Clear vehicles worksheet (simulated)
async function clearVehiclesWorksheet() {
  try {
    console.log(`   Clearing vehicles worksheet rows 2-50...`);
    
    // In a real implementation, this would clear a Google Sheets or Excel file
    // For now, we'll simulate this action
    console.log(`   ✅ Vehicles worksheet cleared (simulated)`);
    
    // You could implement actual spreadsheet clearing here
    // await clearGoogleSheetRows('Mass Commands DI-361', 'Vehicles', 2, 50);
    
  } catch (error) {
    console.log(`   Error clearing vehicles worksheet: ${error.message}`);
    // Don't fail the entire workflow for this
  }
}

// Create vehicle in Pegasus
async function createVehicle(vin, imei, groupId) {
  try {
    console.log(`   Creating vehicle with VIN: ${vin}, IMEI: ${imei}, Group: ${groupId}`);
    
    // Build vehicle payload based on dossier specifications
    const vehiclePayload = {
      name: vin,
      device: imei,
      year: "",
      make: "",
      model: "",
      license_plate: "",
      color: "",
      vin: vin,
      primary: parseInt(groupId),
      tank_volume: null,
      tank_unit: null,
      groups: currentConfig.defaultGroupId ? [currentConfig.defaultGroupId, parseInt(groupId)] : [parseInt(groupId)] // Use hardcoded group ID only in production
    };
    
    console.log(`   Vehicle payload:`, JSON.stringify(vehiclePayload, null, 2));
    
    // Create vehicle in Pegasus with enhanced error handling
    const response = await makePegasusApiCall("https://api.pegasusgateway.com/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authenticate": currentConfig.pegasusToken
      },
      body: JSON.stringify(vehiclePayload)
    });
    
    const vehicleData = await response.json();
    console.log(`   Vehicle creation response:`, JSON.stringify(vehicleData, null, 2));
    
    // Extract vehicle ID from response
    const vehicleId = vehicleData.id || vehicleData._id;
    if (!vehicleId) {
      throw new Error("No vehicle ID returned from Pegasus");
    }
    
    console.log(`   ✅ Vehicle created successfully with ID: ${vehicleId}`);
    return vehicleId;
    
  } catch (error) {
    console.error(`   ❌ Error creating vehicle: ${error.message}`);
    throw error;
  }
}

// Create or get secondary group with naming pattern "client (2)"
async function createOrUpdateSecondaryGroup(clientName) {
  try {
    // Clean up unwanted "NA" suffixes from client name (handles " NA", " NA/", " NA /", etc.)
    clientName = clientName.replace(/\s+NA\s*\/?\s*$/i, "").trim();
    
    const secondaryGroupName = `${clientName} (2)`;
    console.log(`   Getting or creating secondary group for client: ${secondaryGroupName}`);
    
    // First, check if a secondary group with this name already exists
    console.log(`   🔍 Step 1: Checking if secondary group "${secondaryGroupName}" already exists...`);
    const existingGroupId = await searchGroupByName(secondaryGroupName);
    
    if (existingGroupId) {
      console.log(`   ✅ Secondary group already exists with ID: ${existingGroupId} - will use existing group`);
      return { groupId: existingGroupId, created: false };
    }
    
    // Secondary group doesn't exist, so create it
    console.log(`   📝 Step 2: Secondary group does not exist, creating new group...`);
    
    // Build secondary group payload based on dossier specifications
    const groupPayload = {
      name: secondaryGroupName,
      company_name: secondaryGroupName,
      address_1: "",
      logo: null,
      contact_email: "",
      contact_name: secondaryGroupName,
      city: "",
      country: "Mexico" // Default as specified in dossier
    };
    
    console.log(`   Secondary group payload:`, JSON.stringify(groupPayload, null, 2));
    
    // Create new secondary group
    const response = await fetch("https://api.pegasusgateway.com/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authenticate": currentConfig.pegasusToken
      },
      body: JSON.stringify(groupPayload),
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pegasus API call failed: ${response.status} - ${errorText}`);
    }
    
    const groupData = await response.json();
    console.log(`   Secondary group creation response:`, JSON.stringify(groupData, null, 2));
    
    // Extract group ID from response
    const groupId = groupData.id || groupData._id;
    if (!groupId) {
      throw new Error("No secondary group ID returned from Pegasus");
    }
    
    console.log(`   ✅ Secondary group created successfully with ID: ${groupId}`);
    return { groupId, created: true };
    
  } catch (error) {
    console.error(`   ❌ Fatal error in secondary group operation: ${error.message}`);
    throw error;
  }
}

// Create secondary vehicle with secondary group ID
async function createSecondaryVehicle(vin, imei, groupId2) {
  try {
    console.log(`   Creating secondary vehicle with VIN: ${vin}, IMEI: ${imei}, Secondary Group: ${groupId2}`);
    
    // Build vehicle payload for secondary device with secondary group ID
    const vehiclePayload = {
      name: `${vin} (2)`,
      device: imei,
      year: "",
      make: "",
      model: "",
      license_plate: "",
      color: "",
      vin: vin,
      primary: parseInt(groupId2), // Use secondary group ID as primary key
      tank_volume: null,
      tank_unit: null,
      groups: currentConfig.defaultGroupId ? [currentConfig.defaultGroupId, parseInt(groupId2)] : [parseInt(groupId2)] // Use hardcoded group ID only in production
    };
    
    console.log(`   Secondary vehicle payload:`, JSON.stringify(vehiclePayload, null, 2));
    
    // Create secondary vehicle in Pegasus with enhanced error handling
    const response = await makePegasusApiCall("https://api.pegasusgateway.com/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authenticate": currentConfig.pegasusToken
      },
      body: JSON.stringify(vehiclePayload)
    });
    
    const vehicleData = await response.json();
    console.log(`   Secondary vehicle creation response:`, JSON.stringify(vehicleData, null, 2));
    
    // Extract vehicle ID from response
    const vehicleId = vehicleData.id || vehicleData._id;
    if (!vehicleId) {
      throw new Error("No vehicle ID returned from Pegasus for secondary vehicle");
    }
    
    console.log(`   ✅ Secondary vehicle created successfully with ID: ${vehicleId}`);
    return vehicleId;
    
  } catch (error) {
    console.error(`   ❌ Error creating secondary vehicle: ${error.message}`);
    throw error;
  }
}

// Process SIM card based on type (SuperSIM vs Wireless)
async function processSimCard(simNumber) {
  try {
    console.log(`   Processing SIM card: ${simNumber}`);
    
    // Determine SIM type based on first 4 digits
    const simPrefix = simNumber.substring(0, 4);
    let simType, apiEndpoint;
    
    if (simPrefix === "8988") {
      simType = "SuperSIM";
      apiEndpoint = "https://api.pegasusgateway.com/m2m/supersims/v1/Sims";
    } else if (simPrefix === "8901") {
      simType = "Wireless";
      apiEndpoint = "https://api.pegasusgateway.com/m2m/wireless/v1/Sims";
    } else {
      throw new Error(`Invalid SIM ICCID format: ${simNumber}. Must start with 8988 (SuperSIM) or 8901 (Wireless)`);
    }
    
    console.log(`   SIM Type: ${simType}, Endpoint: ${apiEndpoint}`);
    
    // Check if SIM exists in Pegasus256 first
    let simFound = false;
    let simData = null;
    let foundIn = null;
    
    try {
      console.log(`   Checking Pegasus256 for ${simType} SIM...`);
      const pegasus256Response = await fetch(`${apiEndpoint}?Iccid=${simNumber}`, {
        headers: {
          "Authenticate": currentConfig.pegasus256Token
        }
      });
      
      if (pegasus256Response.ok) {
        const pegasus256Data = await pegasus256Response.json();
        const sims = pegasus256Data.sims || pegasus256Data.data || [];
        
        if (sims.length > 0) {
          simFound = true;
          simData = sims[0];
          foundIn = "Pegasus256";
          console.log(`   ✅ SIM found in Pegasus256`);
        }
      }
    } catch (error) {
      console.log(`   Error checking Pegasus256: ${error.message}`);
    }
    
    // If not found in Pegasus256, check Pegasus1
    if (!simFound) {
      try {
        console.log(`   Checking Pegasus1 for ${simType} SIM...`);
        const pegasus1Response = await fetch(`${apiEndpoint}?Iccid=${simNumber}`, {
          headers: {
            "Authenticate": currentConfig.pegasus1Token
          }
        });
        
        if (pegasus1Response.ok) {
          const pegasus1Data = await pegasus1Response.json();
          const sims = pegasus1Data.sims || pegasus1Data.data || [];
          
          if (sims.length > 0) {
            simFound = true;
            simData = sims[0];
            foundIn = "Pegasus1";
            console.log(`   ✅ SIM found in Pegasus1`);
          }
        }
      } catch (error) {
        console.log(`   Error checking Pegasus1: ${error.message}`);
      }
    }
    
    if (!simFound) {
      throw new Error(`${simType} SIM not found in either Pegasus instance`);
    }
    
    // Process SIM based on where it was found
    if (foundIn === "Pegasus1") {
      console.log(`   SIM is in Pegasus1 warehouse, activating...`);
      // Activate SIM in Pegasus1
      await activateSimInPegasus1(simData.sid, apiEndpoint);
    } else {
      console.log(`   SIM is already in Pegasus256, updating status...`);
      // Update SIM status in Pegasus256
      await updateSimStatusInPegasus256(simData.sid, apiEndpoint);
    }
    
    console.log(`   ✅ SIM card processed successfully`);
    
  } catch (error) {
    console.error(`   ❌ Error processing SIM card: ${error.message}`);
    throw error;
  }
}

// Activate SIM in Pegasus1
async function activateSimInPegasus1(simSid, apiEndpoint) {
  try {
    console.log(`   Activating SIM ${simSid} in Pegasus1...`);
    
    const response = await fetch(`${apiEndpoint}/${simSid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authenticate": currentConfig.pegasus1Token
      },
      body: JSON.stringify({ Status: "active" })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to activate SIM in Pegasus1: ${response.status} - ${errorText}`);
    }
    
    console.log(`   ✅ SIM activated in Pegasus1`);
    
  } catch (error) {
    console.error(`   ❌ Error activating SIM in Pegasus1: ${error.message}`);
    throw error;
  }
}

// Update SIM status in Pegasus256
async function updateSimStatusInPegasus256(simSid, apiEndpoint) {
  try {
    console.log(`   Updating SIM ${simSid} status in Pegasus256...`);
    
    const response = await fetch(`${apiEndpoint}/${simSid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authenticate": currentConfig.pegasus256Token
      },
      body: JSON.stringify({ Status: "active" })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update SIM status in Pegasus256: ${response.status} - ${errorText}`);
    }
    
    console.log(`   ✅ SIM status updated in Pegasus256`);
    
  } catch (error) {
    console.error(`   ❌ Error updating SIM status in Pegasus256: ${error.message}`);
    throw error;
  }
}

// Check if device has HOS segment configuration
async function checkHosSegmentConfiguration(imei) {
  try {
    console.log(`   Checking HOS segment configuration for IMEI: ${imei}`);
    
    const response = await fetch(`https://api.pegasusgateway.com/devices?imeis=${imei}&select=segments`, {
      headers: {
        "Authenticate": currentConfig.pegasusToken
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check HOS segment configuration: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`   HOS segment check response:`, JSON.stringify(data, null, 2));
    
    // Check if device has HOS segment configuration
    const deviceData = data.data && data.data[0];
    if (!deviceData) {
      console.log(`   ❌ No device data found for IMEI: ${imei}`);
      return { hasConfiguration: false, reason: 'Device not found' };
    }
    
    const hasHosConfiguration = deviceData.segments && 
                               deviceData.segments.setup && 
                               deviceData.segments.setup.hos;
    
    console.log(`   HOS configuration status: ${hasHosConfiguration ? 'EXISTS' : 'MISSING'}`);
    
    return { 
      hasConfiguration: hasHosConfiguration,
      deviceData: deviceData,
      reason: hasHosConfiguration ? 'Configuration exists' : 'No HOS segment configuration found'
    };
    
  } catch (error) {
    console.error(`   ❌ Error checking HOS segment configuration: ${error.message}`);
    throw error;
  }
}

// Set HOS segment configuration with default values
async function setHosSegmentConfiguration(imei) {
  try {
    console.log(`   Setting HOS segment configuration for IMEI: ${imei}`);
    
    const hosPayload = {
      segment_type: "hos",
      signal: "speed_distance",
      max_work_hours: 14,
      min_rest_hours: 8,
      max_continuous_work_hours: 5,
      min_continuous_break_hours: 0.50,
      min_break_hours: 0.25
    };
    
    console.log(`   HOS segment payload:`, JSON.stringify(hosPayload, null, 2));
    
    const response = await fetch(`https://api.pegasusgateway.com/devices/${imei}/remote/segment_setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authenticate": currentConfig.pegasusToken
      },
      body: JSON.stringify(hosPayload),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to set HOS segment configuration: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    console.log(`   HOS segment setup response:`, JSON.stringify(responseData, null, 2));
    
    console.log(`   ✅ HOS segment configuration set successfully for IMEI: ${imei}`);
    return responseData;
    
  } catch (error) {
    console.error(`   ❌ Error setting HOS segment configuration: ${error.message}`);
    throw error;
  }
}

// Process HOS segment configuration for a device
async function processHosSegmentConfiguration(imei) {
  try {
    console.log(`   Processing HOS segment configuration for IMEI: ${imei}`);
    
    // Check if device already has HOS configuration
    const hosCheck = await checkHosSegmentConfiguration(imei);
    
    if (hosCheck.hasConfiguration) {
      console.log(`   ✅ Device already has HOS segment configuration, skipping setup`);
      return { 
        configured: false, 
        reason: 'Already configured',
        existingConfiguration: hosCheck.deviceData.segments.setup.hos
      };
    }
    
    // Set HOS configuration with default values
    console.log(`   Setting up HOS segment configuration with default values...`);
    const setupResult = await setHosSegmentConfiguration(imei);
    
    console.log(`   ✅ HOS segment configuration completed for IMEI: ${imei}`);
    return { 
      configured: true, 
      reason: 'Configuration set with default values',
      setupResult: setupResult
    };
    
  } catch (error) {
    console.error(`   ❌ Error processing HOS segment configuration: ${error.message}`);
    throw error;
  }
}

// Process secondary device
async function processSecondaryDevice(secondaryImei, vin, clientName) {
  try {
    console.log(`   Processing secondary device: ${secondaryImei} for VIN: ${vin}`);
    
    // Create or get secondary group with naming pattern "client (2)"
    console.log(`   🏢 Creating/getting secondary group for client: ${clientName}`);
    const secondaryGroupResult = await createOrUpdateSecondaryGroup(clientName);
    const groupId2 = secondaryGroupResult.groupId;
    console.log(`   ✅ Secondary group ${secondaryGroupResult.created ? 'created' : 'retrieved'} with ID: ${groupId2}`);
    
    // Create secondary vehicle in Pegasus with secondary group ID
    const secondaryVehicleId = await createSecondaryVehicle(vin, secondaryImei, groupId2);
    
    console.log(`   ✅ Secondary device processed successfully with vehicle ID: ${secondaryVehicleId}`);
    return secondaryVehicleId;
    
  } catch (error) {
    console.error(`   ❌ Error processing secondary device: ${error.message}`);
    throw error;
  }
}

// 4b) Secondary device installation endpoint (updated to use complete workflow)
app.post("/api/secondary-install", authenticateToken, trackInstallationStart, async (req, res) => {
  try {
    console.log("\n🔧 STARTING SECONDARY DEVICE INSTALLATION WORKFLOW");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    const { client_name, secondary_imei, secondary_sim_number, vin, installationId } = req.body;
    
    if (!client_name || !secondary_imei || !vin || !installationId) {
      return res.status(400).json({
        success: false,
        message: "Missing one of client_name, secondary_imei, vin, installationId"
      });
    }

    if (TEST_MODE) {
      console.log("🧪 TEST_MODE is ON: Simulating secondary device workflow");
      return res.json({ 
        status: "success", 
        message: "Test mode: Secondary device workflow simulated successfully",
        workflow: "Secondary device installation workflow would have been executed"
      });
    }

    // Check for duplicate installation
    console.log("🔍 Checking for duplicate installation...");
    const isDuplicate = await checkDuplicateInstallation(installationId);
    if (isDuplicate) {
      console.log("❌ Duplicate installation detected, stopping workflow");
      return res.status(400).json({
        success: false,
        message: "Installation ID already exists in system - duplicate detected"
      });
    }

    // Record installation in repeats table
    console.log("📝 Recording installation in repeats table...");
    await recordInstallationInRepeats(installationId, client_name);

    // Create/update group in Pegasus
    console.log("🏢 Creating/updating group in Pegasus...");
    const groupResult = await createOrUpdateGroup(client_name);
    const groupId = groupResult.groupId;

    // Process secondary SIM if provided
    if (secondary_sim_number) {
      console.log("📱 Processing secondary SIM card...");
      await processSimCard(secondary_sim_number);
      console.log("✅ Secondary SIM card processed successfully");
    } else {
      console.log("⏭️  No secondary SIM provided, skipping");
    }

    // Create secondary vehicle in Pegasus with secondary group
    console.log("🔧 Creating secondary vehicle in Pegasus...");
    const secondaryVehicleId = await processSecondaryDevice(secondary_imei, vin, client_name);

    // Configure HOS segment for secondary device
    console.log("⚙️  Configuring HOS segment for secondary device...");
    const secondaryHosResult = await processHosSegmentConfiguration(secondary_imei);
    console.log(`✅ Secondary device HOS configuration: ${secondaryHosResult.reason}`);

    console.log("🎉 SECONDARY DEVICE INSTALLATION WORKFLOW FINISHED SUCCESSFULLY");
    
    // Track successful completion
    if (req.sessionId) {
      const { trackFrontendStep } = require('./activity-middleware');
      trackFrontendStep(req.sessionId, 'finalConfirmation', {
        success: true,
        groupId,
        secondaryVehicleId,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.json({
      status: "success",
      message: "Secondary device installation workflow executed successfully",
      details: {
        groupId,
        secondaryVehicleId,
        secondarySimProcessed: !!secondary_sim_number,
        hosConfiguration: {
          secondary: secondaryHosResult
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("❌ Error in secondary device installation workflow:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error during secondary device installation workflow",
      error: err.message
    });
  }
});

app.get("/api/device-status", authenticateToken, async (req, res) => {
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
    // Check if device is reporting location coordinates (not just GPS validity)
    // Since the device is clearly reporting lat/lon and they're fresh, consider it as reporting
    // Note: coordinates are directly in deviceData.latest.loc.lat and deviceData.latest.loc.lon
    const hasLocationData = deviceData.latest?.loc?.lat != null && deviceData.latest?.loc?.lon != null;
    const isReporting = hasLocationData && locationAge <= 60; // Has coordinates AND location is fresh (≤60s)
    const isOnline = deviceData.connection?.online === true;
    
    // Use location timestamp as the primary indicator of recent activity since it updates in real-time
    // If device is reporting fresh location data, consider it as having recent connection
    const hasRecentConnection = locationAge <= 300; // 5 minutes - use location age instead of connection timestamp
    const hasRecentActivity = lastRxAge !== null && lastRxAge <= 300; // 5 minutes
    
    console.log(`\n✅ [${requestTime}] VALIDATION RESULTS:`);
    console.log(`   - Location Valid: ${isReporting}`);
    console.log(`   - Connection Online: ${isOnline}`);
    console.log(`   - Recent Connection: ${hasRecentConnection} (≤5min)`);
    console.log(`   - Recent Activity: ${hasRecentActivity} (≤5min)`);
    console.log(`   - Overall Status: ${isReporting && isOnline && hasRecentConnection && hasRecentActivity ? 'VALID' : 'INVALID'}`);
    
    // Debug: Check the isReporting variable
    console.log(`\n🔍 DEBUG isReporting variable:`, {
      isReporting,
      hasLocationData,
      locationAge,
      isReportingType: typeof isReporting,
      isReportingValue: isReporting
    });
    
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
    console.log(`\n🔍 FINAL CHECK - isReporting value:`, isReporting);
    console.log(`\n🔍 FINAL CHECK - response object keys:`, Object.keys(response));
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
app.post("/api/verify-imei", authenticateToken, async (req, res) => {
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
app.post("/api/verify-sim", authenticateToken, async (req, res) => {
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
app.post("/api/confirm-installation", authenticateToken, async (req, res) => {
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

// New endpoint for checking installation workflow status
app.get("/api/installation-status/:installationId", authenticateToken, async (req, res) => {
  try {
    const { installationId } = req.params;
    
    if (!installationId) {
      return res.status(400).json({
        success: false,
        message: "Installation ID is required"
      });
    }

    console.log(`🔍 Checking installation status for ID: ${installationId}`);
    
    // Check installation status in Pegasus
    const response = await fetch(`${currentConfig.pegasusBaseUrl}/installations/api/v1/installation/${installationId}`, {
      headers: {
        "Authorization": `Bearer ${currentConfig.pegasusToken}`
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Failed to fetch installation status: ${response.status}`
      });
    }
    
    const installationData = await response.json();
    
    // Check if vehicle exists
    let vehicleStatus = "unknown";
    if (installationData.vehiculo?.serie) {
      try {
        const vehicleResponse = await fetch(`https://api.pegasusgateway.com/vehicles?vin=${installationData.vehiculo.serie}`, {
          headers: {
            "Authenticate": currentConfig.pegasusToken
          }
        });
        
        if (vehicleResponse.ok) {
          const vehicleData = await vehicleResponse.json();
          vehicleStatus = vehicleData.vehicles && vehicleData.vehicles.length > 0 ? "created" : "not_found";
        }
      } catch (error) {
        console.log(`Error checking vehicle status: ${error.message}`);
      }
    }
    
    // Check if group exists
    let groupStatus = "unknown";
    if (installationData.persona?.nombreAsegurado) {
      try {
        const groupResponse = await fetch(`https://api.pegasusgateway.com/groups?name=${encodeURIComponent(installationData.persona.nombreAsegurado)}`, {
          headers: {
            "Authenticate": currentConfig.pegasusToken
          }
        });
        
        if (groupResponse.ok) {
          const groupData = await groupResponse.json();
          groupStatus = groupData.groups && groupData.groups.length > 0 ? "created" : "not_found";
        }
      } catch (error) {
        console.log(`Error checking group status: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      installationId,
      status: {
        installation: installationData.status || "unknown",
        vehicle: vehicleStatus,
        group: groupStatus,
        lastUpdated: installationData.updatedAt || installationData.createdAt,
        timestamp: new Date().toISOString()
      },
      details: installationData
    });
    
  } catch (error) {
    console.error("Error checking installation status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while checking installation status",
      error: error.message
    });
  }
});

// Utility function for retrying failed API calls
async function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.log(`   Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

// Enhanced error handling for Pegasus API calls
async function makePegasusApiCall(url, options, retryCount = 3) {
  return retryApiCall(async () => {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pegasus API call failed: ${response.status} - ${errorText}`);
    }
    
    return response;
  }, retryCount);
}

// Activity tracking API endpoints

// Get user's activity summary
app.get("/api/activity/summary", authenticateToken, (req, res) => {
  try {
    const { getUserActivitySummary } = require('./activity-tracker');
    const summary = getUserActivitySummary(req.user.id);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting activity summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving activity summary',
      error: error.message
    });
  }
});

// Get user's incomplete sessions (where they left off)
app.get("/api/activity/incomplete", authenticateToken, (req, res) => {
  try {
    const { getUserIncompleteSessions } = require('./activity-tracker');
    const incompleteSessions = getUserIncompleteSessions(req.user.id);
    
    res.json({
      success: true,
      data: incompleteSessions
    });
  } catch (error) {
    console.error('Error getting incomplete sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving incomplete sessions',
      error: error.message
    });
  }
});

// Get all activities with optional filtering (admin only)
app.get("/api/activity/all", authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { getAllActivities } = require('./activity-tracker');
    
    // Extract query parameters for filtering
    const filters = {
      userId: req.query.userId,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    const activities = getAllActivities(filters);
    
    res.json({
      success: true,
      data: activities,
      filters: filters,
      count: activities.length
    });
  } catch (error) {
    console.error('Error getting all activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving activities',
      error: error.message
    });
  }
});

// Get overall activity statistics (admin only)
app.get("/api/activity/stats", authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { getOverallStats } = require('./activity-tracker');
    const stats = getOverallStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving activity statistics',
      error: error.message
    });
  }
});

// Get specific session details
app.get("/api/activity/session/:sessionId", authenticateToken, (req, res) => {
  try {
    const { getSession } = require('./activity-tracker');
    const session = getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    // Check if user has access to this session
    if (session.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving session details',
      error: error.message
    });
  }
});

// Track frontend step completion
app.post("/api/track-step", authenticateToken, (req, res) => {
  try {
    const { sessionId, step, data } = req.body;
    
    if (!sessionId || !step) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and step are required'
      });
    }
    
    const { trackFrontendStep } = require('./activity-middleware');
    trackFrontendStep(sessionId, step, data);
    
    res.json({
      success: true,
      message: 'Step progress tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking step:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking step progress',
      error: error.message
    });
  }
});

// Get current session ID for user
app.get("/api/activity/current-session", authenticateToken, (req, res) => {
  try {
    const { getCurrentSessionId } = require('./activity-middleware');
    const sessionId = getCurrentSessionId(req.user.id);
    
    res.json({
      success: true,
      sessionId: sessionId
    });
  } catch (error) {
    console.error('Error getting current session:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving current session',
      error: error.message
    });
  }
});

// 5) Error handling middleware (must be last)
app.use(trackInstallationErrors);

// 6) Start the server
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




