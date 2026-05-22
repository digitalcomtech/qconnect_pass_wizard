#!/usr/bin/env node
'use strict';

/**
 * Fetch fresh Pegasus tokens, load .env.local, start server.js.
 * Requires PEGASUS_AUTH_USERNAME and PEGASUS_AUTH_PASSWORD in the environment.
 */

const { spawn } = require('child_process');
const path = require('path');
const { loadEnvLocal } = require('./load-env-local');
const { main: fetchTokens } = require('./fetch-pegasus-tokens');

async function main() {
  if (!process.env.PEGASUS_AUTH_USERNAME || !process.env.PEGASUS_AUTH_PASSWORD) {
    const pre = loadEnvLocal({ override: false });
    if (!process.env.PEGASUS_AUTH_USERNAME || !process.env.PEGASUS_AUTH_PASSWORD) {
      console.error(
        'Set PEGASUS_AUTH_USERNAME and PEGASUS_AUTH_PASSWORD (in shell or .env.local), then run:'
      );
      console.error('  npm run pegasus:refresh-and-start');
      process.exit(1);
    }
    console.log('Using auth credentials from', pre.path);
  }

  console.log('--- pegasus:refresh-and-start ---');
  console.log('Step 1/3: Fetching fresh Pegasus tokens into .env.local…');
  await fetchTokens();

  console.log('');
  console.log('Step 2/3: Loading .env.local into this process…');
  const loaded = loadEnvLocal({ override: true });
  console.log('  Loaded', loaded.loaded, 'variables from', loaded.path);

  console.log('');
  console.log('Step 3/3: Starting server (node server.js)…');
  console.log('');
  console.log(
    'IMPORTANT: If another installer-app is already listening on PORT, stop it first.'
  );
  console.log(
    'After any manual .env.local edit, restart the server so it picks up new tokens.'
  );
  console.log('');

  const serverPath = path.join(process.cwd(), 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
  });

  child.on('exit', (code) => process.exit(code == null ? 0 : code));
}

if (require.main === module) {
  main().catch((e) => {
    console.error('refresh-and-start failed:', e.message);
    process.exit(1);
  });
}
