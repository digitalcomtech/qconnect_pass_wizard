'use strict';

/**
 * Read-only Pegasus planning helpers (no POST mutations).
 */

const { resolveApiAuthenticateToken } = require('../pegasus/auth-token');
const { lookupSimByIccid } = require('../pegasus/sim-lookup');

function cleanClientName(clientName) {
  return String(clientName || '')
    .replace(/\s+NA\s*\/?\s*$/i, '')
    .trim();
}

async function searchGroupByName(pegasus, currentConfig, groupName) {
  const token = resolveApiAuthenticateToken(currentConfig);
  const searchPath = `/groups?select=name&search.name="${encodeURIComponent(groupName)}"`;
  const searchResponse = await pegasus.apiGet(
    'plan-search-group',
    searchPath,
    token,
    30000
  );

  if (!searchResponse.ok) {
    const reason = await searchResponse.text().catch(() => searchResponse.statusText);
    return { ok: false, httpStatus: searchResponse.status, reason: pegasus.truncate(reason, 200) };
  }

  const searchData = await searchResponse.json();
  let groups = null;
  if (Array.isArray(searchData)) groups = searchData;
  else if (searchData && Array.isArray(searchData.data)) groups = searchData.data;

  if (groups && groups.length > 0) {
    const g = groups[0];
    const groupId = g.id || g._id;
    return { ok: true, groupId, created: false, groupName };
  }
  return { ok: true, groupId: null, created: true, groupName };
}

async function planGroupForClient(pegasus, currentConfig, clientName) {
  const name = cleanClientName(clientName);
  const result = await searchGroupByName(pegasus, currentConfig, name);
  if (!result.ok) {
    return {
      status: 'warning',
      message: `Could not search for group (HTTP ${result.httpStatus})`,
      dryRun: true,
      data: { action: 'create_or_get_group', wouldCreate: true, searchFailed: true },
    };
  }
  if (result.groupId) {
    return {
      status: 'success',
      message: `Would use existing group ${result.groupId}`,
      dryRun: true,
      data: { action: 'create_or_get_group', groupId: result.groupId, created: false },
    };
  }
  return {
    status: 'success',
    message: 'Would create new Pegasus group for client',
    dryRun: true,
    data: { action: 'create_or_get_group', wouldCreate: true, groupName: name },
  };
}

async function planDeviceForImei(pegasus, currentConfig, imei) {
  const token = resolveApiAuthenticateToken(currentConfig);
  const resp = await pegasus.apiGet(
    'plan-device',
    `/devices/${encodeURIComponent(imei)}`,
    token,
    30000
  );

  if (resp.status === 404) {
    return {
      status: 'failed',
      message: 'IMEI not found in Pegasus',
      dryRun: true,
      data: { imei, found: false },
    };
  }

  if (!resp.ok) {
    return {
      status: 'warning',
      message: `Device lookup HTTP ${resp.status}`,
      dryRun: true,
      data: { imei, httpStatus: resp.status },
    };
  }

  const deviceData = await resp.json();
  const linked =
    deviceData.vehicle && (deviceData.vehicle.id || deviceData.vehicle.name);
  if (linked) {
    return {
      status: 'failed',
      message: 'Device already linked to a vehicle',
      dryRun: true,
      data: {
        imei,
        found: true,
        linked: true,
        vehicleId: deviceData.vehicle.id,
        vehicleName: deviceData.vehicle.name,
      },
    };
  }

  return {
    status: 'success',
    message: 'Device found and available to link',
    dryRun: true,
    data: {
      imei,
      found: true,
      linked: false,
      deviceState: deviceData.state || deviceData.connection?.state,
    },
  };
}

async function planSimForIccid(pegasus, currentConfig, iccid) {
  const lookup = await lookupSimByIccid(pegasus, currentConfig, iccid);
  if (!lookup.success) {
    return {
      status: 'failed',
      message: lookup.message || 'SIM not found',
      dryRun: true,
      data: { iccid, found: false },
    };
  }

  const wouldAction =
    lookup.foundIn === 'Pegasus256'
      ? 'update_status_active_pegasus256'
      : 'activate_pegasus1';

  return {
    status: 'success',
    message: `Would process SIM via ${lookup.foundIn} (${wouldAction})`,
    dryRun: true,
    data: {
      iccid,
      simType: lookup.simType,
      foundIn: lookup.foundIn,
      status: lookup.status,
      wouldAction,
    },
  };
}

function planVehicleAction({ vin, imei, groupId, licensePlate, vehiculoSubmarca, defaultGroupId }) {
  const groups = [];
  if (defaultGroupId) groups.push(parseInt(defaultGroupId, 10));
  if (groupId) groups.push(parseInt(groupId, 10));
  return {
    status: 'success',
    message: groupId
      ? `Would create/link vehicle for VIN ${vin} with group ${groupId}`
      : 'Would create vehicle after group is resolved',
    dryRun: true,
    data: {
      action: 'create_vehicle',
      vin,
      imei,
      groupId: groupId || null,
      licensePlate: licensePlate || '',
      groups: [...new Set(groups.filter(Boolean))],
      modelNote: vehiculoSubmarca ? String(vehiculoSubmarca).slice(0, 30) : 'NoModel',
    },
  };
}

function planHosFromCheck(hosCheck) {
  if (!hosCheck || hosCheck.error) {
    return {
      status: 'warning',
      message: 'HOS check unavailable',
      dryRun: true,
      data: { action: 'hos_segment', skipped: true },
    };
  }
  if (hosCheck.hasConfiguration) {
    return {
      status: 'skipped',
      message: 'HOS already configured — would skip setup',
      dryRun: true,
      data: { action: 'hos_segment', configured: false, reason: hosCheck.reason },
    };
  }
  return {
    status: 'success',
    message: 'Would configure HOS segment defaults',
    dryRun: true,
    data: { action: 'hos_segment', wouldConfigure: true },
  };
}

module.exports = {
  cleanClientName,
  searchGroupByName,
  planGroupForClient,
  planDeviceForImei,
  planSimForIccid,
  planVehicleAction,
  planHosFromCheck,
};
