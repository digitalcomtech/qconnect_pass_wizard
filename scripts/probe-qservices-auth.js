#!/usr/bin/env node
/**
 * Probe qservices installation API auth (status codes only — never prints tokens).
 *
 *   export PEGASUS_AUTH_USERNAME=...
 *   export PEGASUS_AUTH_PASSWORD=...
 *   node scripts/probe-qservices-auth.js
 *
 * Optional:
 *   QA_PEGASUS_TOKEN=... QA_PEGASUS_BASE_URL=...  (skip auth fetch, test existing token)
 */

'use strict';

const fetch = require('node-fetch');
const { fetchPegasusAuthToken } = require('../services/pegasus/auth-token');

const INSTALL_PATH = '/installations/api/v1/installation';

const BASES = [
  { label: 'qservices /qa (QA API — expected)', base: 'https://qservices.pegasusgateway.com/qa' },
  { label: 'dev2 root (redirects to /v2 HTML)', base: 'https://dev2.pegasusgateway.com' },
  { label: 'qservices prod host', base: 'https://qservices.pegasusgateway.com' },
];

async function probeGet(label, baseUrl, bearer) {
  const url = `${baseUrl.replace(/\/$/, '')}${INSTALL_PATH}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  console.log(`  ${label}: HTTP ${res.status}`);
  return res.status;
}

async function main() {
  let bearer = (process.env.QA_PEGASUS_TOKEN || process.env.PROD_PEGASUS_TOKEN || '').trim();
  const configuredBase = (
    process.env.QA_PEGASUS_BASE_URL ||
    process.env.PROD_PEGASUS_BASE_URL ||
    ''
  ).trim();

  if (!bearer) {
    const username = process.env.PEGASUS_AUTH_USERNAME;
    const password = process.env.PEGASUS_AUTH_PASSWORD;
    if (!username || !password) {
      console.error(
        'Set PEGASUS_AUTH_USERNAME/PASSWORD or QA_PEGASUS_TOKEN, then re-run.'
      );
      process.exit(1);
    }
    const gateway =
      process.env.PEGASUS_AUTH_GATEWAY_QSERVICES || 'dev2.pegasusgateway.com';
    console.log('Fetching auth token for gateway:', gateway);
    const { token, message } = await fetchPegasusAuthToken({
      username,
      password,
      gateway,
    });
    console.log(' ', message);
    bearer = token;
  } else {
    console.log('Using QA_PEGASUS_TOKEN / PROD_PEGASUS_TOKEN from environment');
  }

  if (configuredBase) {
    console.log('\nConfigured base URL:', configuredBase);
    await probeGet('configured base', configuredBase, bearer);
  }

  console.log('\nBearer probe across known hosts:');
  for (const { label, base } of BASES) {
    await probeGet(label, base, bearer);
  }

  const p1 = (process.env.QA_PEGASUS1_TOKEN || '').trim();
  if (p1) {
    console.log('\nPegasus1 token as Bearer on dev2 (should NOT work for qservices):');
    await probeGet('pegasus1-as-bearer', 'https://dev2.pegasusgateway.com', p1);
  }

  console.log('\nDone. HTTP 200 application/json on qservices/qa/installations/... means token + base URL are correct.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error('probe failed:', e.message);
    process.exit(1);
  });
}
