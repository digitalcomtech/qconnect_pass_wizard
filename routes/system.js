/**
 * Liveness + read-only app/Pegasus meta endpoints.
 * - registerHealthz(app) must run before express-session (no cookie dependency).
 * - createApiMetaRouter() mounts at /api → /config, /health/credentials, /health/pegasus
 */
const express = require("express");
const {
  buildPegasusCredentialDiagnostics,
} = require("../services/pegasus/credential-diagnostics");
const { missingQservicesTokenMessage } = require("../services/pegasus/qservices-auth-hint");

function registerHealthz(app, ENVIRONMENT) {
  app.get("/healthz", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      status: "ok",
      service: "installer-app",
      environment: ENVIRONMENT || "unknown",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
}

function createApiMetaRouter({
  ENVIRONMENT,
  TEST_MODE,
  currentConfig,
  pegasus,
  authenticateToken,
}) {
  const router = express.Router();

  router.get("/config", authenticateToken, (req, res) => {
    const credentials = buildPegasusCredentialDiagnostics(currentConfig, ENVIRONMENT);
    res.json({
      environment: ENVIRONMENT,
      testMode: TEST_MODE,
      pegasusBaseUrl: currentConfig.pegasusBaseUrl,
      credentials: {
        pegasus1TokenConfigured: credentials.pegasus1TokenConfigured,
        pegasus256TokenConfigured: credentials.pegasus256TokenConfigured,
        qservicesTokenConfigured: credentials.qservicesTokenConfigured,
        deviceLookupAvailable: credentials.deviceLookupAvailable,
        simLookupAvailable: credentials.simLookupAvailable,
        installationSearchAvailable: credentials.installationSearchAvailable,
      },
    });
  });

  /** Configuration-only diagnostics; no upstream Pegasus calls. */
  router.get("/health/credentials", authenticateToken, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      ...buildPegasusCredentialDiagnostics(currentConfig, ENVIRONMENT),
    });
  });

  router.get("/health/pegasus", authenticateToken, async (req, res) => {
    const credentials = buildPegasusCredentialDiagnostics(currentConfig, ENVIRONMENT);

    if (!credentials.qservicesTokenConfigured) {
      return res.status(503).json({
        success: false,
        check: "qservices",
        code: "qservices_token_missing",
        message: missingQservicesTokenMessage(ENVIRONMENT),
        credentials: {
          pegasus1TokenConfigured: credentials.pegasus1TokenConfigured,
          pegasus256TokenConfigured: credentials.pegasus256TokenConfigured,
          qservicesTokenConfigured: false,
          deviceLookupAvailable: credentials.deviceLookupAvailable,
          simLookupAvailable: credentials.simLookupAvailable,
          installationSearchAvailable: false,
        },
        pegasusUrl: currentConfig.pegasusBaseUrl,
        timestamp: credentials.timestamp,
      });
    }

    try {
      const startTime = Date.now();
      const healthResp = await pegasus.qservicesGet(
        "health-pegasus",
        "/health",
        10000
      );

      const responseTime = Date.now() - startTime;

      res.json({
        success: healthResp.ok,
        check: "qservices",
        message: "Live probe against qservices /health (Bearer token only).",
        status: healthResp.status,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        pegasusUrl: currentConfig.pegasusBaseUrl,
        credentials: {
          pegasus1TokenConfigured: credentials.pegasus1TokenConfigured,
          pegasus256TokenConfigured: credentials.pegasus256TokenConfigured,
          qservicesTokenConfigured: credentials.qservicesTokenConfigured,
          deviceLookupAvailable: credentials.deviceLookupAvailable,
          simLookupAvailable: credentials.simLookupAvailable,
          installationSearchAvailable: credentials.installationSearchAvailable,
        },
      });
    } catch (err) {
      res.status(503).json({
        success: false,
        check: "qservices",
        error: err.name || "UnknownError",
        message: err.message,
        timestamp: new Date().toISOString(),
        pegasusUrl: currentConfig.pegasusBaseUrl,
        credentials: {
          pegasus1TokenConfigured: credentials.pegasus1TokenConfigured,
          pegasus256TokenConfigured: credentials.pegasus256TokenConfigured,
          qservicesTokenConfigured: credentials.qservicesTokenConfigured,
          deviceLookupAvailable: credentials.deviceLookupAvailable,
          simLookupAvailable: credentials.simLookupAvailable,
          installationSearchAvailable: credentials.installationSearchAvailable,
        },
      });
    }
  });

  return router;
}

module.exports = { registerHealthz, createApiMetaRouter };
