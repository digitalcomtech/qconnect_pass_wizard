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
const TOKEN_FIX =
  'Run npm run pegasus:fetch-tokens and restart the server (or npm run pegasus:refresh-and-start).';

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

function printTokenHealth(name, health) {
  if (!health) {
    console.log(`  ${name}: (no live probe data — restart server after token refresh)`);
    return;
  }
  console.log(`  ${name}:`);
  console.log(`    configured: ${health.configured}`);
  console.log(`    live:       ${health.live}`);
  console.log(`    status:     ${health.status == null ? '—' : health.status}`);
  console.log(`    state:      ${health.state}`);
  if (!health.live && health.likelyFix) {
    console.log(`    likely fix: ${health.likelyFix}`);
  }
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

  console.log('');
  console.log('Pegasus tokens (configured vs live):');
  if (cred.tokens) {
    printTokenHealth('qservices', cred.tokens.qservices);
    printTokenHealth('pegasus1', cred.tokens.pegasus1);
    printTokenHealth('pegasus256', cred.tokens.pegasus256);
  } else {
    warn('Server did not return tokens.* — restart server after upgrading credential diagnostics.');
    console.log('  pegasus1TokenConfigured:', cred.pegasus1TokenConfigured);
    console.log('  pegasus256TokenConfigured:', cred.pegasus256TokenConfigured);
    console.log('  qservicesTokenConfigured:', cred.qservicesTokenConfigured);
  }

  const requiredConfigured = [
    ['pegasus1TokenConfigured', cred.pegasus1TokenConfigured],
    ['pegasus256TokenConfigured', cred.pegasus256TokenConfigured],
    ['qservicesTokenConfigured', cred.qservicesTokenConfigured],
  ];
  const missingConfigured = requiredConfigured.filter(([, v]) => !v).map(([k]) => k);
  if (missingConfigured.length) {
    fail(`token env vars missing on server: ${missingConfigured.join(', ')}. ${TOKEN_FIX}`);
  }
  pass('all required tokens configured on server');

  if (cred.tokens) {
    const notLive = Object.entries(cred.tokens).filter(([, h]) => !h.live);
    if (notLive.length) {
      fail(
        `tokens not live on running server: ${notLive.map(([k]) => k).join(', ')}. ${TOKEN_FIX}`
      );
    }
    pass('all tokens live on running server (upstream auth OK)');
  }

  if (cfg.credentials && cred.tokens) {
    if (cfg.credentials.pegasus1TokenConfigured !== cred.pegasus1TokenConfigured) {
      warn('/api/config credentials disagree with /api/health/credentials (pegasus1 configured)');
    }
    if (cfg.credentials.pegasus1TokenLive !== cred.tokens.pegasus1.live) {
      warn('/api/config vs /api/health/credentials pegasus1 live mismatch');
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

  if (peg.success && (peg.status === 200 || peg.status === undefined)) {
    pass(`qservices live probe HTTP ${peg.status || 200}`);
    if (peg.upstream) console.log('  upstream:', peg.upstream);
  } else if (cred.tokens && cred.tokens.qservices.live) {
    pass('qservices live (from /api/health/credentials tokens.qservices)');
  } else {
    fail(
      `qservices live probe not healthy: ${peg.message || peg.code || pegRes.status}. ${TOKEN_FIX}`
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
