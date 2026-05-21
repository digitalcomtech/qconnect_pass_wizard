'use strict';

/** QA installations JSON API (Bearer). Token is obtained via auth gateway dev2.pegasusgateway.com. */
const QA_QSERVICES_API_BASE_URL = 'https://qservices.pegasusgateway.com/qa';

function normalizeBaseUrl(base) {
  return String(base || '').replace(/\/$/, '');
}

function joinQservicesUrl(base, path) {
  const b = normalizeBaseUrl(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

module.exports = {
  QA_QSERVICES_API_BASE_URL,
  normalizeBaseUrl,
  joinQservicesUrl,
};
