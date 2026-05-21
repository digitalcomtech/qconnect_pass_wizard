
// server.js
const express = require("express");
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
const allowDangerousPegasusConfirmationFallback =
  config.allowDangerousPegasusConfirmationFallback === true;

if (process.env.ENABLE_CONFIRMATION_FALLBACK === "true" && !allowDangerousPegasusConfirmationFallback) {
  console.warn(
    "[config] ENABLE_CONFIRMATION_FALLBACK is deprecated and ignored. " +
      "Unsafe confirmation success without Pegasus requires DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK=true. " +
      "See docs/KNOWN_ISSUES.md."
  );
}

// 🔧 ENVIRONMENT SWITCHER — from config (ENVIRONMENT env)
const ENVIRONMENT = config.ENVIRONMENT;

// Environment Configuration - Now loaded from config.js
const ENV_CONFIG = {
  production: config.production,
  qa: config.qa
};

// Get current environment config
const currentConfig = ENV_CONFIG[ENVIRONMENT];
console.log(`🔧 Running in ${ENVIRONMENT.toUpperCase()} environment`);

function assertProductionRuntimeReady() {
  if (process.env.NODE_ENV !== "production") return;
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
  const prefix = ENVIRONMENT === "production" ? "PROD" : "QA";
  if (!currentConfig.pegasus1Token) {
    missing.push(prefix === "PROD" ? "PROD_PEGASUS1_TOKEN" : "QA_PEGASUS1_TOKEN");
  }
  if (!currentConfig.pegasus256Token) {
    missing.push(prefix === "PROD" ? "PROD_PEGASUS256_TOKEN" : "QA_PEGASUS256_TOKEN");
  }
  if (missing.length) {
    throw new Error(
      `[startup] NODE_ENV=production but required env vars are missing: ${missing.join(", ")}. See docs/ENVIRONMENT.md`
    );
  }
}

assertProductionRuntimeReady();

if (!currentConfig.pegasusToken) {
  console.warn(
    `[startup] qservices Bearer token for "${ENVIRONMENT}" is empty (${ENVIRONMENT === "production" ? "PROD_PEGASUS_TOKEN" : "QA_PEGASUS_TOKEN"}). Installation search returns 503 until set; run npm run pegasus:fetch-tokens. See GET /api/health/credentials.`
  );
}
if (!currentConfig.pegasus1Token) {
  console.warn(
    `[startup] Pegasus1 Authenticate token is empty (${ENVIRONMENT === "production" ? "PROD_PEGASUS1_TOKEN" : "QA_PEGASUS1_TOKEN"}). Device/group/vehicle APIs will fail.`
  );
}

const { createPegasusClient } = require("./pegasus-client");
const { createDuplicateInstallationChecker } = require("./services/install/duplicate-check");
const { recordInstallationInRepeats } = require("./services/install/repeats");
const { createGroupHelpers } = require("./services/install/groups");
const { createVehicleHelpers } = require("./services/install/vehicles");
const { createSecondaryDeviceProcessor } = require("./services/install/secondary-device");
const { createSimHelpers } = require("./services/install/sim");
const { createHosHelpers } = require("./services/install/hos");
const { createCompleteInstallOrchestrator } = require("./services/install/complete-install-orchestrator");
const { createDryRunOrchestrator } = require("./services/install/dry-run-orchestrator");
const { normalizeInstallResponse } = require("./services/install/normalize-install-response");
const { createSecondaryInstallOrchestrator } = require("./services/install/secondary-install-orchestrator");
const { createConfirmInstallationOrchestrator } = require("./services/install/confirm-installation-orchestrator");
const { registerHealthz, createApiMetaRouter } = require("./routes/system");
const { createAuthRouter } = require("./routes/auth");
const { createPegasusReadRouter } = require("./routes/pegasus-read");
const { createActivityRouter } = require("./routes/activity");

const pegasus = createPegasusClient({
  currentConfig,
  apiBaseUrl: config.pegasus && config.pegasus.baseUrl,
  defaultTimeoutMs: (config.api && config.api.timeout) || 30000,
});

const checkDuplicateInstallation = createDuplicateInstallationChecker(pegasus);
const { createOrUpdateGroup, createOrUpdateSecondaryGroup } = createGroupHelpers({
  pegasus,
  currentConfig,
});
const { clearVehiclesWorksheet, createVehicle, createSecondaryVehicle } = createVehicleHelpers({
  pegasus,
  currentConfig,
});
const processSecondaryDevice = createSecondaryDeviceProcessor({
  createOrUpdateSecondaryGroup,
  createSecondaryVehicle,
});
const { processSimCard } = createSimHelpers({ pegasus, currentConfig });
const { processHosSegmentConfiguration, checkHosSegmentConfiguration } = createHosHelpers({
  pegasus,
  currentConfig,
});

const { runCompleteInstallOrchestration } = createCompleteInstallOrchestrator({
  TEST_MODE,
  checkDuplicateInstallation,
  recordInstallationInRepeats,
  createOrUpdateGroup,
  clearVehiclesWorksheet,
  createVehicle,
  processHosSegmentConfiguration,
  processSimCard,
  processSecondaryDevice,
});

const { runInstallDryRun } = createDryRunOrchestrator({
  ENVIRONMENT,
  TEST_MODE,
  currentConfig,
  pegasus,
  checkDuplicateInstallation,
  checkHosSegmentConfiguration,
});

const { runSecondaryInstallOrchestration } = createSecondaryInstallOrchestrator({
  TEST_MODE,
  checkDuplicateInstallation,
  recordInstallationInRepeats,
  createOrUpdateGroup,
  processSimCard,
  processSecondaryDevice,
  processHosSegmentConfiguration,
});

const { runConfirmInstallationOrchestration } = createConfirmInstallationOrchestrator({
  pegasus,
  currentConfig,
  TEST_MODE,
  allowDangerousPegasusConfirmationFallback,
});

function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[startup] SESSION_SECRET is required when NODE_ENV=production. See docs/ENVIRONMENT.md"
    );
  }
  console.warn(
    "[startup] SESSION_SECRET not set; using insecure local dev fallback. Set SESSION_SECRET for shared or deployed environments."
  );
  return "installer-app-local-dev-session-fallback-not-for-production";
}

const app = express();
const PORT = process.env.PORT || 8080;

registerHealthz(app, ENVIRONMENT);

// Session configuration
app.use(session({
  secret: resolveSessionSecret(),
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

app.use(
  "/api/auth",
  createAuthRouter({ authenticateUser, generateToken, authenticateToken })
);
app.use(
  "/api",
  createApiMetaRouter({
    ENVIRONMENT,
    TEST_MODE,
    currentConfig,
    pegasus,
    authenticateToken,
  })
);
app.use(
  "/api",
  createPegasusReadRouter({
    pegasus,
    currentConfig,
    authenticateToken,
    environment: ENVIRONMENT,
  })
);

// Installation workflow (protected)
function sendInstallApiResponse(req, res, result) {
  const payload = normalizeInstallResponse({
    httpStatus: result.status,
    json: result.json,
    body: req.body,
    environment: ENVIRONMENT,
    requestId: req.sessionId || req.headers["x-request-id"] || null,
  });
  if (result.beforeSend) result.beforeSend();
  return res.status(result.status).json(payload);
}

app.post("/api/install/dry-run", authenticateToken, async (req, res) => {
  try {
    const result = await runInstallDryRun({ body: req.body });
    return sendInstallApiResponse(req, res, result);
  } catch (err) {
    console.error("❌ Error in install dry-run:", err);
    return sendInstallApiResponse(req, res, {
      status: 500,
      json: {
        success: false,
        status: "failed",
        code: "DRY_RUN_ERROR",
        message: "Internal server error during install dry-run",
        error: err.message,
        details: { dryRun: true, steps: [], warnings: [], errors: [] },
      },
    });
  }
});

app.post("/api/install", authenticateToken, trackInstallationStart, async (req, res) => {
  try {
    const result = await runCompleteInstallOrchestration({
      body: req.body,
      sessionId: req.sessionId,
    });
    return sendInstallApiResponse(req, res, result);
  } catch (err) {
    console.error("❌ Error in complete installation workflow:", err);
    return sendInstallApiResponse(req, res, {
      status: 500,
      json: {
        success: false,
        status: "failed",
        message: "Internal server error during installation workflow",
        error: err.message,
      },
    });
  }
});

// 4b) Secondary device installation endpoint (updated to use complete workflow)
app.post("/api/secondary-install", authenticateToken, trackInstallationStart, async (req, res) => {
  try {
    const result = await runSecondaryInstallOrchestration({
      body: req.body,
      sessionId: req.sessionId,
    });
    if (result.beforeSend) result.beforeSend();
    return res.status(result.status).json(result.json);
  } catch (err) {
    console.error("❌ Error in secondary device installation workflow:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error during secondary device installation workflow",
      error: err.message,
    });
  }
});

// New endpoint for installation confirmation
app.post("/api/confirm-installation", authenticateToken, async (req, res) => {
  try {
    const { installationId } = req.body;
    const result = await runConfirmInstallationOrchestration({ installationId });
    return res.status(result.status).json(result.json);
  } catch (err) {
    console.error("Error in /api/confirm-installation:", err);

    let errorMessage = "Internal server error while confirming installation";
    let statusCode = 500;

    if (err.name === "AbortError") {
      errorMessage = "Request timed out while confirming installation";
      statusCode = 408;
    } else if (err.name === "TypeError" && err.message.includes("fetch")) {
      errorMessage = "Network error while connecting to Pegasus API";
      statusCode = 503;
    } else if (err.message) {
      errorMessage = err.message;
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: err.name || "UnknownError",
    });
  }
});

app.use(
  "/api",
  createActivityRouter({ authenticateToken, requireRole })
);

// 5) Error handling middleware (must be last)
app.use(trackInstallationErrors);

// 6) Start the server
app.listen(PORT, () => {
  console.log(`Express proxy running at http://localhost:${PORT}`);
});

