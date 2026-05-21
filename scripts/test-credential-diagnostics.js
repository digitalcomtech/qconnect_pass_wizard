#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  buildPegasusCredentialDiagnostics,
} = require('../services/pegasus/credential-diagnostics');

const base = {
  pegasusBaseUrl: 'https://qservices.pegasusgateway.com/qa',
  pegasusToken: '',
  pegasus1Token: 'a',
  pegasus256Token: '',
};

const partial = buildPegasusCredentialDiagnostics(base, 'qa');
assert.strictEqual(partial.deviceLookupAvailable, true);
assert.strictEqual(partial.simLookupAvailable, true);
assert.strictEqual(partial.installationSearchAvailable, false);
assert.strictEqual(partial.pegasus1TokenConfigured, true);
assert.strictEqual(partial.qservicesTokenConfigured, false);
assert.ok(
  partial.notes.some((n) => n.includes('QA_PEGASUS_TOKEN')),
  'notes mention qservices token env var'
);
assert.ok(partial.qservicesAuthHint && partial.qservicesAuthHint.authGateway);

const full = buildPegasusCredentialDiagnostics(
  { ...base, pegasusToken: 'b', pegasus256Token: 'c' },
  'qa'
);
assert.strictEqual(full.installationSearchAvailable, true);
assert.strictEqual(full.simLookupAvailable, true);

const empty = buildPegasusCredentialDiagnostics(
  { pegasusBaseUrl: base.pegasusBaseUrl, pegasusToken: '', pegasus1Token: '', pegasus256Token: '' },
  'qa'
);
assert.strictEqual(empty.deviceLookupAvailable, false);
assert.strictEqual(empty.simLookupAvailable, false);

assert.ok(!JSON.stringify(partial).includes('"a"') && !JSON.stringify(partial).includes('token":'));

console.log('OK — test-credential-diagnostics.js');
