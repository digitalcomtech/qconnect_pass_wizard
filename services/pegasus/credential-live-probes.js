'use strict';

const { readQservicesJson } = require('./qservices-response');
const { resolveApiAuthenticateToken } = require('./auth-token');
const { TOKEN_REFRESH_FIX } = require('./token-auth-messages');

const PROBE_IMEI = '000000000000000';
const PROBE_SIM_ICCID = '8988000000000000000';

function classifyProbeResult({ configured, httpStatus }) {
  if (!configured) {
    return {
      configured: false,
      live: false,
      status: null,
      state: 'missing',
      likelyFix: TOKEN_REFRESH_FIX,
    };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      configured: true,
      live: false,
      status: httpStatus,
      state: 'expired',
      likelyFix: TOKEN_REFRESH_FIX,
    };
  }
  if (httpStatus === 404) {
    return {
      configured: true,
      live: true,
      status: httpStatus,
      state: 'live',
      likelyFix: null,
    };
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    return {
      configured: true,
      live: true,
      status: httpStatus,
      state: 'live',
      likelyFix: null,
    };
  }
  return {
    configured: true,
    live: false,
    status: httpStatus,
    state: 'error',
    likelyFix: TOKEN_REFRESH_FIX,
  };
}

async function probeQservices(pegasus, currentConfig, timeoutMs = 8000) {
  const configured = Boolean(
    currentConfig.pegasusToken && String(currentConfig.pegasusToken).trim()
  );
  if (!configured) {
    return classifyProbeResult({ configured: false, httpStatus: null });
  }
  try {
    const installPath = '/installations/api/v1/installation';
    const resp = await pegasus.qservicesGet('credential-probe-qservices', installPath, timeoutMs);
    const parsed = await readQservicesJson(resp, {
      upstream: pegasus.stripUrlForLog(pegasus.qservicesRequestUrl(installPath)),
      context: 'credential-probe-qservices',
    });
    if (!parsed.ok) {
      const status = parsed.error.status || resp.status;
      return classifyProbeResult({ configured: true, httpStatus: status });
    }
    if (resp.ok && Array.isArray(parsed.data)) {
      return classifyProbeResult({ configured: true, httpStatus: resp.status });
    }
    return classifyProbeResult({ configured: true, httpStatus: resp.status });
  } catch {
    return classifyProbeResult({ configured: true, httpStatus: 503 });
  }
}

async function probePegasus1Api(pegasus, currentConfig, timeoutMs = 8000) {
  const token = resolveApiAuthenticateToken(currentConfig);
  const configured = Boolean(token && String(token).trim());
  if (!configured) {
    return classifyProbeResult({ configured: false, httpStatus: null });
  }
  try {
    const path = `/devices/${PROBE_IMEI}`;
    const resp = await pegasus.apiGet('credential-probe-p1', path, token, timeoutMs);
    return classifyProbeResult({ configured: true, httpStatus: resp.status });
  } catch {
    return classifyProbeResult({ configured: true, httpStatus: 503 });
  }
}

async function probePegasus256Sim(pegasus, currentConfig, timeoutMs = 8000) {
  const configured = Boolean(
    currentConfig.pegasus256Token && String(currentConfig.pegasus256Token).trim()
  );
  if (!configured) {
    return classifyProbeResult({ configured: false, httpStatus: null });
  }
  const url =
    'https://api.pegasusgateway.com/m2m/supersims/v1/Sims?Iccid=' +
    encodeURIComponent(PROBE_SIM_ICCID);
  try {
    const resp = await pegasus.apiGetFullUrl(
      'credential-probe-p256',
      url,
      currentConfig.pegasus256Token,
      timeoutMs
    );
    return classifyProbeResult({ configured: true, httpStatus: resp.status });
  } catch {
    return classifyProbeResult({ configured: true, httpStatus: 503 });
  }
}

async function runAllCredentialLiveProbes(pegasus, currentConfig) {
  const [qservices, pegasus1, pegasus256] = await Promise.all([
    probeQservices(pegasus, currentConfig),
    probePegasus1Api(pegasus, currentConfig),
    probePegasus256Sim(pegasus, currentConfig),
  ]);
  return { qservices, pegasus1, pegasus256 };
}

module.exports = {
  PROBE_IMEI,
  PROBE_SIM_ICCID,
  classifyProbeResult,
  probeQservices,
  probePegasus1Api,
  probePegasus256Sim,
  runAllCredentialLiveProbes,
};
