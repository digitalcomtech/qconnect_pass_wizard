/**
 * Worksheet clear (stub), primary vehicle create, secondary vehicle create.
 */

function normalizePegasusModel(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

function createVehicleHelpers({ pegasus, currentConfig }) {
  function pegasusVehicleModelFromSubmarca(vehiculoSubmarca) {
    const collapsed =
      vehiculoSubmarca == null ? "" : String(vehiculoSubmarca).replace(/\s+/g, " ").trim();
    const normalized = normalizePegasusModel(vehiculoSubmarca);
    if (collapsed.length > 30) {
      console.warn("[install] Pegasus vehicle model truncated (30 char limit)", {
        originalLength: collapsed.length,
        finalLength: normalized.length,
        finalValue: normalized,
      });
    }
    return normalized || "NoModel";
  }
  // Clear vehicles worksheet (simulated)
  async function clearVehiclesWorksheet() {
    try {
      console.log(`   Clearing vehicles worksheet rows 2-50...`);

      // In a real implementation, this would clear a Google Sheets or Excel file
      // For now, we'll simulate this action
      console.log(`   ✅ Vehicles worksheet cleared (simulated)`);

      // You could implement actual spreadsheet clearing here
      // await clearGoogleSheetRows('Mass Commands DI-361', 'Vehicles', 2, 50);
    } catch (error) {
      console.log(`   Error clearing vehicles worksheet: ${error.message}`);
      // Don't fail the entire workflow for this
    }
  }

  // Create vehicle in Pegasus
  async function createVehicle(vin, imei, groupId, licensePlate, vehiculoSubmarca) {
    try {
      console.log(`   Creating vehicle with VIN: ${vin}, IMEI: ${imei}, Group: ${groupId}`);
      let sanitizedPlate = licensePlate ? String(licensePlate).trim() : "";
      if (sanitizedPlate && sanitizedPlate.toUpperCase() === "NA") {
        sanitizedPlate = "";
      }

      const finalModel = pegasusVehicleModelFromSubmarca(vehiculoSubmarca);

      // Build vehicle payload based on dossier specifications
      const vehiclePayload = {
        name: vin,
        device: imei,
        year: "",
        make: "",
        model: finalModel,
        license_plate: sanitizedPlate,
        color: "",
        vin: vin,
        primary: parseInt(groupId),
        tank_volume: null,
        tank_unit: null,
        groups: currentConfig.defaultGroupId
          ? [currentConfig.defaultGroupId, parseInt(groupId)]
          : [parseInt(groupId)], // Use hardcoded group ID only in production
      };

      console.log(`   Vehicle payload:`, JSON.stringify(vehiclePayload, null, 2));

      const response = await pegasus.apiPostWithRetry(
        "create-vehicle",
        "/vehicles",
        vehiclePayload,
        currentConfig.pegasusToken,
        3
      );

      const vehicleData = await response.json();
      console.log(`   Vehicle creation response:`, JSON.stringify(vehicleData, null, 2));

      // Extract vehicle ID from response
      const vehicleId = vehicleData.id || vehicleData._id;
      if (!vehicleId) {
        throw new Error("No vehicle ID returned from Pegasus");
      }

      console.log(`   ✅ Vehicle created successfully with ID: ${vehicleId}`);
      return vehicleId;
    } catch (error) {
      console.error(`   ❌ Error creating vehicle: ${error.message}`);
      throw error;
    }
  }

  // Create secondary vehicle with secondary group ID
  async function createSecondaryVehicle(vin, imei, groupId2, licensePlate, vehiculoSubmarca) {
    try {
      console.log(
        `   Creating secondary vehicle with VIN: ${vin}, IMEI: ${imei}, Secondary Group: ${groupId2}`
      );
      let sanitizedPlate = licensePlate ? String(licensePlate).trim() : "";
      if (sanitizedPlate && sanitizedPlate.toUpperCase() === "NA") {
        sanitizedPlate = "";
      }

      const finalModel = pegasusVehicleModelFromSubmarca(vehiculoSubmarca);

      // Build vehicle payload for secondary device with secondary group ID
      const vehiclePayload = {
        name: `${vin} (2)`,
        device: imei,
        year: "",
        make: "",
        model: finalModel,
        license_plate: sanitizedPlate,
        color: "",
        vin: vin,
        primary: parseInt(groupId2), // Use secondary group ID as primary key
        tank_volume: null,
        tank_unit: null,
        groups: currentConfig.defaultGroupId2
          ? [currentConfig.defaultGroupId2, parseInt(groupId2)]
          : [parseInt(groupId2)], // Use hardcoded group ID only in production
      };

      console.log(`   Secondary vehicle payload:`, JSON.stringify(vehiclePayload, null, 2));

      const response = await pegasus.apiPostWithRetry(
        "create-secondary-vehicle",
        "/vehicles",
        vehiclePayload,
        currentConfig.pegasusToken,
        3
      );

      const vehicleData = await response.json();
      console.log(`   Secondary vehicle creation response:`, JSON.stringify(vehicleData, null, 2));

      // Extract vehicle ID from response
      const vehicleId = vehicleData.id || vehicleData._id;
      if (!vehicleId) {
        throw new Error("No vehicle ID returned from Pegasus for secondary vehicle");
      }

      console.log(`   ✅ Secondary vehicle created successfully with ID: ${vehicleId}`);
      return vehicleId;
    } catch (error) {
      console.error(`   ❌ Error creating secondary vehicle: ${error.message}`);
      throw error;
    }
  }

  return { clearVehiclesWorksheet, createVehicle, createSecondaryVehicle };
}

module.exports = { createVehicleHelpers };
