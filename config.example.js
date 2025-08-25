/**
 * Configuration template for QConnect PASS Wizard
 * Copy this file to config.js and update with your actual values
 */

module.exports = {
  // Environment selection: "production" or "qa"
  ENVIRONMENT: "production",
  
  // Test mode (set to true for testing without making actual API calls)
  TEST_MODE: false,
  
  // Enable fallback modes when Pegasus is unavailable
  ENABLE_CONFIRMATION_FALLBACK: true,
  
  // Production environment configuration
  production: {
    // Main Pegasus services
    pegasusBaseUrl: "https://qservices.pegasusgateway.com",
    pegasusToken: "your-production-pegasus-token-here",
    
    // Pegasus instance tokens for SIM management
    pegasus1Token: "your-pegasus1-token-here",
    pegasus256Token: "your-pegasus256-token-here",
    
    // Legacy Zapier hooks (kept for reference, no longer used)
    zapierHookInstall: "https://hooks.zapier.com/hooks/catch/21949880/uyym1m7/",
    zapierHookSecondary: "your-secondary-zapier-hook-here"
  },
  
  // QA/Testing environment configuration
  qa: {
    // Main Pegasus services (QA)
    pegasusBaseUrl: "https://qservices.pegasusgateway.com/qa",
    pegasusToken: "your-qa-pegasus-token-here",
    
    // Pegasus instance tokens for SIM management (QA)
    pegasus1Token: "your-pegasus1-token-here",
    pegasus256Token: "your-qa-pegasus256-token-here",
    
    // Legacy Zapier hooks (QA)
    zapierHookInstall: "https://hooks.zapier.com/hooks/catch/21949880/u6nixws/",
    zapierHookSecondary: "your-qa-secondary-zapier-hook-here"
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 8080,
    host: "0.0.0.0"
  },
  
  // API timeouts and retry configuration
  api: {
    timeout: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second initial delay
    retryMultiplier: 2 // Exponential backoff multiplier
  },
  
  // Installation workflow configuration
  workflow: {
    // Proximity check radius in meters
    proximityRadius: 200,
    
    // Maximum time to wait for device reporting (milliseconds)
    maxDeviceWaitTime: 30 * 60 * 1000, // 30 minutes
    
    // Initial polling interval (milliseconds)
    initialPollInterval: 10000, // 10 seconds
    
    // Maximum polling interval (milliseconds)
    maxPollInterval: 120000 // 2 minutes
  },
  
  // SIM card configuration
  sim: {
    // SuperSIM prefix
    superSimPrefix: "8988",
    
    // Wireless SIM prefix
    wirelessSimPrefix: "8901",
    
    // API endpoints for different SIM types
    endpoints: {
      superSim: "https://api.pegasusgateway.com/m2m/supersims/v1/Sims",
      wireless: "https://api.pegasusgateway.com/m2m/wireless/v1/Sims"
    }
  },
  
  // Pegasus API endpoints
  pegasus: {
    baseUrl: "https://api.pegasusgateway.com",
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
