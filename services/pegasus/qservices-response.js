'use strict';

/**
 * Safe qservices response handling (JSON vs HTML redirects / SPA shells).
 */

function isHtmlContentType(contentType) {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.includes('text/html') || ct.includes('application/xhtml');
}

function bodyLooksLikeHtml(text) {
  if (!text) return false;
  const t = String(text).trimStart().slice(0, 200).toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

/**
 * @param {import('node-fetch').Response} response
 * @param {{ upstream: string, context?: string }} meta
 * @returns {Promise<
 *   | { ok: true, data: unknown }
 *   | { ok: false, error: { code: string, message: string, status: number, upstream: string, contentType?: string, preview?: string } }
 * >}
 */
async function readQservicesJson(response, { upstream, context }) {
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';

  if ([301, 302, 303, 307, 308].includes(status)) {
    const location = response.headers.get('location') || '';
    return {
      ok: false,
      error: {
        code: 'upstream_redirect',
        message:
          `Pegasus qservices redirected (${status}) to ${location || 'unknown location'}. ` +
          'Check QA_PEGASUS_BASE_URL — QA installations API is at https://qservices.pegasusgateway.com/qa.',
        status,
        upstream,
        contentType,
      },
    };
  }

  const text = await response.text();

  if (isHtmlContentType(contentType) || bodyLooksLikeHtml(text)) {
    return {
      ok: false,
      error: {
        code: 'upstream_non_json_response',
        message:
          'Pegasus qservices returned HTML instead of JSON (wrong base URL or SPA redirect). ' +
          'Use QA_PEGASUS_BASE_URL=https://qservices.pegasusgateway.com/qa with QA_PEGASUS_TOKEN from gateway dev2.pegasusgateway.com.',
        status,
        upstream,
        contentType: contentType || 'unknown',
        preview: text.slice(0, 120).replace(/\s+/g, ' '),
      },
    };
  }

  if (!text || !text.trim()) {
    return {
      ok: false,
      error: {
        code: 'upstream_empty_body',
        message: 'Pegasus qservices returned an empty body',
        status,
        upstream,
        contentType,
      },
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (parseErr) {
    return {
      ok: false,
      error: {
        code: 'upstream_invalid_json',
        message: `Pegasus qservices response is not valid JSON: ${parseErr.message}`,
        status,
        upstream,
        contentType,
        preview: text.slice(0, 120).replace(/\s+/g, ' '),
      },
    };
  }
}

function qservicesErrorToHttpStatus(error) {
  if (error.code === 'upstream_redirect' || error.code === 'upstream_non_json_response') {
    return 502;
  }
  if (error.status >= 400 && error.status < 600) return error.status;
  return 502;
}

module.exports = {
  readQservicesJson,
  qservicesErrorToHttpStatus,
  isHtmlContentType,
  bodyLooksLikeHtml,
};
