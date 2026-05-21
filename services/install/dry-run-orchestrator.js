'use strict';

/**
 * Server-side install dry-run — validation and read-only planning only.
 */

const { buildPegasusCredentialDiagnostics } = require('../pegasus/credential-diagnostics');
const {
  cleanClientName,
  planGroupForClient,
  planDeviceForImei,
  planSimForIccid,
  planVehicleAction,
  planHosFromCheck,
} = require('./plan-helpers');

function step(id, label, status, message, data) {
  return {
    id,
    label,
    status,
    message,
    data: { dryRun: true, ...(data || {}) },
  };
}

function credentialWarnings(currentConfig, environment) {
  const creds = buildPegasusCredentialDiagnostics(currentConfig, environment);
  const warnings = [];
  if (!creds.qservicesTokenConfigured) {
    warnings.push(
      'qservices Bearer not configured — duplicate check and confirmation may fail on real install.'
    );
  }
  if (!creds.pegasus1TokenConfigured) {
    warnings.push('Pegasus1 token missing — group/vehicle/device APIs may fail on real install.');
  }
  if (!creds.pegasus256TokenConfigured) {
    warnings.push('Pegasus256 token missing — some SIM paths may fail on real install.');
  }
  return warnings;
}

function createDryRunOrchestrator({
  ENVIRONMENT,
  TEST_MODE,
  currentConfig,
  pegasus,
  checkDuplicateInstallation,
  checkHosSegmentConfiguration,
}) {
  async function runInstallDryRun({ body }) {
    const {
      client_name,
      imei,
      sim_number,
      vin,
      installationId,
      secondary_imei,
      secondary_sim_number,
      license_plate,
      vehiculo_submarca,
    } = body || {};

    const warnings = [];
    const errors = [];
    const steps = [];

    if (!client_name || !imei || !vin || !installationId) {
      return {
        status: 400,
        json: {
          success: false,
          status: 'failed',
          code: 'VALIDATION_ERROR',
          message: 'Missing one of client_name, imei, vin, installationId',
          details: { dryRun: true, steps: [], warnings: [], errors: [] },
        },
      };
    }

    warnings.push(...credentialWarnings(currentConfig, ENVIRONMENT));
    warnings.push('Dry-run only — no Pegasus mutations, repeats, or confirmations were performed.');

    if (TEST_MODE) {
      return {
        status: 200,
        json: {
          success: true,
          status: 'success',
          code: 'DRY_RUN',
          message: 'Test mode: dry-run plan simulated (no Pegasus calls)',
          details: {
            dryRun: true,
            testMode: true,
            steps: [
              step('request_validation', 'Request validation', 'success', 'Required fields present'),
              step('qservices_duplicate_check', 'qservices duplicate check', 'skipped', 'Skipped in TEST_MODE'),
              step('repeats_record', 'Repeats record', 'skipped', 'Skipped in dry-run'),
              step('pegasus_group', 'Client group', 'skipped', 'Skipped in TEST_MODE'),
              step('pegasus_vehicle', 'Vehicle', 'skipped', 'Skipped in TEST_MODE'),
              step('primary_device_link', 'Primary device link', 'skipped', 'Skipped in TEST_MODE'),
            ],
            warnings,
            errors: [],
            timestamp: new Date().toISOString(),
          },
        },
      };
    }

    steps.push(
      step('request_validation', 'Request validation', 'success', 'Required fields present', {
        client_name: cleanClientName(client_name),
        vin,
        installationId,
        imei,
      })
    );

    const dupResult = await checkDuplicateInstallation(installationId);
    if (dupResult.outcome === 'duplicate') {
      steps.push(
        step(
          'qservices_duplicate_check',
          'qservices duplicate check',
          'failed',
          'Installation already completed or confirmed',
          { outcome: dupResult.outcome, installationStatus: dupResult.installationStatus }
        )
      );
      return {
        status: 400,
        json: {
          success: false,
          status: 'failed',
          code: 'DUPLICATE_INSTALLATION',
          message: 'Installation ID already exists in system — duplicate detected',
          details: {
            dryRun: true,
            steps,
            warnings,
            errors: [
              {
                code: 'DUPLICATE_INSTALLATION',
                message: 'Duplicate installation',
                stepId: 'qservices_duplicate_check',
              },
            ],
            timestamp: new Date().toISOString(),
          },
        },
      };
    }
    if (dupResult.outcome === 'lookup_failed') {
      steps.push(
        step(
          'qservices_duplicate_check',
          'qservices duplicate check',
          'warning',
          dupResult.reason || 'Duplicate check uncertain',
          { outcome: dupResult.outcome, httpStatus: dupResult.httpStatus }
        )
      );
      warnings.push(
        'Could not verify installation duplicate status — real install may abort for safety.'
      );
    } else {
      steps.push(
        step(
          'qservices_duplicate_check',
          'qservices duplicate check',
          'success',
          'No duplicate installation detected',
          { outcome: dupResult.outcome }
        )
      );
    }

    steps.push(
      step(
        'repeats_record',
        'Repeats record',
        'skipped',
        'Would record repeats on real install — skipped in dry-run',
        { action: 'record_repeats', skipped: true }
      )
    );

    const groupPlan = await planGroupForClient(pegasus, currentConfig, client_name);
    steps.push(
      step('pegasus_group', 'Client group', groupPlan.status, groupPlan.message, groupPlan.data)
    );
    const plannedGroupId = groupPlan.data && groupPlan.data.groupId;

    const primaryDevice = await planDeviceForImei(pegasus, currentConfig, imei);
    steps.push(
      step(
        'primary_device_link',
        'Primary device link',
        primaryDevice.status,
        primaryDevice.message,
        primaryDevice.data
      )
    );
    if (primaryDevice.status === 'failed') {
      errors.push({
        code: 'DEVICE_NOT_READY',
        message: primaryDevice.message,
        stepId: 'primary_device_link',
      });
    }

    const vehiclePlan = planVehicleAction({
      vin,
      imei,
      groupId: plannedGroupId,
      licensePlate: license_plate,
      vehiculoSubmarca: vehiculo_submarca,
      defaultGroupId: currentConfig.defaultGroupId,
    });
    steps.push(
      step('pegasus_vehicle', 'Vehicle', vehiclePlan.status, vehiclePlan.message, vehiclePlan.data)
    );

    if (sim_number) {
      const simPlan = await planSimForIccid(pegasus, currentConfig, sim_number);
      steps.push(
        step('primary_sim', 'Primary SIM', simPlan.status, simPlan.message, simPlan.data)
      );
      if (simPlan.status === 'failed') {
        errors.push({
          code: 'SIM_NOT_READY',
          message: simPlan.message,
          stepId: 'primary_sim',
        });
      }
    } else {
      steps.push(
        step('primary_sim', 'Primary SIM', 'skipped', 'No primary SIM in request', {
          action: 'process_sim',
          skipped: true,
        })
      );
    }

    try {
      const hosCheck = await checkHosSegmentConfiguration(imei);
      const hosPlan = planHosFromCheck(hosCheck);
      steps.push(
        step('primary_hos', 'Primary HOS', hosPlan.status, hosPlan.message, hosPlan.data)
      );
    } catch (hosErr) {
      steps.push(
        step('primary_hos', 'Primary HOS', 'warning', hosErr.message, {
          action: 'hos_segment',
        })
      );
      warnings.push('Primary HOS check failed: ' + hosErr.message);
    }

    if (secondary_imei) {
      const secGroupName = `${cleanClientName(client_name)} (2)`;
      const secGroupPlan = await planGroupForClient(pegasus, currentConfig, secGroupName);
      steps.push(
        step(
          'secondary_group',
          'Secondary group',
          secGroupPlan.status,
          secGroupPlan.message,
          secGroupPlan.data
        )
      );

      const secDevice = await planDeviceForImei(pegasus, currentConfig, secondary_imei);
      steps.push(
        step(
          'secondary_device',
          'Secondary device',
          secDevice.status,
          secDevice.message,
          secDevice.data
        )
      );
      if (secDevice.status === 'failed') {
        errors.push({
          code: 'SECONDARY_DEVICE_NOT_READY',
          message: secDevice.message,
          stepId: 'secondary_device',
        });
      }

      if (secondary_sim_number) {
        const secSim = await planSimForIccid(pegasus, currentConfig, secondary_sim_number);
        steps.push(
          step('secondary_sim', 'Secondary SIM', secSim.status, secSim.message, secSim.data)
        );
      } else {
        steps.push(
          step('secondary_sim', 'Secondary SIM', 'skipped', 'No secondary SIM in request', {
            skipped: true,
          })
        );
      }
    } else {
      steps.push(
        step('secondary_device', 'Secondary device', 'skipped', 'No secondary device in request', {
          skipped: true,
        })
      );
    }

    steps.push(
      step(
        'qservices_confirmation',
        'qservices confirmation',
        'skipped',
        'Office provision path — confirmation not invoked',
        { action: 'confirm_installation', skipped: true }
      )
    );

    const blocking = errors.length > 0;
    const success = !blocking;

    return {
      status: success ? 200 : 400,
      json: {
        success,
        status: success ? 'success' : 'failed',
        code: 'DRY_RUN',
        message: success
          ? 'Server dry-run complete — no Pegasus mutations performed'
          : 'Server dry-run found blocking issues — review steps and errors',
        details: {
          dryRun: true,
          plannedGroupId: plannedGroupId || null,
          steps,
          warnings,
          errors,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }

  return { runInstallDryRun };
}

module.exports = { createDryRunOrchestrator };
