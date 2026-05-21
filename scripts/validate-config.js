#!/usr/bin/env node
/**
 * Validates environment + config for the active ENVIRONMENT (from process.env / config.js).
 * Safe to run locally or in CI before deploy (does not start the server).
 *
 * Usage: node scripts/validate-config.js
 *   NODE_ENV=production node scripts/validate-config.js
 */

"use strict";

let config;
try {
  config = require("../config");
} catch (e) {
  console.error("FAIL: Could not load config.js — copy config.example.js to config.js.");
  process.exit(1);
}

const errors = [];
const warnings = [];
const isProd = process.env.NODE_ENV === "production";
const env = config.ENVIRONMENT === "production" ? "production" : "qa";
const cc = env === "production" ? config.production : config.qa;

function addError(msg) {
  errors.push(msg);
}
function addWarn(msg) {
  warnings.push(msg);
}

if (isProd) {
  if (!process.env.JWT_SECRET) addError("NODE_ENV=production requires JWT_SECRET");
  if (!process.env.SESSION_SECRET) addError("NODE_ENV=production requires SESSION_SECRET");
  const prefix = env === "production" ? "PROD" : "QA";
  if (!cc.pegasus1Token) addError(`${prefix}_PEGASUS1_TOKEN must be set (non-empty) for ENVIRONMENT=${env}`);
  if (!cc.pegasus256Token) addError(`${prefix}_PEGASUS256_TOKEN must be set (non-empty)`);
  if (!cc.pegasusToken) {
    addWarn(
      `${prefix}_PEGASUS_TOKEN unset — installation search/confirm (qservices Bearer) unavailable; IMEI/SIM may still work`
    );
  }
} else {
  const prefix = env === "production" ? "PROD" : "QA";
  if (!cc.pegasusToken) {
    addWarn(
      `qservices Bearer empty for ${env} — installation search will 401 until ${prefix}_PEGASUS_TOKEN is set`
    );
  }
  if (!cc.pegasus1Token) {
    addWarn(`${prefix}_PEGASUS1_TOKEN unset — device/IMEI lookup unavailable`);
  }
  if (!process.env.JWT_SECRET) {
    addWarn("JWT_SECRET unset — dev-only JWT fallback will be used (see auth.js)");
  }
  if (!process.env.SESSION_SECRET) {
    addWarn("SESSION_SECRET unset — dev-only session fallback will be used");
  }
}

if (config.allowDangerousPegasusConfirmationFallback === true) {
  addWarn(
    "DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK=true — confirm-installation may return success without Pegasus (unsafe)"
  );
}

if (process.env.ENABLE_CONFIRMATION_FALLBACK === "true" && !config.allowDangerousPegasusConfirmationFallback) {
  addWarn("ENABLE_CONFIRMATION_FALLBACK is set but ignored — remove to avoid confusion");
}

if (config.TEST_MODE === true) {
  addWarn("TEST_MODE=true — Pegasus calls are skipped in several endpoints");
}

console.log("--- validate-config ---");
console.log("ENVIRONMENT:", env, "| NODE_ENV:", process.env.NODE_ENV || "(unset)");
console.log("pegasusBaseUrl:", cc.pegasusBaseUrl || "(missing)");

warnings.forEach((w) => console.warn("WARN:", w));
errors.forEach((e) => console.error("ERROR:", e));

if (errors.length) {
  console.error(`\nExiting 1 (${errors.length} error(s)). See docs/ENVIRONMENT.md`);
  process.exit(1);
}

console.log("\nOK — no blocking errors.");
if (warnings.length) console.log(`(${warnings.length} warning(s) above)`);
process.exit(0);
