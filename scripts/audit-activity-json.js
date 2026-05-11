#!/usr/bin/env node
/**
 * Audits data/activities.json for duplicate sessionIds, malformed rows, and stale in_progress sessions.
 *
 * Usage:
 *   node scripts/audit-activity-json.js
 *   ACTIVITY_STALE_HOURS=72 node scripts/audit-activity-json.js
 *   node scripts/audit-activity-json.js --strict   # exit 1 if duplicates or malformed rows exist
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ACT = path.join(ROOT, "data", "activities.json");
const staleHours = parseInt(process.env.ACTIVITY_STALE_HOURS, 10);
const STALE_MS = (Number.isFinite(staleHours) ? staleHours : 168) * 3600 * 1000;
const strict = process.argv.includes("--strict");

let rows = [];
if (!fs.existsSync(ACT)) {
  console.log("--- audit-activity-json ---");
  console.log("No file:", ACT, "(nothing to audit)");
  process.exit(0);
}

try {
  rows = JSON.parse(fs.readFileSync(ACT, "utf8"));
  if (!Array.isArray(rows)) throw new Error("root JSON must be an array");
} catch (e) {
  console.error("FAIL: cannot parse activities.json:", e.message);
  process.exit(1);
}

const requiredStepKeys = [
  "clientSelection",
  "vinSelection",
  "deviceSetup",
  "locationCheck",
  "formCompletion",
  "finalConfirmation",
];

const idCounts = new Map();
const malformed = [];
const stale = [];
const now = Date.now();

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const label = `row[${i}]`;

  if (!row || typeof row !== "object") {
    malformed.push(`${label}: not an object`);
    continue;
  }
  if (!row.sessionId || typeof row.sessionId !== "string") {
    malformed.push(`${label}: missing sessionId`);
  } else {
    idCounts.set(row.sessionId, (idCounts.get(row.sessionId) || 0) + 1);
  }
  if (typeof row.userId !== "number") malformed.push(`${label}: userId not a number`);
  if (!row.status) malformed.push(`${label}: missing status`);
  if (!row.steps || typeof row.steps !== "object") {
    malformed.push(`${label}: missing steps object`);
  } else {
    for (const k of requiredStepKeys) {
      if (!(k in row.steps)) malformed.push(`${label}: steps missing key "${k}"`);
    }
  }

  if (row.status === "in_progress" && row.startTime) {
    const t = new Date(row.startTime).getTime();
    if (Number.isFinite(t) && now - t > STALE_MS) {
      stale.push({
        sessionId: row.sessionId,
        userId: row.userId,
        username: row.username,
        startTime: row.startTime,
        ageHours: Math.round((now - t) / 3600000),
      });
    }
  }
}

const duplicateIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id, n]) => ({ sessionId: id, count: n }));

console.log("--- audit-activity-json ---");
console.log("File:", ACT);
console.log("Rows:", rows.length);
console.log("Stale threshold: in_progress older than", STALE_MS / 3600000, "hours");
console.log("");

console.log("Duplicate sessionId values:", duplicateIds.length ? duplicateIds.length : 0);
duplicateIds.forEach((d) => console.log(" ", d));

console.log("");
console.log("Malformed / schema issues:", malformed.length ? malformed.length : 0);
malformed.slice(0, 40).forEach((m) => console.log(" ", m));
if (malformed.length > 40) console.log(`  … and ${malformed.length - 40} more`);

console.log("");
console.log("Stale in_progress sessions:", stale.length);
stale.slice(0, 25).forEach((s) => console.log(" ", s));
if (stale.length > 25) console.log(`  … and ${stale.length - 25} more`);

const bad = duplicateIds.length > 0 || malformed.length > 0;

if (strict && stale.length && process.argv.includes("--fail-on-stale")) {
  console.error("\nStrict + --fail-on-stale: exiting 1 due to stale sessions");
  process.exit(1);
}
if (strict && bad) {
  console.error("\nStrict: exiting 1 due to duplicates or malformed rows");
  process.exit(1);
}

console.log("");
console.log("Done (exit 0). Use --strict to fail on duplicates/malformed; add --fail-on-stale for stale in_progress.");
process.exit(0);
