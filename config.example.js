/**
 * Application configuration — copy to `config.js` or keep in sync.
 * Secrets MUST come from environment variables. Never commit real tokens.
 *
 * Production (NODE_ENV=production): JWT_SECRET, SESSION_SECRET, and the
 * Pegasus tokens for the active ENVIRONMENT are required (see docs/ENVIRONMENT.md).
 */

function parseIntEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  ENVIRONMENT: process.env.ENVIRONMENT === "production" ? "production" : "qa",

  TEST_MODE: process.env.TEST_MODE === "true",

  /**
   * When true, /api/confirm-installation may return HTTP 200 with success:true
   * if Pegasus is unreachable — the install is NOT confirmed upstream.
   * Requires env DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK=true (see docs/KNOWN_ISSUES.md).
   */
  allowDangerousPegasusConfirmationFallback:
    process.env.DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK === "true",

  production: {
    pegasusBaseUrl:
      process.env.PROD_PEGASUS_BASE_URL || "https://qservices.pegasusgateway.com",
    pegasusToken: process.env.PROD_PEGASUS_TOKEN || "",
    defaultGroupId: parseIntEnv("PROD_DEFAULT_GROUP_ID", 3367),
    defaultGroupId2: parseIntEnv("PROD_DEFAULT_GROUP_ID2", 4126),
    pegasus1Token: process.env.PROD_PEGASUS1_TOKEN || "",
    pegasus256Token: process.env.PROD_PEGASUS256_TOKEN || "",
    simAccountSid: process.env.PROD_SIM_ACCOUNT_SID,
    simRatePlanSid:
      process.env.PROD_SIM_RATE_PLAN_SID || "WPb9eea023c56926557654c04d25156d12",
    simFleetSid:
      process.env.PROD_SIM_FLEET_SID || "HF2066f759aa2a2d4347fe21f1139b41b5",
  },

  qa: {
    pegasusBaseUrl:
      process.env.QA_PEGASUS_BASE_URL || "https://qservices.pegasusgateway.com/qa",
    pegasusToken: process.env.QA_PEGASUS_TOKEN || "",
    defaultGroupId: parseIntEnv("QA_DEFAULT_GROUP_ID", 3441),
    defaultGroupId2: parseIntEnv("QA_DEFAULT_GROUP_ID2", 3442),
    pegasus1Token: process.env.QA_PEGASUS1_TOKEN || "",
    pegasus256Token: process.env.QA_PEGASUS256_TOKEN || "",
    simAccountSid: process.env.QA_SIM_ACCOUNT_SID,
    simRatePlanSid:
      process.env.QA_SIM_RATE_PLAN_SID || "WP8c317c6831cf8cbc311d776b2e1ace2f",
    simFleetSid:
      process.env.QA_SIM_FLEET_SID || "HF2066f759aa2a2d4347fe21f1139b41b5",
  },

  server: {
    port: parseIntEnv("PORT", 8080),
    host: process.env.HOST || "0.0.0.0",
  },

  api: {
    timeout: parseIntEnv("API_TIMEOUT", 30000),
    maxRetries: parseIntEnv("API_MAX_RETRIES", 3),
    retryDelay: parseIntEnv("API_RETRY_DELAY", 1000),
    retryMultiplier: parseFloat(process.env.API_RETRY_MULTIPLIER) || 2,
  },

  workflow: {
    proximityRadius: parseIntEnv("PROXIMITY_RADIUS", 200),
    maxDeviceWaitTime: parseIntEnv("MAX_DEVICE_WAIT_TIME", 30 * 60 * 1000),
    initialPollInterval: parseIntEnv("INITIAL_POLL_INTERVAL", 10000),
    maxPollInterval: parseIntEnv("MAX_POLL_INTERVAL", 120000),
  },

  sim: {
    superSimPrefix: process.env.SIM_SUPER_PREFIX || "8988",
    wirelessSimPrefix: process.env.SIM_WIRELESS_PREFIX || "8901",
    endpoints: {
      superSim:
        process.env.SIM_SUPER_ENDPOINT ||
        "https://api.pegasusgateway.com/m2m/supersims/v1/Sims",
      wireless:
        process.env.SIM_WIRELESS_ENDPOINT ||
        "https://api.pegasusgateway.com/m2m/wireless/v1/Sims",
    },
  },

  pegasus: {
    baseUrl: process.env.PEGASUS_BASE_URL || "https://api.pegasusgateway.com",
    endpoints: {
      groups: "/groups",
      vehicles: "/vehicles",
      devices: "/devices",
      installations: "/installations/api/v1/installation",
    },
  },
};
