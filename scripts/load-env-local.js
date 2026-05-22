'use strict';

/**
 * Load .env.local into process.env (KEY=VALUE, no export).
 * Used before starting server.js or running live token probes.
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(process.cwd(), '.env.local');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvLocal(options = {}) {
  const file = options.path || ENV_FILE;
  if (!fs.existsSync(file)) {
    return { loaded: 0, path: file, exists: false };
  }
  const text = fs.readFileSync(file, 'utf8');
  let loaded = 0;
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (options.override || process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
      loaded += 1;
    }
  }
  return { loaded, path: file, exists: true };
}

module.exports = { loadEnvLocal, ENV_FILE };
