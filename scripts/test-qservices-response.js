#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  readQservicesJson,
  qservicesErrorToHttpStatus,
  bodyLooksLikeHtml,
} = require('../services/pegasus/qservices-response');

function mockResponse({ status, contentType, body, location }) {
  return {
    status,
    headers: {
      get(name) {
        if (name === 'content-type') return contentType || '';
        if (name === 'location') return location || '';
        return '';
      },
    },
    text: async () => body,
  };
}

(async () => {
  const html = mockResponse({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html></html>',
  });
  const htmlParsed = await readQservicesJson(html, {
    upstream: 'https://dev2.pegasusgateway.com/v2/',
    context: 'test',
  });
  assert.strictEqual(htmlParsed.ok, false);
  assert.strictEqual(htmlParsed.error.code, 'upstream_non_json_response');
  assert.strictEqual(qservicesErrorToHttpStatus(htmlParsed.error), 502);

  const redirect = mockResponse({
    status: 302,
    contentType: 'text/html',
    body: '',
    location: 'https://dev2.pegasusgateway.com/v2/',
  });
  const redirParsed = await readQservicesJson(redirect, {
    upstream: 'https://dev2.pegasusgateway.com/installations/api/v1/installation',
    context: 'test',
  });
  assert.strictEqual(redirParsed.ok, false);
  assert.strictEqual(redirParsed.error.code, 'upstream_redirect');

  const json = mockResponse({
    status: 200,
    contentType: 'application/json',
    body: '[{"_id":1}]',
  });
  const jsonParsed = await readQservicesJson(json, {
    upstream: 'https://qservices.pegasusgateway.com/qa/installations/api/v1/installation',
    context: 'test',
  });
  assert.strictEqual(jsonParsed.ok, true);
  assert.ok(Array.isArray(jsonParsed.data));

  assert.strictEqual(bodyLooksLikeHtml('<!DOCTYPE html>'), true);
  console.log('OK — test-qservices-response.js');
})();
