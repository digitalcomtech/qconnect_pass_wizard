/**
 * Liveness + read-only app/Pegasus meta endpoints.
 * - registerHealthz(app) must run before express-session (no cookie dependency).
 * - createApiMetaRouter() mounts at /api → /config, /health/pegasus
 */
const express = require("express");

function registerHealthz(app) {
  app.get("/healthz", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      status: "ok",
      service: "installer-app",
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
    res.json({
      environment: ENVIRONMENT,
      testMode: TEST_MODE,
      pegasusBaseUrl: currentConfig.pegasusBaseUrl,
      // pegasusToken intentionally not exposed to frontend
    });
  });

  router.get("/health/pegasus", authenticateToken, async (req, res) => {
    try {
      const startTime = Date.now();
      const healthResp = await pegasus.qservicesGet(
        "health-pegasus",
        "/health",
        10000
      );

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        status: healthResp.status,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        pegasusUrl: currentConfig.pegasusBaseUrl,
      });
    } catch (err) {
      res.status(503).json({
        success: false,
        error: err.name || "UnknownError",
        message: err.message,
        timestamp: new Date().toISOString(),
        pegasusUrl: currentConfig.pegasusBaseUrl,
      });
    }
  });

  return router;
}

module.exports = { registerHealthz, createApiMetaRouter };
