'use strict';

/**
 * Centralized Pegasus HTTP access for installer-app.
 * - qservices.* : Bearer + pegasusBaseUrl (installations / health / confirmation)
 * - api.*       : Authenticate header + api.pegasusgateway.com (devices, vehicles, groups, SIM)
 */

const fetch = require('node-fetch');
const { resolveApiAuthenticateToken } = require('./services/pegasus/auth-token');

function stripUrlForLog(urlStr) {
  try {
    const u = new URL(urlStr);
    const path = u.pathname;
    if (!u.search) return `${u.origin}${path}`;
    const redacted = new URLSearchParams();
    for (const [k, v] of u.searchParams.entries()) {
      if (/iccid|token|secret|password/i.test(k)) redacted.set(k, '…');
      else redacted.set(k, v.length > 40 ? `${v.slice(0, 12)}…` : v);
    }
    return `${u.origin}${path}?${redacted.toString()}`;
  } catch {
    return '[invalid-url]';
  }
}

function truncate(s, n = 400) {
  if (s == null) return '';
  const t = String(s);
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function logPegasusFailure(context, info) {
  console.error(
    '[Pegasus]',
    JSON.stringify({
      context,
      upstream: info.upstream,
      method: info.method || 'GET',
      status: info.status,
      authMode: info.authMode,
      authConfigured: Boolean(info.authConfigured),
      phase: info.phase || 'http',
      reason: truncate(info.reason, 500),
    })
  );
}

async function readErrorBodyOnce(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function retryApiCall(apiCall, { maxRetries = 3, delay = 1000, backoff = 2 } = {}) {
  let d = delay;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`[Pegasus] retry ${attempt}/${maxRetries} in ${d}ms:`, truncate(error.message, 200));
      await new Promise((r) => setTimeout(r, d));
      d *= backoff;
    }
  }
}

function createPegasusClient({ currentConfig, apiBaseUrl, defaultTimeoutMs = 30000 }) {
  const apiBase = (apiBaseUrl || 'https://api.pegasusgateway.com').replace(/\/$/, '');
  const qBase = String(currentConfig.pegasusBaseUrl || '').replace(/\/$/, '');
  const defaultApiToken = () => resolveApiAuthenticateToken(currentConfig);

  function buildInit(method, { bearer, authenticate, bodyObj, extraHeaders = {} }, timeoutMs) {
    const headers = { ...extraHeaders };
    let authMode = 'none';
    let authConfigured = false;
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
      authMode = 'bearer';
      authConfigured = true;
    } else if (authenticate != null && authenticate !== '') {
      headers.Authenticate = authenticate;
      authMode = 'authenticate';
      authConfigured = true;
    }
    const init = {
      method,
      headers,
      signal: AbortSignal.timeout(timeoutMs ?? defaultTimeoutMs),
    };
    if (bodyObj != null && method !== 'GET' && method !== 'HEAD') {
      init.body = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
    return { init, authMode, authConfigured };
  }

  async function exec(context, fullUrl, method, authOpts, timeoutMs) {
    const { init, authMode, authConfigured } = buildInit(method, authOpts, timeoutMs);
    const upstream = stripUrlForLog(fullUrl);
    try {
      const response = await fetch(fullUrl, init);
      return { response, authMode, authConfigured, upstream };
    } catch (err) {
      logPegasusFailure(context, {
        upstream,
        method,
        authMode,
        authConfigured,
        phase: 'network',
        reason: err.message,
      });
      throw err;
    }
  }

  function logHttpNotOk(context, response, method, authMode, authConfigured, upstream) {
    logPegasusFailure(context, {
      upstream,
      method,
      status: response.status,
      authMode,
      authConfigured,
      phase: 'http',
      reason: response.statusText,
    });
  }

  return {
    apiBase,
    qBase,
    stripUrlForLog,
    truncate,
    retryApiCall,

    /**
     * qservices GET with Bearer. Does not log 404 as failure (expected for duplicate probe).
     */
    async qservicesGetAllow404(context, path, timeoutMs) {
      const url = `${qBase}${path.startsWith('/') ? path : `/${path}`}`;
      const bearer = currentConfig.pegasusToken || '';
      const { response, authMode, authConfigured, upstream } = await exec(
        context,
        url,
        'GET',
        { bearer },
        timeoutMs
      );
      if (!response.ok && response.status !== 404) {
        logHttpNotOk(context, response, 'GET', authMode, authConfigured, upstream);
      }
      return response;
    },

    async qservicesGet(context, path, timeoutMs) {
      const url = `${qBase}${path.startsWith('/') ? path : `/${path}`}`;
      const bearer = currentConfig.pegasusToken || '';
      const { response, authMode, authConfigured, upstream } = await exec(
        context,
        url,
        'GET',
        { bearer },
        timeoutMs
      );
      if (!response.ok) {
        logHttpNotOk(context, response, 'GET', authMode, authConfigured, upstream);
      }
      return response;
    },

    async qservicesPost(context, path, body, timeoutMs) {
      const url = `${qBase}${path.startsWith('/') ? path : `/${path}`}`;
      const bearer = currentConfig.pegasusToken || '';
      const { response, authMode, authConfigured, upstream } = await exec(
        context,
        url,
        'POST',
        { bearer, bodyObj: body },
        timeoutMs
      );
      if (!response.ok) {
        logHttpNotOk(context, response, 'POST', authMode, authConfigured, upstream);
      }
      return response;
    },

    async apiGet(context, pathWithQuery, authenticateToken, timeoutMs) {
      const url = `${apiBase}${pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`}`;
      const token = authenticateToken != null ? authenticateToken : defaultApiToken();
      const { response, authMode, authConfigured, upstream } = await exec(
        context,
        url,
        'GET',
        { authenticate: token },
        timeoutMs
      );
      if (!response.ok) {
        logHttpNotOk(context, response, 'GET', authMode, authConfigured, upstream);
      }
      return response;
    },

    async apiPost(context, pathWithQuery, body, authenticateToken, timeoutMs) {
      const url = `${apiBase}${pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`}`;
      const token = authenticateToken != null ? authenticateToken : defaultApiToken();
      const { response, authMode, authConfigured, upstream } = await exec(
        context,
        url,
        'POST',
        { authenticate: token, bodyObj: body },
        timeoutMs
      );
      if (!response.ok) {
        logHttpNotOk(context, response, 'POST', authMode, authConfigured, upstream);
      }
      return response;
    },

    async apiGetFullUrl(context, fullUrl, authenticateToken, timeoutMs) {
      const token = authenticateToken != null ? authenticateToken : defaultApiToken();
      const { response, authMode, authConfigured, upstream } = await exec(
        context,
        fullUrl,
        'GET',
        { authenticate: token },
        timeoutMs
      );
      if (!response.ok) {
        logHttpNotOk(context, response, 'GET', authMode, authConfigured, upstream);
      }
      return response;
    },

    async apiPostFullUrl(context, fullUrl, body, authenticateToken, timeoutMs) {
      const token = authenticateToken != null ? authenticateToken : defaultApiToken();
      const { response, authMode, authConfigured, upstream } = await exec(
        context,
        fullUrl,
        'POST',
        { authenticate: token, bodyObj: body },
        timeoutMs
      );
      if (!response.ok) {
        logHttpNotOk(context, response, 'POST', authMode, authConfigured, upstream);
      }
      return response;
    },

    async apiPostWithRetry(context, path, body, authenticateToken, retryCount = 3) {
      const url = `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
      const token = authenticateToken != null ? authenticateToken : defaultApiToken();
      return retryApiCall(
        async () => {
          const { response, authMode, authConfigured, upstream } = await exec(
            context,
            url,
            'POST',
            { authenticate: token, bodyObj: body },
            defaultTimeoutMs
          );
          if (!response.ok) {
            const text = await readErrorBodyOnce(response);
            logPegasusFailure(context, {
              upstream,
              method: 'POST',
              status: response.status,
              authMode,
              authConfigured,
              phase: 'http',
              reason: truncate(text, 400) || response.statusText,
            });
            throw new Error(`Pegasus API call failed: ${response.status} - ${truncate(text, 500)}`);
          }
          return response;
        },
        { maxRetries: retryCount, delay: 1000, backoff: 2 }
      );
    },
  };
}

module.exports = {
  createPegasusClient,
  retryApiCall,
  stripUrlForLog,
  truncate,
};
