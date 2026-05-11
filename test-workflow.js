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

async function req(name, url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${name} → HTTP ${res.status} ${text.slice(0, 280)}`);
  }
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
  console.log("--- smoke (authenticated) ---");
  console.log("BASE:", BASE);
  console.log("User:", USER);
  console.log("");

  await req("GET /healthz", `${BASE}/healthz`);

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

  const pegHealth = await req(
    "GET /api/health/pegasus",
    `${BASE}/api/health/pegasus`,
    { headers: auth }
  );
  console.log("pegasus health:", pegHealth && pegHealth.status, pegHealth && pegHealth.responseTime);

  const search = await req(
    "GET /api/search-installations",
    `${BASE}/api/search-installations?query=${encodeURIComponent("__SMOKE__")}`,
    { headers: auth }
  );
  console.log(
    "search-installations:",
    search && search.success,
    "count=",
    search && search.installations && search.installations.length
  );

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
  if (statusRes.status === 401 || statusRes.status === 403) {
    throw new Error("installation-status returned auth error — token issue");
  }

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
