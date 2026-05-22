#!/usr/bin/env node
'use strict';

/**
 * Refresh tokens, probe live auth from .env.local, then qa:preflight against running server.
 */

const { spawn } = require('child_process');
const { loadEnvLocal } = require('./load-env-local');
const { main: fetchTokens } = require('./fetch-pegasus-tokens');
const { main: liveProbe } = require('./pegasus-live-probe-cli');

function runNodeScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function main() {
  if (!process.env.PEGASUS_AUTH_USERNAME || !process.env.PEGASUS_AUTH_PASSWORD) {
    loadEnvLocal({ override: false });
  }
  if (!process.env.PEGASUS_AUTH_USERNAME || !process.env.PEGASUS_AUTH_PASSWORD) {
    console.error(
      'Set PEGASUS_AUTH_USERNAME and PEGASUS_AUTH_PASSWORD before running pegasus:refresh-and-preflight.'
    );
    process.exit(1);
  }

  console.log('--- pegasus:refresh-and-preflight ---');
  console.log('Step 1/4: Fetch tokens → .env.local');
  await fetchTokens();

  console.log('');
  console.log('Step 2/4: Load .env.local');
  const loaded = loadEnvLocal({ override: true });
  console.log('  Loaded', loaded.loaded, 'vars from', loaded.path);

  console.log('');
  console.log('Step 3/4: Live probes (direct, no server required)');
  await liveProbe();

  console.log('');
  console.log('Step 4/4: qa:preflight (requires server using the same .env.local)');
  console.log(
    '  If preflight still shows 401, restart the server: npm run pegasus:refresh-and-start'
  );
  console.log('');
  await runNodeScript(require.resolve('./qa-dry-run-preflight.js'));
}

if (require.main === module) {
  main().catch((e) => {
    console.error('refresh-and-preflight failed:', e.message);
    process.exit(1);
  });
}
