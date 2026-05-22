'use strict';

/**
 * Load .env.local then resolve active Pegasus config (same shape as server.js).
 * Clears config module cache so process.env from .env.local is applied.
 */

const { loadEnvLocal } = require('./load-env-local');

function resolveEnvironment(config) {
  const raw = process.env.ENVIRONMENT || config.ENVIRONMENT || 'qa';
  return String(raw).toLowerCase() === 'production' ? 'production' : 'qa';
}

function buildEnvConfig(config) {
  return {
    production: config.production,
    qa: config.qa,
  };
}

function getCurrentEnvConfig(config, environment) {
  const envConfig = buildEnvConfig(config);
  return envConfig[environment] || envConfig.qa;
}

/**
 * @param {{ loadEnvLocal?: boolean, override?: boolean, envPath?: string }} [options]
 */
function getRuntimeAppConfig(options = {}) {
  if (options.loadEnvLocal !== false) {
    loadEnvLocal({
      override: options.override !== false,
      path: options.envPath,
    });
  }

  const configPath = require.resolve('../config');
  delete require.cache[configPath];
  const config = require('../config');
  const environment = resolveEnvironment(config);
  const currentConfig = getCurrentEnvConfig(config, environment);

  return {
    config,
    environment,
    currentConfig,
    envConfig: buildEnvConfig(config),
  };
}

function createRuntimePegasusClient(runtime) {
  const { createPegasusClient } = require('../pegasus-client');
  const { config, currentConfig } = runtime;
  return createPegasusClient({
    currentConfig,
    apiBaseUrl: config.pegasus && config.pegasus.baseUrl,
    defaultTimeoutMs: (config.api && config.api.timeout) || 30000,
  });
}

module.exports = {
  getRuntimeAppConfig,
  createRuntimePegasusClient,
  resolveEnvironment,
  buildEnvConfig,
  getCurrentEnvConfig,
};
