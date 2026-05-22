/**
 * Read-only SIM lookup: Pegasus256 first, then Pegasus1 (warehouse).
 * SuperSIM (8988) vs Wireless (8901). No mutations.
 */

function resolveSimType(iccid) {
  if (!iccid || typeof iccid !== "string") {
    return { ok: false, message: "ICCID is required" };
  }
  if (iccid.startsWith("8988")) {
    return {
      ok: true,
      simType: "SuperSIM",
      apiEndpoint: "https://api.pegasusgateway.com/m2m/supersims/v1/Sims",
    };
  }
  if (iccid.startsWith("8901")) {
    return {
      ok: true,
      simType: "Wireless",
      apiEndpoint: "https://api.pegasusgateway.com/m2m/wireless/v1/Sims",
    };
  }
  return {
    ok: false,
    message:
      "Invalid ICCID format. Must start with 8988 (SuperSIM) or 8901 (Wireless)",
    iccid,
  };
}

async function lookupSimInInstance(pegasus, { label, url, token, timeoutMs }) {
  try {
    const resp = await pegasus.apiGetFullUrl(
      `sim-lookup-${label.toLowerCase()}`,
      url,
      token,
      timeoutMs
    );
    if (!resp.ok) {
      return { found: false, instance: label, httpStatus: resp.status };
    }
    const data = await resp.json();
    const sims = data.sims || data.data || [];
    if (sims.length > 0) {
      return { found: true, instance: label, sim: sims[0], httpStatus: resp.status };
    }
    return { found: false, instance: label, httpStatus: resp.status };
  } catch (error) {
    return { found: false, instance: label, error: error.message };
  }
}

async function lookupSimByIccid(pegasus, currentConfig, iccid, { timeoutMs = 10000 } = {}) {
  const typeResult = resolveSimType(iccid);
  if (!typeResult.ok) {
    return {
      success: false,
      status: 400,
      message: typeResult.message,
      iccid,
    };
  }

  const { simType, apiEndpoint } = typeResult;
  const queryUrl = `${apiEndpoint}?Iccid=${encodeURIComponent(iccid)}`;
  const checkedInstances = [];

  const pegasus256 = await lookupSimInInstance(pegasus, {
    label: "Pegasus256",
    url: queryUrl,
    token: currentConfig.pegasus256Token,
    timeoutMs,
  });
  checkedInstances.push(pegasus256);

  if (pegasus256.found) {
    const sim = pegasus256.sim;
    return {
      success: true,
      status: 200,
      message: `${simType} SIM found in Pegasus256`,
      simData: {
        iccid: sim.iccid,
        status: sim.status,
        simType,
        fleet_sid: sim.fleet_sid || sim.fleet_id,
        account_sid: sim.account_sid || sim.account_id,
        date_created: sim.date_created,
        date_updated: sim.date_updated,
        foundIn: "Pegasus256",
      },
      checkedInstances: ["Pegasus256"],
    };
  }

  const pegasus1 = await lookupSimInInstance(pegasus, {
    label: "Pegasus1",
    url: queryUrl,
    token: currentConfig.pegasus1Token,
    timeoutMs,
  });
  checkedInstances.push(pegasus1);

  const auth401 =
    pegasus256.httpStatus === 401 ||
    pegasus1.httpStatus === 401 ||
    pegasus256.httpStatus === 403 ||
    pegasus1.httpStatus === 403;
  if (
    auth401 &&
    !pegasus256.found &&
    !pegasus1.found
  ) {
    return {
      success: false,
      status: 401,
      code: "pegasus_sim_token_expired",
      message:
        "Pegasus1/Pegasus256 token expired. Run npm run pegasus:fetch-tokens and restart the server.",
      simType,
      iccid,
      checkedInstances,
    };
  }

  if (pegasus1.found) {
    const sim = pegasus1.sim;
    return {
      success: true,
      status: 200,
      message: `${simType} SIM found in Pegasus1`,
      simData: {
        iccid: sim.iccid,
        status: sim.status,
        simType,
        fleet_sid: sim.fleet_sid || sim.fleet_id,
        account_sid: sim.account_sid || sim.account_id,
        date_created: sim.date_created,
        date_updated: sim.date_updated,
        foundIn: "Pegasus1",
      },
      checkedInstances: ["Pegasus256", "Pegasus1"],
    };
  }

  return {
    success: false,
    status: 404,
    message: `${simType} SIM not found in Pegasus256 or Pegasus1`,
    simType,
    iccid,
    checkedInstances: ["Pegasus256", "Pegasus1"],
  };
}

module.exports = { resolveSimType, lookupSimByIccid };
