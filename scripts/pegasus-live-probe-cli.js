#!/usr/bin/env node
'use strict';

/**
 * Live Pegasus token probes using .env.local (no running server required).
 *   node scripts/pegasus-live-probe-cli.js
 */

const { loadEnvLocal } = require('./load-env-local');
const config = require('../config');
const pegasus = require('../pegasus-client');
const { buildPegasusCredentialDiagnosticsWithLive } = require('../services/pegasus/credential-diagnostics');

function printTokenRow(label, health) {
  console.log(`  ${label}:`);
  console.log(`    configured: ${health.configured}`);
  console.log(`    live:       ${health.live}`);
  console.log(`    status:     ${health.status == null ? '—' : health.status}`);
  console.log(`    state:      ${health.state}`);
  if (health.likelyFix) {
    console.log(`    likely fix: ${health.likelyFix}`);
  }
}

async function main() {
  const loaded = loadEnvLocal({ override: true });
  console.log('--- Pegasus live token probes ---');
  console.log('.env.local:', loaded.exists ? loaded.path : 'missing', `(${loaded.loaded} vars)`);
  console.log('ENVIRONMENT:', process.env.ENVIRONMENT || config.ENVIRONMENT);
  console.log('');

  const env = (process.env.ENVIRONMENT || config.ENVIRONMENT || 'qa').toLowerCase();
  const currentConfig = config.ENV_CONFIG[env] || config.ENV_CONFIG.qa;
  const cred = await buildPegasusCredentialDiagnosticsWithLive(
    currentConfig,
    env,
    pegasus
  );

  printTokenRow('qservices', cred.tokens.qservices);
  printTokenRow('pegasus1', cred.tokens.pegasus1);
  printTokenRow('pegasus256', cred.tokens.pegasus256);

  const allLive =
    cred.tokens.qservices.live &&
    cred.tokens.pegasus1.live &&
    cred.tokens.pegasus256.live;

  console.log('');
  if (allLive) {
    console.log('OK — all configured tokens authenticated live.');
    process.exit(0);
  }
  console.error('FAIL — one or more tokens are missing or not live.');
  process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('probe error:', e.message);
    process.exit(1);
  });
}

module.exports = { main };
