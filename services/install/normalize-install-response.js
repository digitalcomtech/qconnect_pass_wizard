/**
 * Normalizes POST /api/install JSON responses for the provisioning receipt UI.
 * Preserves legacy top-level and details.* fields; adds predictable contract fields.
 */

const SECRET_KEY_PATTERN =
  /^(token|password|secret|authorization|bearer|apikey|api_key|credentials?)$/i;

const STEP_LABELS = {
  qservicesDuplicateCheck: "qservices duplicate check",
  repeatsRecord: "Repeats record",
  group: "Client group",
  vehicle: "Vehicle",
  primaryDeviceLink: "Primary device link",
  primarySim: "Primary SIM",
  secondary: "Secondary device",
  qservicesConfirmation: "qservices confirmation",
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeStepData(value, depth) {
  if (depth > 6) return undefined;
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStepData(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (!isPlainObject(value)) {
    if (typeof value === "string" && value.length > 500) {
      return value.slice(0, 500) + "…";
    }
    return value;
  }

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (key === "existingConfiguration" || key === "deviceData" || key === "setupResult") {
      continue;
    }
    const sanitized = sanitizeStepData(raw, depth + 1);
    if (sanitized !== undefined) out[key] = sanitized;
  }
  return Object.keys(out).length ? out : undefined;
}

function environmentLabel(environment) {
  if (!environment) return undefined;
  const normalized = String(environment).toLowerCase();
  if (normalized === "production" || normalized === "prod") return "PROD";
  if (normalized === "qa") return "QA";
  return String(environment).toUpperCase();
}

function buildInstallContext(body, environment) {
  if (!body || typeof body !== "object") {
    return { environment: environmentLabel(environment) };
  }
  return {
    environment: environmentLabel(environment),
    clientName: body.client_name != null ? String(body.client_name) : undefined,
    vin: body.vin != null ? String(body.vin) : undefined,
    installationId:
      body.installationId != null ? String(body.installationId) : undefined,
    primaryImei: body.imei != null ? String(body.imei) : undefined,
    primarySim: body.sim_number != null ? String(body.sim_number) : undefined,
    secondaryEnabled: !!body.secondary_imei,
    secondaryImei:
      body.secondary_imei != null ? String(body.secondary_imei) : undefined,
    secondarySim:
      body.secondary_sim_number != null ? String(body.secondary_sim_number) : undefined,
  };
}

function legacyStepToNormalized(id, label, legacyStep) {
  if (!legacyStep || typeof legacyStep !== "object") return null;

  let status = "success";
  let message = legacyStep.reason || legacyStep.message || undefined;

  if (legacyStep.ok === false) {
    status = "failed";
  } else if (
    legacyStep.skipped ||
    legacyStep.action === "skipped" ||
    legacyStep.action === "not_applicable"
  ) {
    status = "skipped";
    if (legacyStep.action === "not_applicable") {
      message = legacyStep.reason || "Not applicable for this provision path";
    }
  }

  if (legacyStep.hos && legacyStep.hos.reason) {
    message = [message, "HOS: " + legacyStep.hos.reason].filter(Boolean).join(" · ");
  }

  const data = sanitizeStepData(legacyStep, 0);
  return {
    id,
    label,
    status,
    message,
    data: data && Object.keys(data).length ? data : undefined,
  };
}

function buildStepsArrayFromLegacy(stepsByKey, details, body) {
  const steps = [];
  if (!stepsByKey || typeof stepsByKey !== "object") {
    return steps;
  }

  const push = (id, label, key) => {
    const normalized = legacyStepToNormalized(id, label, stepsByKey[key]);
    if (normalized) steps.push(normalized);
  };

  push("qservices_duplicate_check", STEP_LABELS.qservicesDuplicateCheck, "qservicesDuplicateCheck");
  push("repeats_record", STEP_LABELS.repeatsRecord, "repeatsRecord");
  push("pegasus_group", STEP_LABELS.group, "group");
  push("pegasus_vehicle", STEP_LABELS.vehicle, "vehicle");
  push("primary_device_link", STEP_LABELS.primaryDeviceLink, "primaryDeviceLink");
  push("primary_sim", STEP_LABELS.primarySim, "primarySim");

  const secondary = stepsByKey.secondary;
  if (secondary && typeof secondary === "object") {
    if (secondary.action === "skipped") {
      steps.push(
        legacyStepToNormalized("secondary_device", STEP_LABELS.secondary, secondary) || {
          id: "secondary_device",
          label: STEP_LABELS.secondary,
          status: "skipped",
          message: secondary.reason,
        }
      );
    } else {
      steps.push({
        id: "secondary_device",
        label: STEP_LABELS.secondary,
        status: "success",
        message: secondary.imei ? "IMEI " + secondary.imei : undefined,
        data: sanitizeStepData({ imei: secondary.imei }, 0),
      });
      if (secondary.sim) {
        steps.push(
          legacyStepToNormalized("secondary_sim", "Secondary SIM", secondary.sim) || {
            id: "secondary_sim",
            label: "Secondary SIM",
            status: secondary.sim.action === "skipped" ? "skipped" : "success",
            message: secondary.sim.reason,
          }
        );
      }
      if (secondary.hos && secondary.hos.reason) {
        const hosStatus =
          secondary.hos.configured === false && /already/i.test(secondary.hos.reason)
            ? "warning"
            : "success";
        steps.push({
          id: "secondary_hos",
          label: "Secondary HOS",
          status: hosStatus,
          message: secondary.hos.reason,
          data: sanitizeStepData(
            { configured: secondary.hos.configured, reason: secondary.hos.reason },
            0
          ),
        });
      }
    }
  }

  push(
    "qservices_confirmation",
    STEP_LABELS.qservicesConfirmation,
    "qservicesConfirmation"
  );

  if (details && details.hosConfiguration && details.hosConfiguration.primary) {
    const primaryHos = details.hosConfiguration.primary;
    const hosStatus =
      primaryHos.configured === false && /already/i.test(primaryHos.reason || "")
        ? "warning"
        : primaryHos.configured
          ? "success"
          : "warning";
    steps.push({
      id: "primary_hos",
      label: "Primary HOS",
      status: hosStatus,
      message: primaryHos.reason,
      data: sanitizeStepData(
        { configured: primaryHos.configured, reason: primaryHos.reason },
        0
      ),
    });
  }

  return steps;
}

function collectWarnings(details) {
  const warnings = Array.isArray(details?.warnings) ? [...details.warnings] : [];
  const hos = details?.hosConfiguration;
  if (hos?.primary?.reason) {
    warnings.push("Primary HOS: " + hos.primary.reason);
  }
  if (hos?.secondary?.reason) {
    warnings.push("Secondary HOS: " + hos.secondary.reason);
  }
  return [...new Set(warnings.map(String))];
}

function buildErrorsFromResponse(json, httpStatus) {
  const errors = Array.isArray(json?.details?.errors) ? [...json.details.errors] : [];

  if (errors.length) {
    return errors.map((entry) => ({
      code: entry.code,
      message: entry.message != null ? String(entry.message) : "Unknown error",
      stepId: entry.stepId,
      data: sanitizeStepData(entry.data, 0),
    }));
  }

  if (json?.success === true || json?.status === "success") {
    return [];
  }

  const message =
    json?.message != null
      ? String(json.message)
      : httpStatus >= 500
        ? "Internal server error"
        : "Request failed";

  const code = json?.code != null ? String(json.code) : undefined;
  let stepId = "install_workflow";

  if (code === "DUPLICATE_CHECK_UNAVAILABLE") {
    stepId = "qservices_duplicate_check";
  } else if (/duplicate/i.test(message)) {
    stepId = "qservices_duplicate_check";
  } else if (/missing one of/i.test(message)) {
    stepId = "request_validation";
  }

  const entry = {
    code,
    message,
    stepId,
    data: undefined,
  };

  if (json?.duplicateCheck) {
    entry.data = sanitizeStepData(json.duplicateCheck, 0);
  }

  return [entry];
}

function pickLegacyFields(json) {
  if (!json || typeof json !== "object") return undefined;
  const legacy = {};
  if (json.workflow != null) legacy.workflow = json.workflow;
  if (json.duplicateCheck != null) legacy.duplicateCheck = sanitizeStepData(json.duplicateCheck, 0);
  if (json.error != null) legacy.error = String(json.error);
  if (json.details?.stepsByKey) {
    legacy.stepsByKey = json.details.stepsByKey;
  } else if (json.details?.steps && !Array.isArray(json.details.steps)) {
    legacy.stepsByKey = sanitizeStepData(json.details.steps, 0);
  }
  return Object.keys(legacy).length ? legacy : undefined;
}

function resolveOutcome(httpStatus, json) {
  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const explicitSuccess = json?.status === "success" || json?.success === true;
  const explicitPartial = json?.status === "partial";
  const success = httpOk && explicitSuccess;
  const partial = httpOk && explicitPartial;
  const status = success ? "success" : partial ? "partial" : "failed";
  const successFlag = success || partial;
  return { success: successFlag, status, httpOk };
}

/**
 * @param {{ httpStatus: number, json: object, body?: object, environment?: string, requestId?: string }} input
 * @returns {object}
 */
function normalizeInstallResponse({ httpStatus, json, body, environment, requestId }) {
  const source = json && typeof json === "object" ? { ...json } : {};
  const timestamp =
    source.details?.timestamp || source.timestamp || new Date().toISOString();
  const { success, status } = resolveOutcome(httpStatus, source);
  const context = buildInstallContext(body, environment);

  const stepsByKey =
    source.details?.stepsByKey ||
    (source.details?.steps && !Array.isArray(source.details.steps)
      ? source.details.steps
      : null);

  const stepsArray = Array.isArray(source.details?.steps)
    ? source.details.steps.map((step) => ({
        id: step.id,
        label: step.label,
        status: step.status,
        message: step.message,
        data: sanitizeStepData(step.data, 0),
      }))
    : buildStepsArrayFromLegacy(stepsByKey, source.details, body);

  const warnings = collectWarnings(source.details);
  const errors = success ? [] : buildErrorsFromResponse(source, httpStatus);

  if (!success && errors.length && stepsArray.length === 0) {
    const err = errors[0];
    stepsArray.push({
      id: err.stepId || "install_workflow",
      label: STEP_LABELS[err.stepId] || "Install workflow",
      status: "failed",
      message: err.message,
      data: err.data,
    });
  }

  const sanitizedHos = sanitizeStepData(source.details?.hosConfiguration, 0);
  const details = {
    ...(source.details?.groupId != null ? { groupId: source.details.groupId } : {}),
    ...(source.details?.vehicleId != null ? { vehicleId: source.details.vehicleId } : {}),
    ...(source.details?.simProcessed != null
      ? { simProcessed: source.details.simProcessed }
      : {}),
    ...(source.details?.secondaryDeviceProcessed != null
      ? { secondaryDeviceProcessed: source.details.secondaryDeviceProcessed }
      : {}),
    ...(source.details?.secondarySimProcessed != null
      ? { secondarySimProcessed: source.details.secondarySimProcessed }
      : {}),
    ...(sanitizedHos ? { hosConfiguration: sanitizedHos } : {}),
    timestamp,
    steps: stepsArray,
    ...(warnings.length ? { warnings } : {}),
    ...(errors.length ? { errors } : {}),
    ...(stepsByKey ? { stepsByKey: sanitizeStepData(stepsByKey, 0) } : {}),
  };

  const legacy = pickLegacyFields(source);
  const normalized = {
    success,
    status,
    message:
      source.message != null
        ? String(source.message)
        : success
          ? "Complete installation workflow executed successfully"
          : "Request failed",
    ...(source.code != null ? { code: String(source.code) } : {}),
    ...(requestId ? { requestId: String(requestId) } : {}),
    timestamp,
    context,
    details,
    ...(legacy ? { legacy } : {}),
  };

  // Backwards compatibility: preserve fields consumers already read at the root.
  if (success || source.status === "success") {
    normalized.status = "success";
  }
  if (source.workflow != null) normalized.workflow = source.workflow;
  if (source.duplicateCheck != null) {
    normalized.duplicateCheck = sanitizeStepData(source.duplicateCheck, 0);
  }
  if (source.error != null && !success) {
    normalized.error = String(source.error);
  }

  return normalized;
}

module.exports = {
  normalizeInstallResponse,
  sanitizeStepData,
  buildInstallContext,
  buildStepsArrayFromLegacy,
  environmentLabel,
};
