#!/usr/bin/env node
/**
 * QA dry-run preflight — read-only checks (no install, no secrets logged).
 *
 *   npm run qa:preflight
 *   WIZARD_BASE_URL=http://localhost:8080 npm run qa:preflight
 *
 * Fails if healthz environment is not "qa" unless QA_DRY_RUN_ALLOW_PROD=true.
 */

'use strict';

const fetch = require('node-fetch');

const BASE = (process.env.WIZARD_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const USER = process.env.WIZARD_SMOKE_USER || 'installer';
const PASS = process.env.WIZARD_SMOKE_PASSWORD || 'installer123';
const ALLOW_PROD = process.env.QA_DRY_RUN_ALLOW_PROD === 'true';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function pass(msg) {
  console.log('OK:', msg);
}

function warn(msg) {
  console.warn('WARN:', msg);
}

async function main() {
  console.log('--- QA dry-run preflight (read-only) ---');
  console.log('BASE:', BASE);
  console.log('');

  const healthz = await fetch(`${BASE}/healthz`);
  if (!healthz.ok) fail(`/healthz → HTTP ${healthz.status}`);
  const hz = await healthz.json();
  const env = (hz.environment || '').toLowerCase();
  console.log('healthz.environment:', env);

  if (env !== 'qa') {
    if (!ALLOW_PROD) {
      fail(
        `environment is "${env}", not "qa". Set ENVIRONMENT=qa or export QA_DRY_RUN_ALLOW_PROD=true to override.`
      );
    }
    warn(`environment is "${env}" (QA_DRY_RUN_ALLOW_PROD=true)`);
  } else {
    pass('environment is qa');
  }

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!loginRes.ok) fail(`login → HTTP ${loginRes.status}`);
  const loginJson = await loginRes.json();
  const token = loginJson.token;
  if (!token) fail('login response missing token');
  pass('JWT login');

  const auth = { Authorization: `Bearer ${token}` };

  const cfgRes = await fetch(`${BASE}/api/config`, { headers: auth });
  if (!cfgRes.ok) fail(`/api/config → HTTP ${cfgRes.status}`);
  const cfg = await cfgRes.json();
  if ((cfg.environment || '').toLowerCase() !== env) {
    warn('config.environment disagrees with healthz');
  }

  const credRes = await fetch(`${BASE}/api/health/credentials`, { headers: auth });
  if (!credRes.ok) fail(`/api/health/credentials → HTTP ${credRes.status}`);
  const cred = await credRes.json();

  const flags = {
    pegasus1TokenConfigured: cred.pegasus1TokenConfigured,
    pegasus256TokenConfigured: cred.pegasus256TokenConfigured,
    qservicesTokenConfigured: cred.qservicesTokenConfigured,
    deviceLookupAvailable: cred.deviceLookupAvailable,
    simLookupAvailable: cred.simLookupAvailable,
    installationSearchAvailable: cred.installationSearchAvailable,
  };

  console.log('');
  console.log('credentials (from /api/health/credentials):');
  Object.keys(flags).forEach((k) => {
    console.log(`  ${k}:`, flags[k]);
  });

  const required = [
    'pegasus1TokenConfigured',
    'pegasus256TokenConfigured',
    'qservicesTokenConfigured',
    'installationSearchAvailable',
  ];
  const missing = required.filter((k) => !flags[k]);
  if (missing.length) {
    fail(`missing credentials for full QA dry-run: ${missing.join(', ')}`);
  }
  pass('all required credential flags true');

  if (cfg.credentials) {
    if (cfg.credentials.pegasus1TokenConfigured !== cred.pegasus1TokenConfigured) {
      warn('/api/config credentials disagree with /api/health/credentials (pegasus1)');
    }
  }

  const pegRes = await fetch(`${BASE}/api/health/pegasus`, { headers: auth });
  const pegText = await pegRes.text();
  let peg = {};
  try {
    peg = JSON.parse(pegText);
  } catch {
    fail('/api/health/pegasus returned non-JSON');
  }

  if (!pegRes.ok && pegRes.status !== 503) {
    fail(`/api/health/pegasus → HTTP ${pegRes.status}`);
  }

  if (peg.success) {
    pass(`qservices live probe HTTP ${peg.status || 'ok'}`);
    if (peg.upstream) console.log('  upstream:', peg.upstream);
  } else {
    warn(
      `qservices live probe not healthy: ${peg.message || peg.code || pegRes.status}`
    );
  }

  console.log('');
  console.log('Preflight complete. Continue with docs/QA_DRY_RUN_CHECKLIST.md (Phase A).');
  console.log('Stop before Provision unless intentionally testing QA mutation (Phase B).');
}

main().catch((e) => {
  console.error('preflight error:', e.message);
  process.exit(1);
});
