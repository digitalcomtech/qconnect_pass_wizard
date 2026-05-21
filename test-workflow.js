#!/usr/bin/env node
/**
 * Authenticated smoke checks against a running installer-app server.
 * Read-only by default (no install / confirm / SIM mutations).
 *
 * Usage:
 *   npm run smoke
 *   WIZARD_BASE_URL=http://127.0.0.1:3000 npm run smoke
 *   WIZARD_SMOKE_USER=admin WIZARD_SMOKE_PASSWORD=admin123 npm run smoke
 *
 * Requires: server running, valid JWT credentials (default installer/installer123).
 */

"use strict";

const fetch = require("node-fetch");

const BASE = (
  process.env.WIZARD_BASE_URL ||
  process.argv.find((a) => /^https?:\/\//.test(a)) ||
  "http://localhost:8080"
).replace(/\/$/, "");

const USER = process.env.WIZARD_SMOKE_USER || "installer";
const PASS = process.env.WIZARD_SMOKE_PASSWORD || "installer123";

const UPSTREAM_SKIP_STATUSES = new Set([401, 403, 502, 503]);

async function req(name, url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${name} → HTTP ${res.status} ${text.slice(0, 280)}`);
  }
  return parseBody(res, text);
}

async function reqOrSkipUpstream(name, url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok && UPSTREAM_SKIP_STATUSES.has(res.status)) {
    console.warn(`SKIP ${name}: HTTP ${res.status} (Pegasus credentials or upstream unavailable)`);
    return null;
  }
  if (!res.ok) {
    throw new Error(`${name} → HTTP ${res.status} ${text.slice(0, 280)}`);
  }
  return parseBody(res, text);
}

function parseBody(res, text) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

async function main() {
  require("./scripts/test-install-response-normalize").runInstallResponseNormalizeTests();

  console.log("--- smoke (authenticated) ---");
  console.log("BASE:", BASE);
  console.log("User:", USER);
  console.log("");

  const healthz = await req("GET /healthz", `${BASE}/healthz`);
  if (!healthz || !healthz.environment) {
    throw new Error("GET /healthz missing environment field");
  }
  console.log("healthz environment:", healthz.environment);

  const loginJson = await req(
    "POST /api/auth/login",
    `${BASE}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: USER, password: PASS }),
    }
  );

  const token =
    loginJson && typeof loginJson === "object" ? loginJson.token : null;
  if (!token) {
    throw new Error("Login response missing token (check credentials)");
  }

  const auth = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const me = await req("GET /api/auth/me", `${BASE}/api/auth/me`, {
    headers: auth,
  });
  console.log("auth/me:", me && me.user ? `${me.user.username} (${me.user.role})` : me);

  const cfg = await req("GET /api/config", `${BASE}/api/config`, {
    headers: auth,
  });
  console.log("config:", cfg && cfg.environment, "testMode=", cfg && cfg.testMode);
  if (!cfg || !cfg.credentials) {
    throw new Error("GET /api/config missing credentials block");
  }
  const c = cfg.credentials;
  console.log(
    "config.credentials:",
    "p1=",
    c.pegasus1TokenConfigured,
    "p256=",
    c.pegasus256TokenConfigured,
    "qservices=",
    c.qservicesTokenConfigured,
    "imei=",
    c.deviceLookupAvailable,
    "sim=",
    c.simLookupAvailable,
    "search=",
    c.installationSearchAvailable
  );

  const credHealth = await req("GET /api/health/credentials", `${BASE}/api/health/credentials`, {
    headers: auth,
  });
  if (
    credHealth.pegasus1TokenConfigured !== c.pegasus1TokenConfigured ||
    credHealth.installationSearchAvailable !== c.installationSearchAvailable
  ) {
    throw new Error("/api/health/credentials disagrees with /api/config");
  }
  console.log("health/credentials: ok");

  const pegHealth = await reqOrSkipUpstream(
    "GET /api/health/pegasus",
    `${BASE}/api/health/pegasus`,
    { headers: auth }
  );
  if (pegHealth) {
    console.log("pegasus health:", pegHealth.status, pegHealth.responseTime);
  }

  const search = await reqOrSkipUpstream(
    "GET /api/search-installations",
    `${BASE}/api/search-installations?query=${encodeURIComponent("__SMOKE__")}`,
    { headers: auth }
  );
  if (search) {
    console.log(
      "search-installations:",
      search.success,
      "count=",
      search.installations && search.installations.length
    );
  }

  await req(
    "GET /api/activity/summary",
    `${BASE}/api/activity/summary`,
    { headers: auth }
  );
  console.log("activity/summary: ok");

  const fakeId = "smoke-nonexistent-installation-id";
  const statusRes = await fetch(
    `${BASE}/api/installation-status/${encodeURIComponent(fakeId)}`,
    { headers: auth }
  );
  const statusText = await statusRes.text();
  console.log(
    "installation-status (expect Pegasus 404 or similar):",
    statusRes.status,
    statusText.slice(0, 120)
  );
  if (statusRes.status === 403) {
    throw new Error("installation-status returned 403 — app JWT issue");
  }
  if (statusRes.status === 401) {
    console.warn("SKIP installation-status: Pegasus upstream 401");
  }

  const verifyImeiRes = await fetch(`${BASE}/api/verify-imei`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ imei: "000000000000000" }),
  });
  const verifyImeiJson = await verifyImeiRes.json();
  const verifyImeiOk = new Set([200, 400, 404, 401]);
  if (!verifyImeiOk.has(verifyImeiRes.status)) {
    throw new Error(
      `verify-imei smoke expected 200/400/404/401, got ${verifyImeiRes.status}: ${JSON.stringify(verifyImeiJson).slice(0, 120)}`
    );
  }
  if (verifyImeiRes.status === 500) {
    throw new Error("verify-imei returned 500");
  }
  console.log("verify-imei (fake IMEI):", verifyImeiRes.status, verifyImeiJson.message || "");

  const badSimRes = await fetch(`${BASE}/api/verify-sim`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ iccid: "1234567890" }),
  });
  const badSimJson = await badSimRes.json();
  if (badSimRes.status !== 400) {
    throw new Error(`verify-sim invalid prefix expected 400, got ${badSimRes.status}`);
  }
  console.log("verify-sim (bad prefix):", badSimRes.status, badSimJson.message || "");

  const fakeSimRes = await fetch(`${BASE}/api/verify-sim`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ iccid: "8988000000000000000" }),
  });
  const fakeSimJson = await fakeSimRes.json();
  const fakeSimOk = new Set([200, 404, 401]);
  if (!fakeSimOk.has(fakeSimRes.status)) {
    throw new Error(
      `verify-sim fake ICCID expected 200/404/401, got ${fakeSimRes.status}: ${JSON.stringify(fakeSimJson).slice(0, 120)}`
    );
  }
  if (fakeSimRes.status === 500) {
    throw new Error("verify-sim returned 500");
  }
  console.log(
    "verify-sim (fake SuperSIM):",
    fakeSimRes.status,
    fakeSimJson.simData && fakeSimJson.simData.foundIn
      ? `foundIn=${fakeSimJson.simData.foundIn}`
      : fakeSimJson.message || ""
  );

  const dryRunBadRes = await fetch(`${BASE}/api/install/dry-run`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({}),
  });
  const dryRunBadJson = await dryRunBadRes.json();
  if (dryRunBadRes.status !== 400) {
    throw new Error(
      `install/dry-run empty body expected 400, got ${dryRunBadRes.status}: ${JSON.stringify(dryRunBadJson).slice(0, 160)}`
    );
  }
  const dryRunFlag =
    (dryRunBadJson.details && dryRunBadJson.details.dryRun) ||
    (dryRunBadJson.context && dryRunBadJson.context.dryRun);
  if (!dryRunFlag) {
    throw new Error("install/dry-run validation response missing dryRun flag");
  }
  console.log("install/dry-run (validation):", dryRunBadRes.status, dryRunBadJson.code || "");

  const dryRunNoAuthRes = await fetch(`${BASE}/api/install/dry-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "smoke",
      imei: "000000000000000",
      vin: "SMOKEVIN",
      installationId: "smoke-id",
    }),
  });
  if (dryRunNoAuthRes.status !== 401 && dryRunNoAuthRes.status !== 403) {
    throw new Error(
      `install/dry-run without auth expected 401/403, got ${dryRunNoAuthRes.status}`
    );
  }
  console.log("install/dry-run (no auth):", dryRunNoAuthRes.status);

  console.log("");
  console.log("OK — smoke finished (read-only). No /api/install or confirm calls.");
}

if (require.main === module) {
  main().catch((e) => {
    console.error("SMOKE FAIL:", e.message);
    process.exit(1);
  });
}

module.exports = { main, testWorkflow: main };
