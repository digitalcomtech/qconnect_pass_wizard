/**
 * Liveness + read-only app/Pegasus meta endpoints.
 * - registerHealthz(app) must run before express-session (no cookie dependency).
 * - createApiMetaRouter() mounts at /api → /config, /health/credentials, /health/pegasus
 */
const express = require("express");
const {
  buildPegasusCredentialDiagnostics,
  buildPegasusCredentialDiagnosticsWithLive,
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

  function credentialsSummary(credentials) {
    return {
      pegasus1TokenConfigured: credentials.pegasus1TokenConfigured,
      pegasus256TokenConfigured: credentials.pegasus256TokenConfigured,
      qservicesTokenConfigured: credentials.qservicesTokenConfigured,
      pegasus1TokenLive: credentials.pegasus1TokenLive,
      pegasus256TokenLive: credentials.pegasus256TokenLive,
      qservicesTokenLive: credentials.qservicesTokenLive,
      deviceLookupAvailable: credentials.deviceLookupAvailable,
      simLookupAvailable: credentials.simLookupAvailable,
      installationSearchAvailable: credentials.installationSearchAvailable,
      tokens: credentials.tokens,
      tokenRefreshHint: credentials.tokenRefreshHint,
    };
  }

  router.get("/config", authenticateToken, async (req, res) => {
    try {
      const credentials = await buildPegasusCredentialDiagnosticsWithLive(
        currentConfig,
        ENVIRONMENT,
        pegasus
      );
      res.json({
        environment: ENVIRONMENT,
        testMode: TEST_MODE,
        pegasusBaseUrl: currentConfig.pegasusBaseUrl,
        credentials: credentialsSummary(credentials),
      });
    } catch (err) {
      const credentials = buildPegasusCredentialDiagnostics(currentConfig, ENVIRONMENT);
      res.json({
        environment: ENVIRONMENT,
        testMode: TEST_MODE,
        pegasusBaseUrl: currentConfig.pegasusBaseUrl,
        credentials: credentialsSummary(credentials),
        credentialsProbeError: err.message,
      });
    }
  });

  /** Credential diagnostics with live upstream probes (no secrets). */
  router.get("/health/credentials", authenticateToken, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const credentials = await buildPegasusCredentialDiagnosticsWithLive(
        currentConfig,
        ENVIRONMENT,
        pegasus
      );
      const allLive =
        credentials.tokens.qservices.live &&
        credentials.tokens.pegasus1.live &&
        credentials.tokens.pegasus256.live;
      res.json({
        success: allLive,
        ...credentials,
      });
    } catch (err) {
      res.status(503).json({
        success: false,
        message: err.message,
        ...buildPegasusCredentialDiagnostics(currentConfig, ENVIRONMENT),
      });
    }
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
