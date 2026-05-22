'use strict';

const TOKEN_REFRESH_FIX =
  'Run npm run pegasus:fetch-tokens and restart the server (or npm run pegasus:refresh-and-start).';

function pegasus256TokenExpiredMessage() {
  return `Pegasus256 token expired (devices and primary API). ${TOKEN_REFRESH_FIX}`;
}

function pegasus1TokenExpiredMessage() {
  return `Pegasus1 warehouse token expired. ${TOKEN_REFRESH_FIX}`;
}

function pegasusSimTokensExpiredMessage() {
  return `Pegasus1/Pegasus256 token expired. ${TOKEN_REFRESH_FIX}`;
}

function qservicesTokenExpiredMessage() {
  return `qservices token expired. ${TOKEN_REFRESH_FIX}`;
}

function qservicesTokenMissingMessage(environment) {
  const prefix = environment === 'production' ? 'PROD' : 'QA';
  return `${prefix}_PEGASUS_TOKEN is not set. ${TOKEN_REFRESH_FIX}`;
}

module.exports = {
  TOKEN_REFRESH_FIX,
  pegasus256TokenExpiredMessage,
  pegasus1TokenExpiredMessage,
  pegasusSimTokensExpiredMessage,
  qservicesTokenExpiredMessage,
  qservicesTokenMissingMessage,
};
