#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  resolveApiAuthenticateToken,
  resolvePegasus1WarehouseToken,
} = require('../services/pegasus/auth-token');

const cfg = {
  pegasusToken: 'bearer-qservices-only',
  pegasus1Token: 'pegasus1-auth',
  pegasus256Token: 'pegasus256-auth',
};

assert.strictEqual(resolveApiAuthenticateToken(cfg), 'pegasus256-auth');
assert.strictEqual(
  resolveApiAuthenticateToken({ pegasusToken: 'bearer', pegasus1Token: 'p1-only' }),
  'p1-only'
);
assert.strictEqual(resolveApiAuthenticateToken({ pegasusToken: 'bearer' }), '');
assert.strictEqual(resolvePegasus1WarehouseToken(cfg), 'pegasus1-auth');

console.log('OK — test-auth-token-resolve.js');
