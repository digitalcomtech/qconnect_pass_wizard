#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  buildQservicesAuthHint,
  missingQservicesTokenMessage,
  rejectedQservicesTokenMessage,
} = require('../services/pegasus/qservices-auth-hint');

const qa = buildQservicesAuthHint('qa');
assert.strictEqual(qa.tokenEnvVar, 'QA_PEGASUS_TOKEN');
assert.strictEqual(qa.authGateway, 'dev2.pegasusgateway.com');
assert.ok(qa.notInterchangeable.some((n) => n.includes('PEGASUS1')));

const miss = missingQservicesTokenMessage('qa');
assert.ok(miss.includes('QA_PEGASUS_TOKEN'));
assert.ok(miss.includes('dev2.pegasusgateway.com'));
assert.ok(!miss.includes('secret'));

const rej = rejectedQservicesTokenMessage('qa');
assert.ok(rej.includes('401'));
assert.ok(!/\b[a-f0-9]{32,}\b/i.test(rej));

console.log('OK — test-qservices-auth-hint.js');
