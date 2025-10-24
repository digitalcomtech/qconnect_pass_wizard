/**
 * Configuration for QConnect PASS Wizard - Production Environment
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
    pegasusToken: "2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824",
    
    // Default group IDs for vehicle creation
    defaultGroupId: 3367,    // Primary devices group
    defaultGroupId2: 4126,  // Secondary devices group
    
    // Pegasus instance tokens for SIM management
    pegasus1Token: "8702ee591a35dab8726f76784de9968e1539ec8c660b880c9024d0c3",
    pegasus256Token: "2f2df11d24bba3d071c22ca1c54f42dd64dda64e6bddfe9e6f3cc824",
    
    // SIM Account SIDs for Production environment
    simAccountSid: process.env.PROD_SIM_ACCOUNT_SID,
    simRatePlanSid: "WPb9eea023c56926557654c04d25156d12",
    simFleetSid: "HF2066f759aa2a2d4347fe21f1139b41b5",
    
    // Legacy Zapier hooks (kept for reference, no longer used)
    zapierHookInstall: "https://hooks.zapier.com/hooks/catch/21949880/uyym1m7/",
    zapierHookSecondary: "your-secondary-zapier-hook-here"
  },
  

  
  // QA/Testing environment configuration
  qa: {
    // Main Pegasus services (QA)
    pegasusBaseUrl: "https://qservices.pegasusgateway.com/qa",
    pegasusToken: "cfe06b66972326270ae9d3420336379b9d5176ab424acd417330cc02",
    
    // Default group IDs for vehicle creation (QA)
    defaultGroupId: 3441,    // Primary devices group (QA)
    defaultGroupId2: 3442,  // Secondary devices group (QA)
    
    // Pegasus instance tokens for SIM management (QA)
    pegasus1Token: "8702ee591a35dab8726f76784de9968e1539ec8c660b880c9024d0c3",
    pegasus256Token: "cfe06b66972326270ae9d3420336379b9d5176ab424acd417330cc02",
    
    // SIM Account SIDs for QA environment (Pegasus53)
    simAccountSid: process.env.QA_SIM_ACCOUNT_SID,
    simRatePlanSid: "WP8c317c6831cf8cbc311d776b2e1ace2f", // 5MB PAYG US/INTL-ROAMING + SMS
    simFleetSid: "HF2066f759aa2a2d4347fe21f1139b41b5",
    
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
