#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildEnvConfig, getCurrentEnvConfig } = require('./runtime-app-config');

const fakeConfig = {
  ENVIRONMENT: 'qa',
  production: { pegasusToken: 'p' },
  qa: { pegasusToken: 'q' },
};

const envConfig = buildEnvConfig(fakeConfig);
assert.ok(envConfig.qa);
assert.ok(envConfig.production);
assert.strictEqual(getCurrentEnvConfig(fakeConfig, 'qa').pegasusToken, 'q');
assert.strictEqual(getCurrentEnvConfig(fakeConfig, 'production').pegasusToken, 'p');
assert.strictEqual(getCurrentEnvConfig(fakeConfig, 'unknown').pegasusToken, 'q');

console.log('OK — test-runtime-app-config.js');
