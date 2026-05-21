#!/usr/bin/env node
"use strict";

const assert = require("assert");
const {
  normalizeInstallResponse,
  sanitizeStepData,
} = require("../services/install/normalize-install-response");

function assertShape(body, label) {
  assert.strictEqual(typeof body.success, "boolean", label + ": success");
  assert.ok(
    ["success", "partial", "failed"].includes(body.status),
    label + ": status enum"
  );
  assert.strictEqual(typeof body.message, "string", label + ": message");
  assert.strictEqual(typeof body.timestamp, "string", label + ": timestamp");
  assert.ok(body.context && typeof body.context === "object", label + ": context");
  assert.ok(body.details && typeof body.details === "object", label + ": details");
  assert.ok(Array.isArray(body.details.steps), label + ": details.steps array");
  if (body.details.errors) {
    assert.ok(Array.isArray(body.details.errors), label + ": details.errors array");
    for (const err of body.details.errors) {
      assert.strictEqual(typeof err.message, "string", label + ": error.message");
    }
  }
}

function runInstallResponseNormalizeTests() {
// Sanitization
const sanitized = sanitizeStepData(
  {
    groupId: 1,
    token: "secret-token",
    deviceData: { huge: true },
    reason: "ok",
  },
  0
);
assert.ok(!sanitized.token, "token stripped");
assert.ok(!sanitized.deviceData, "deviceData stripped");
assert.strictEqual(sanitized.groupId, 1);

// Success (legacy orchestrator shape)
const success = normalizeInstallResponse({
  httpStatus: 200,
  environment: "qa",
  requestId: "session_test_1",
  body: {
    client_name: "Acme",
    imei: "123",
    vin: "VIN1",
    installationId: "inst-1",
    sim_number: "8988123",
  },
  json: {
    status: "success",
    message: "Complete installation workflow executed successfully",
    details: {
      groupId: 10,
      vehicleId: 20,
      simProcessed: true,
      secondaryDeviceProcessed: false,
      secondarySimProcessed: false,
      hosConfiguration: {
        primary: { configured: false, reason: "Already configured" },
        secondary: null,
      },
      steps: {
        qservicesDuplicateCheck: { ok: true, outcome: "not_duplicate" },
        repeatsRecord: { ok: true },
        group: { ok: true, groupId: 10, created: true },
        vehicle: { ok: true, vehicleId: 20 },
        primaryDeviceLink: { ok: true, imei: "123" },
        primarySim: { ok: true, action: "processed" },
        secondary: { ok: true, action: "skipped", reason: "No secondary device in request" },
        qservicesConfirmation: {
          ok: true,
          action: "not_applicable",
          reason: "Office provision path",
        },
      },
      timestamp: "2026-05-21T12:00:00.000Z",
    },
  },
});

assertShape(success, "success");
assert.strictEqual(success.status, "success");
assert.strictEqual(success.requestId, "session_test_1");
assert.strictEqual(success.context.environment, "QA");
assert.strictEqual(success.context.clientName, "Acme");
assert.ok(success.details.steps.length >= 7, "success steps populated");
assert.strictEqual(success.details.groupId, 10, "legacy groupId preserved");
assert.strictEqual(success.status, "success", "legacy root status preserved");
assert.ok(success.details.stepsByKey, "legacy steps object preserved as stepsByKey");
assert.ok(
  success.details.warnings.some((w) => /Primary HOS/i.test(w)),
  "HOS warning surfaced"
);

// Failure: duplicate check unavailable
const dupFail = normalizeInstallResponse({
  httpStatus: 503,
  environment: "qa",
  requestId: "session_test_2",
  body: { client_name: "Acme", imei: "1", vin: "V", installationId: "x" },
  json: {
    success: false,
    code: "DUPLICATE_CHECK_UNAVAILABLE",
    message: "Could not verify installation state with Pegasus.",
    duplicateCheck: { outcome: "lookup_failed", httpStatus: 503, reason: "timeout" },
  },
});

assertShape(dupFail, "dupFail");
assert.strictEqual(dupFail.status, "failed");
assert.strictEqual(dupFail.success, false);
assert.ok(dupFail.details.errors.length >= 1);
assert.strictEqual(dupFail.details.errors[0].stepId, "qservices_duplicate_check");
assert.ok(dupFail.duplicateCheck, "legacy duplicateCheck preserved");

// Internal error
const internal = normalizeInstallResponse({
  httpStatus: 500,
  environment: "production",
  requestId: "session_test_3",
  body: {},
  json: {
    success: false,
    message: "Internal server error during installation workflow",
    error: "boom",
  },
});

assertShape(internal, "internal");
assert.strictEqual(internal.status, "failed");
assert.strictEqual(internal.context.environment, "PROD");
assert.ok(internal.details.errors[0].message.includes("Internal"));
}

module.exports = { runInstallResponseNormalizeTests };

if (require.main === module) {
  runInstallResponseNormalizeTests();
  console.log("OK — install response normalization tests passed");
}
