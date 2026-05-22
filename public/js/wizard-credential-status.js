// Pegasus credential / token status (no secrets)

function formatPegasusApiError(resp, data, context) {
  const code = data && data.code;
  const status = resp && resp.status;

  if (code === "qservices_token_expired" || (context === "search" && status === 401)) {
    return "qservices token expired. Run npm run pegasus:fetch-tokens and restart the server.";
  }
  if (code === "qservices_token_missing" || (context === "search" && status === 503)) {
    return (
      (data && data.message) ||
      "qservices token not configured. Run npm run pegasus:fetch-tokens and restart the server."
    );
  }
  if (code === "pegasus1_token_expired" || (context === "imei" && status === 401)) {
    return "Pegasus1 token expired. Run npm run pegasus:fetch-tokens and restart the server.";
  }
  if (
    code === "pegasus_sim_token_expired" ||
    (context === "sim" && status === 401)
  ) {
    return "Pegasus1/Pegasus256 token expired. Run npm run pegasus:fetch-tokens and restart the server.";
  }
  if (data && data.message) return data.message;
  if (resp && resp.status) return `Request failed: HTTP ${resp.status}`;
  return "Request failed";
}

function summarizeCredentialHealth(cred) {
  if (!cred || !cred.tokens) return null;
  const problems = [];
  const t = cred.tokens;
  if (t.qservices && t.qservices.configured && !t.qservices.live) {
    problems.push(
      t.qservices.state === "expired" ? "qservices token expired" : "qservices token not live"
    );
  } else if (t.qservices && !t.qservices.configured) {
    problems.push("qservices token missing");
  }
  if (t.pegasus1 && t.pegasus1.configured && !t.pegasus1.live) {
    problems.push(
      t.pegasus1.state === "expired" ? "Pegasus1 token expired" : "Pegasus1 token not live"
    );
  }
  if (t.pegasus256 && t.pegasus256.configured && !t.pegasus256.live) {
    problems.push(
      t.pegasus256.state === "expired"
        ? "Pegasus256 token expired"
        : "Pegasus256 token not live"
    );
  }
  return problems;
}

async function refreshHeaderCredentialStatus() {
  const el = document.getElementById("headerCredentialStatus");
  if (!el) return;

  try {
    const resp = await fetch("/api/health/credentials", { headers: getAuthHeaders() });
    const cred = await resp.json();
    const problems = summarizeCredentialHealth(cred);
    if (!problems || !problems.length) {
      el.textContent = "Pegasus tokens: live";
      el.className = "header-credential-status header-credential-ok";
      el.hidden = false;
      return;
    }
    el.textContent = problems.join(" · ");
    el.className = "header-credential-status header-credential-warn";
    el.title = cred.tokenRefreshHint || "Run npm run pegasus:fetch-tokens and restart the server.";
    el.hidden = false;
  } catch (err) {
    console.warn("Credential status check failed:", err);
    el.hidden = true;
  }
}

window.formatPegasusApiError = formatPegasusApiError;
window.refreshHeaderCredentialStatus = refreshHeaderCredentialStatus;
