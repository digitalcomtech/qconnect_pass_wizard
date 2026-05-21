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
const { readQservicesJson } = require("../services/pegasus/qservices-response");

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
      const installPath = "/installations/api/v1/installation";
      const upstream = pegasus.stripUrlForLog(pegasus.qservicesRequestUrl(installPath));
      const healthResp = await pegasus.qservicesGet(
        "health-pegasus",
        installPath,
        10000
      );

      const parsed = await readQservicesJson(healthResp, {
        upstream,
        context: "health-pegasus",
      });

      const responseTime = Date.now() - startTime;
      const pegasusHealthy =
        parsed.ok && healthResp.ok && Array.isArray(parsed.data);

      res.json({
        success: pegasusHealthy,
        check: "qservices",
        message: pegasusHealthy
          ? "Live probe against qservices installations API (Bearer, JSON array)."
          : parsed.ok
            ? `Pegasus returned HTTP ${healthResp.status} (expected JSON array).`
            : parsed.error.message,
        code: parsed.ok ? undefined : parsed.error.code,
        upstream,
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
