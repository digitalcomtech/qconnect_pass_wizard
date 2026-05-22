'use strict';

/**
 * Non-secret Pegasus credential diagnostics (three auth paths).
 * Never include token values in returned objects or logs.
 */

const API_HOST = 'api.pegasusgateway.com';
const { buildQservicesAuthHint, missingQservicesTokenMessage } = require('./qservices-auth-hint');
const { runAllCredentialLiveProbes } = require('./credential-live-probes');
const { TOKEN_REFRESH_FIX } = require('./token-auth-messages');

function tokenConfigured(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function availabilityFromToken(tokenHealth) {
  if (!tokenHealth.configured) return false;
  return tokenHealth.live === true;
}

/**
 * @param {object} currentConfig - active ENV_CONFIG block (qa | production)
 * @param {string} environment - "qa" | "production"
 */
function buildPegasusCredentialDiagnostics(currentConfig, environment) {
  const pegasus1TokenConfigured = tokenConfigured(currentConfig.pegasus1Token);
  const pegasus256TokenConfigured = tokenConfigured(currentConfig.pegasus256Token);
  const qservicesTokenConfigured = tokenConfigured(currentConfig.pegasusToken);

  const deviceLookupAvailable =
    pegasus256TokenConfigured || pegasus1TokenConfigured;
  const simLookupAvailable = pegasus256TokenConfigured || pegasus1TokenConfigured;
  const installationSearchAvailable = qservicesTokenConfigured;

  const notes = [];
  const qservicesHint = buildQservicesAuthHint(environment);
  if (!qservicesTokenConfigured) {
    notes.push(missingQservicesTokenMessage(environment));
    notes.push(...qservicesHint.notInterchangeable);
  }
  if (!pegasus256TokenConfigured) {
    notes.push(
      'IMEI/device/group/vehicle APIs prefer QA_PEGASUS256_TOKEN / PROD_PEGASUS256_TOKEN (Authenticate on api.pegasusgateway.com, Pegasus256 site).'
    );
  }
  if (!pegasus1TokenConfigured) {
    notes.push(
      'Pegasus1 warehouse SIM activate/lookup needs QA_PEGASUS1_TOKEN / PROD_PEGASUS1_TOKEN (SIM lookup also checks Pegasus256 first).'
    );
  }

  return {
    environment,
    pegasus1TokenConfigured,
    pegasus256TokenConfigured,
    qservicesTokenConfigured,
    deviceLookupAvailable,
    simLookupAvailable,
    installationSearchAvailable,
    credentialPaths: {
      pegasus1: {
        envVars:
          environment === 'production'
            ? ['PROD_PEGASUS1_TOKEN']
            : ['QA_PEGASUS1_TOKEN'],
        authStyle: 'Authenticate',
        host: API_HOST,
        usedFor: [
          'Warehouse SIM activate and Pegasus1 SIM fallback lookup',
        ],
      },
      pegasus256: {
        envVars:
          environment === 'production'
            ? ['PROD_PEGASUS256_TOKEN']
            : ['QA_PEGASUS256_TOKEN'],
        authStyle: 'Authenticate',
        host: API_HOST,
        usedFor: [
          'Device lookup (verify-imei)',
          'Groups, vehicles, HOS (provision)',
          'Migrated SIM lookup (first)',
        ],
      },
      qservices: {
        envVars:
          environment === 'production'
            ? ['PROD_PEGASUS_TOKEN', 'PROD_PEGASUS_BASE_URL']
            : ['QA_PEGASUS_TOKEN', 'QA_PEGASUS_BASE_URL'],
        authStyle: 'Bearer',
        authGateway: qservicesHint.authGateway || '(set PEGASUS_AUTH_GATEWAY_QSERVICES)',
        host: currentConfig.pegasusBaseUrl || '(pegasusBaseUrl not set)',
        refresh: qservicesHint.refreshCommand,
        usedFor: [
          'Installation search',
          'Installation status',
          'Confirm installation',
          'Duplicate installation check',
        ],
      },
    },
    qservicesAuthHint: qservicesHint,
    notes,
    tokenRefreshHint: TOKEN_REFRESH_FIX,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Configured flags + live upstream probes (no secrets).
 * @param {object} pegasus - pegasus client
 */
async function buildPegasusCredentialDiagnosticsWithLive(
  currentConfig,
  environment,
  pegasus
) {
  const base = buildPegasusCredentialDiagnostics(currentConfig, environment);
  const live = await runAllCredentialLiveProbes(pegasus, currentConfig);

  const tokens = {
    pegasus1: live.pegasus1,
    pegasus256: live.pegasus256,
    qservices: live.qservices,
  };

  const deviceLookupAvailable =
    availabilityFromToken(tokens.pegasus256) || availabilityFromToken(tokens.pegasus1);
  const simLookupAvailable =
    availabilityFromToken(tokens.pegasus256) || availabilityFromToken(tokens.pegasus1);
  const installationSearchAvailable = availabilityFromToken(tokens.qservices);

  const notes = [...base.notes];
  for (const [name, health] of Object.entries(tokens)) {
    if (health.state === 'expired') {
      notes.push(
        `${name} token is configured but upstream returned HTTP ${health.status} (likely expired). ${TOKEN_REFRESH_FIX}`
      );
    } else if (health.state === 'missing') {
      notes.push(`${name} token env var is missing. ${TOKEN_REFRESH_FIX}`);
    }
  }

  return {
    ...base,
    deviceLookupAvailable,
    simLookupAvailable,
    installationSearchAvailable,
    pegasus1TokenLive: tokens.pegasus1.live,
    pegasus256TokenLive: tokens.pegasus256.live,
    qservicesTokenLive: tokens.qservices.live,
    tokens,
    notes,
    liveProbedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildPegasusCredentialDiagnostics,
  buildPegasusCredentialDiagnosticsWithLive,
  tokenConfigured,
  availabilityFromToken,
};
