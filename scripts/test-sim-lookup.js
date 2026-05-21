#!/usr/bin/env node
/**
 * Unit checks for SIM lookup helpers (no network).
 * Usage: node scripts/test-sim-lookup.js
 */

"use strict";

const assert = require("assert");
const { resolveSimType } = require("../services/pegasus/sim-lookup");

function testResolveSimType() {
  assert.strictEqual(resolveSimType("8988123456789012345").ok, true);
  assert.strictEqual(resolveSimType("8988123456789012345").simType, "SuperSIM");

  assert.strictEqual(resolveSimType("8901260862393323067").ok, true);
  assert.strictEqual(resolveSimType("8901260862393323067").simType, "Wireless");

  assert.strictEqual(resolveSimType("1234").ok, false);
  assert.strictEqual(resolveSimType("").ok, false);
}

testResolveSimType();
console.log("OK — test-sim-lookup.js");
