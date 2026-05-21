'use strict';

/**
 * Non-secret guidance when qservices Bearer is missing or rejected.
 */

const QA_QSERVICES_AUTH_GATEWAY = 'dev2.pegasusgateway.com';
const { QA_QSERVICES_API_BASE_URL } = require('./qservices-url');
const QA_QSERVICES_BASE_URL = QA_QSERVICES_API_BASE_URL;

function envPrefix(environment) {
  return environment === 'production' ? 'PROD' : 'QA';
}

function buildQservicesAuthHint(environment) {
  const prefix = envPrefix(environment);
  const isQa = environment !== 'production';
  return {
    tokenEnvVar: `${prefix}_PEGASUS_TOKEN`,
    baseUrlEnvVar: `${prefix}_PEGASUS_BASE_URL`,
    recommendedBaseUrl: isQa ? QA_QSERVICES_BASE_URL : 'https://qservices.pegasusgateway.com',
    authGateway: isQa
      ? process.env.PEGASUS_AUTH_GATEWAY_QSERVICES || QA_QSERVICES_AUTH_GATEWAY
      : process.env.PEGASUS_AUTH_GATEWAY_QSERVICES || '',
    authStyle: 'Bearer',
    refreshCommand: 'npm run pegasus:fetch-tokens',
    credentialEnv: ['PEGASUS_AUTH_USERNAME', 'PEGASUS_AUTH_PASSWORD'],
    notInterchangeable: [
      'QA_PEGASUS1_TOKEN / QA_PEGASUS256_TOKEN are Authenticate tokens for api.pegasusgateway.com only.',
      'They are not valid as Bearer tokens on the qservices installation API.',
      'dev2.pegasusgateway.com is the auth gateway only — API host is qservices.pegasusgateway.com/qa (not dev2 root).',
    ],
  };
}

function missingQservicesTokenMessage(environment) {
  const hint = buildQservicesAuthHint(environment);
  return (
    `Installation search requires ${hint.tokenEnvVar} (Bearer on ${hint.baseUrlEnvVar}, ` +
    `QA default ${hint.recommendedBaseUrl}). ` +
    `Obtain via auth gateway "${hint.authGateway}" with ${hint.refreshCommand} ` +
    `(export ${hint.credentialEnv.join(' and ')} first).`
  );
}

function rejectedQservicesTokenMessage(environment) {
  const hint = buildQservicesAuthHint(environment);
  return (
    `Pegasus qservices rejected the Bearer token (HTTP 401). ` +
    `Refresh ${hint.tokenEnvVar} using gateway "${hint.authGateway}" — ${hint.refreshCommand}. ` +
    `Confirm ${hint.baseUrlEnvVar} matches the gateway tenant (QA: ${hint.recommendedBaseUrl}).`
  );
}

module.exports = {
  QA_QSERVICES_AUTH_GATEWAY,
  QA_QSERVICES_BASE_URL,
  buildQservicesAuthHint,
  missingQservicesTokenMessage,
  rejectedQservicesTokenMessage,
};
