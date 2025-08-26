/**
 * Example Configuration for QConnect PASS Wizard
 * Copy this file to config.js and fill in your actual values
 * OR use environment variables for production deployment
 */

module.exports = {
  // Environment selection: "production" or "qa"
  ENVIRONMENT: process.env.ENVIRONMENT || "qa",
  
  // Test mode (set to true for testing without making actual API calls)
  TEST_MODE: process.env.TEST_MODE === 'true' || false,
  
  // Enable fallback modes when Pegasus is unavailable
  ENABLE_CONFIRMATION_FALLBACK: process.env.ENABLE_CONFIRMATION_FALLBACK !== 'false',
  
  // Production environment configuration
  production: {
    // Main Pegasus services
    pegasusBaseUrl: process.env.PROD_PEGASUS_BASE_URL || "https://qservices.pegasusgateway.com",
    pegasusToken: process.env.PROD_PEGASUS_TOKEN || "your-production-token-here",
    
    // Pegasus instance tokens for SIM management
    pegasus1Token: process.env.PROD_PEGASUS1_TOKEN || "your-production-pegasus1-token-here",
    pegasus256Token: process.env.PROD_PEGASUS256_TOKEN || "your-production-pegasus256-token-here",
    
    // Legacy Zapier hooks (kept for reference, no longer used)
    zapierHookInstall: process.env.PROD_ZAPIER_HOOK_INSTALL || "https://hooks.zapier.com/hooks/catch/21949880/uyym1m7/",
    zapierHookSecondary: process.env.PROD_ZAPIER_HOOK_SECONDARY || "your-production-secondary-zapier-hook-here"
  },
  
  // QA/Testing environment configuration
  qa: {
    // Main Pegasus services (QA)
    pegasusBaseUrl: process.env.QA_PEGASUS_BASE_URL || "https://qservices.pegasusgateway.com/qa",
    pegasusToken: process.env.QA_PEGASUS_TOKEN || "your-qa-token-here",
    
    // Pegasus instance tokens for SIM management (QA)
    pegasus1Token: process.env.QA_PEGASUS1_TOKEN || "your-qa-pegasus1-token-here",
    pegasus256Token: process.env.QA_PEGASUS256_TOKEN || "your-qa-pegasus256-token-here",
    
    // Legacy Zapier hooks (QA)
    zapierHookInstall: process.env.QA_ZAPIER_HOOK_INSTALL || "https://hooks.zapier.com/hooks/catch/21949880/u6nixws/",
    zapierHookSecondary: process.env.QA_ZAPIER_HOOK_SECONDARY || "your-qa-secondary-zapier-hook-here"
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 8080,
    host: process.env.HOST || "0.0.0.0"
  },
  
  // API timeouts and retry configuration
  api: {
    timeout: parseInt(process.env.API_TIMEOUT) || 30000, // 30 seconds
    maxRetries: parseInt(process.env.API_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.API_RETRY_DELAY) || 1000, // 1 second initial delay
    retryMultiplier: parseFloat(process.env.API_RETRY_MULTIPLIER) || 2 // Exponential backoff multiplier
  },
  
  // Installation workflow configuration
  workflow: {
    // Proximity check radius in meters
    proximityRadius: parseInt(process.env.PROXIMITY_RADIUS) || 200,
    
    // Maximum time to wait for device reporting (milliseconds)
    maxDeviceWaitTime: parseInt(process.env.MAX_DEVICE_WAIT_TIME) || 30 * 60 * 1000, // 30 minutes
    
    // Initial polling interval (milliseconds)
    initialPollInterval: parseInt(process.env.INITIAL_POLL_INTERVAL) || 10000, // 10 seconds
    
    // Maximum polling interval (milliseconds)
    maxPollInterval: parseInt(process.env.MAX_POLL_INTERVAL) || 120000 // 2 minutes
  },
  
  // SIM card configuration
  sim: {
    // SuperSIM prefix
    superSimPrefix: process.env.SIM_SUPER_PREFIX || "8988",
    
    // Wireless SIM prefix
    wirelessSimPrefix: process.env.SIM_WIRELESS_PREFIX || "8901",
    
    // API endpoints for different SIM types
    endpoints: {
      superSim: process.env.SIM_SUPER_ENDPOINT || "https://api.pegasusgateway.com/m2m/supersims/v1/Sims",
      wireless: process.env.SIM_WIRELESS_ENDPOINT || "https://api.pegasusgateway.com/m2m/wireless/v1/Sims"
    }
  },
  
  // Pegasus API endpoints
  pegasus: {
    baseUrl: process.env.PEGASUS_BASE_URL || "https://api.pegasusgateway.com",
    endpoints: {
      groups: "/groups",
      vehicles: "/vehicles",
      devices: "/devices",
      installations: "/installations/api/v1/installation"
    }
  }
};

/**
 * IMPORTANT SECURITY NOTES:
 * 
 * 1. NEVER commit actual tokens to version control
 * 2. Use environment variables for sensitive data in production
 * 3. Rotate tokens regularly
 * 4. Use different tokens for different environments
 * 5. Monitor API usage and set up alerts for unusual activity
 * 
 * Example environment variable usage:
 * 
 * ```bash
 * export PEGASUS_TOKEN="your-actual-token"
 * export PEGASUS1_TOKEN="your-actual-pegasus1-token"
 * export PEGASUS256_TOKEN="your-actual-pegasus256-token"
 * ```
 * 
 * Then in your code:
 * 
 * ```javascript
 * pegasusToken: process.env.PEGASUS_TOKEN || "fallback-token"
 * ```
 */
