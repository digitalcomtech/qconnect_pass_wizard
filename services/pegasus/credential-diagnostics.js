'use strict';

/**
 * Non-secret Pegasus credential diagnostics (three auth paths).
 * Never include token values in returned objects or logs.
 */

const API_HOST = 'api.pegasusgateway.com';
const { buildQservicesAuthHint, missingQservicesTokenMessage } = require('./qservices-auth-hint');

function tokenConfigured(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {object} currentConfig - active ENV_CONFIG block (qa | production)
 * @param {string} environment - "qa" | "production"
 */
function buildPegasusCredentialDiagnostics(currentConfig, environment) {
  const pegasus1TokenConfigured = tokenConfigured(currentConfig.pegasus1Token);
  const pegasus256TokenConfigured = tokenConfigured(currentConfig.pegasus256Token);
  const qservicesTokenConfigured = tokenConfigured(currentConfig.pegasusToken);

  const deviceLookupAvailable = pegasus1TokenConfigured;
  const simLookupAvailable = pegasus1TokenConfigured || pegasus256TokenConfigured;
  const installationSearchAvailable = qservicesTokenConfigured;

  const notes = [];
  const qservicesHint = buildQservicesAuthHint(environment);
  if (!qservicesTokenConfigured) {
    notes.push(missingQservicesTokenMessage(environment));
    notes.push(...qservicesHint.notInterchangeable);
  }
  if (!pegasus1TokenConfigured) {
    notes.push(
      'IMEI/device/group/vehicle APIs need QA_PEGASUS1_TOKEN / PROD_PEGASUS1_TOKEN (Authenticate on api.pegasusgateway.com).'
    );
  }
  if (!pegasus256TokenConfigured) {
    notes.push(
      'Pegasus256 SIM path needs QA_PEGASUS256_TOKEN / PROD_PEGASUS256_TOKEN; Pegasus1 alone still allows partial SIM lookup.'
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
          'Device lookup (verify-imei)',
          'Groups and vehicles (provision)',
          'Pegasus1 / warehouse SIM lookup',
        ],
      },
      pegasus256: {
        envVars:
          environment === 'production'
            ? ['PROD_PEGASUS256_TOKEN']
            : ['QA_PEGASUS256_TOKEN'],
        authStyle: 'Authenticate',
        host: API_HOST,
        usedFor: ['Pegasus256 / migrated SIM lookup'],
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
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  buildPegasusCredentialDiagnostics,
  tokenConfigured,
};
