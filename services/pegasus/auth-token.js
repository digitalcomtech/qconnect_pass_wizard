'use strict';

const fetch = require('node-fetch');

const AUTH_URL = process.env.PEGASUS_AUTH_URL || 'https://auth.pegasusgateway.com/';

/**
 * Exchange username/password for Pegasus `auth` token (Authenticate header value).
 * @param {{ username: string, password: string, gateway: string, scheme?: string }} params
 */
async function fetchPegasusAuthToken({
  username,
  password,
  gateway,
  scheme = 'infinite',
}) {
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      gateway,
      scheme,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      `Pegasus auth for gateway "${gateway}" returned non-JSON (HTTP ${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Pegasus auth failed for gateway "${gateway}" (HTTP ${response.status}): ${
        body.message || text.slice(0, 200)
      }`
    );
  }

  if (!body.auth || typeof body.auth !== 'string') {
    throw new Error(
      `Pegasus auth response missing "auth" for gateway "${gateway}": ${JSON.stringify(body).slice(0, 200)}`
    );
  }

  return {
    token: body.auth,
    message: body.message,
    gateway,
  };
}

/**
 * Authenticate token for api.pegasusgateway.com (devices, groups, vehicles, HOS).
 * Prefer Pegasus256 (production/qconnect site); Pegasus1 is fallback only.
 * Never use qservices Bearer (pegasusToken) on the main API host.
 */
function resolveApiAuthenticateToken(config) {
  if (!config) return '';
  if (config.pegasus256Token && String(config.pegasus256Token).trim()) {
    return config.pegasus256Token;
  }
  if (config.pegasus1Token && String(config.pegasus1Token).trim()) {
    return config.pegasus1Token;
  }
  return '';
}

/** Pegasus1 warehouse token only (SIM activate in Pegasus1). */
function resolvePegasus1WarehouseToken(config) {
  if (!config || !config.pegasus1Token) return '';
  return String(config.pegasus1Token).trim();
}

module.exports = {
  fetchPegasusAuthToken,
  resolveApiAuthenticateToken,
  resolvePegasus1WarehouseToken,
  AUTH_URL,
};
