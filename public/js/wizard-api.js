// App environment config from /api/config (shared global appConfig)
var appConfig = null;

async function loadAppConfig() {
  try {
    const resp = await fetch("/api/config", {
      headers: getAuthHeaders()
    });
    appConfig = await resp.json();
    console.log(`🔧 Frontend loaded ${appConfig.environment.toUpperCase()} environment config`);
    
    // Update page title and sidebar indicator to show environment
    const envIndicator = document.getElementById("sidebarEnvironment");
    const contentH1 = document.querySelector(".content-container h1");
    
    const appTitle = "PASS Provisioning Console";

    if (appConfig.environment === "qa") {
      document.title = appTitle + " (QA)";
      if (contentH1) contentH1.textContent = appTitle + " (QA)";
      if (envIndicator) {
        envIndicator.textContent = "QA";
        envIndicator.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
        envIndicator.style.boxShadow = "0 2px 6px rgba(245, 158, 11, 0.3)";
      }
    } else {
      document.title = appTitle;
      if (contentH1) contentH1.textContent = appTitle;
      if (envIndicator) {
        envIndicator.textContent = "PROD";
        envIndicator.style.background = "linear-gradient(135deg, #862BAB 0%, #6B21A8 100%)";
        envIndicator.style.boxShadow = "0 2px 6px rgba(134, 43, 171, 0.3)";
      }
    }

    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
  } catch (err) {
    console.error("Failed to load app config:", err);
    // Fallback to production config
    appConfig = {
      environment: "production",
      testMode: false,
      pegasusBaseUrl: "https://qservices.pegasusgateway.com",
      pegasusToken: ""
    };
  }
}
