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
    const envIndicator = document.getElementById("consoleEnvironment");
    const headerH1 = document.querySelector(".console-header-left h1");

    const appTitle = "PASS Provisioning Console";

    if (appConfig.environment === "qa") {
      document.title = appTitle + " (QA)";
      if (headerH1) headerH1.textContent = appTitle;
      if (envIndicator) {
        envIndicator.textContent = "QA";
        envIndicator.style.background = "#d97706";
      }
    } else {
      document.title = appTitle;
      if (headerH1) headerH1.textContent = appTitle;
      if (envIndicator) {
        envIndicator.textContent = "PROD";
        envIndicator.style.background = "#475569";
      }
    }

    if (typeof refreshProvisioningPreview === "function") refreshProvisioningPreview();
    if (typeof refreshHeaderCredentialStatus === "function") {
      refreshHeaderCredentialStatus();
    }
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
