// Server-side dry-run (POST /api/install/dry-run) — no Pegasus mutations.

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderServerDryRunResult(data) {
  const panel = document.getElementById("serverDryRunPanel");
  if (!panel) return;

  if (!data) {
    panel.innerHTML = "";
    panel.classList.add("hidden");
    return;
  }

  const steps = (data.details && data.details.steps) || [];
  const warnings = (data.details && data.details.warnings) || [];
  const errors = (data.details && data.details.errors) || [];
  const ok = data.success === true || data.status === "success";

  let html = '<div class="server-dry-run-inner">';
  html += '<p class="server-dry-run-tag">Server dry-run · no mutation</p>';
  html +=
    '<p class="server-dry-run-summary ' +
    (ok ? "server-dry-run-ok" : "server-dry-run-fail") +
    '">' +
    escapeHtml(data.message || (ok ? "Dry-run OK" : "Dry-run failed")) +
    "</p>";

  if (steps.length) {
    html += '<ol class="server-dry-run-steps">';
    steps.forEach(function (s) {
      html +=
        "<li><strong>" +
        escapeHtml(s.label || s.id) +
        "</strong> [" +
        escapeHtml(s.status) +
        "] " +
        escapeHtml(s.message || "") +
        "</li>";
    });
    html += "</ol>";
  }

  if (warnings.length) {
    html += '<ul class="server-dry-run-warn">';
    warnings.forEach(function (w) {
      html += "<li>" + escapeHtml(w) + "</li>";
    });
    html += "</ul>";
  }

  if (errors.length) {
    html += '<ul class="server-dry-run-err">';
    errors.forEach(function (e) {
      html += "<li>" + escapeHtml(e.message || e.code) + "</li>";
    });
    html += "</ul>";
  }

  html += "</div>";
  panel.innerHTML = html;
  panel.classList.remove("hidden");
}

async function onServerDryRun() {
  const statusEl = document.getElementById("serverDryRunStatus");
  if (statusEl) statusEl.textContent = "Running server dry-run…";

  const payload =
    typeof buildInstallRequestPayload === "function"
      ? buildInstallRequestPayload()
      : null;

  if (!payload || !payload.client_name || !payload.imei || !payload.vin || !payload.installationId) {
    if (statusEl) {
      statusEl.textContent =
        "Complete search, VIN, and primary IMEI before server dry-run.";
    }
    renderServerDryRunResult(null);
    return;
  }

  try {
    const resp = await fetch("/api/install/dry-run", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    renderServerDryRunResult(data);
    if (statusEl) {
      statusEl.textContent = data.success
        ? "Server dry-run complete (no mutations)."
        : "Server dry-run reported issues — review below.";
    }
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Server dry-run failed: " + err.message;
    renderServerDryRunResult(null);
  }
}

window.onServerDryRun = onServerDryRun;
window.renderServerDryRunResult = renderServerDryRunResult;
