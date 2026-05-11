/**
 * Secondary IMEI orchestration: secondary group + secondary vehicle.
 */

function createSecondaryDeviceProcessor({ createOrUpdateSecondaryGroup, createSecondaryVehicle }) {
  async function processSecondaryDevice(
    secondaryImei,
    vin,
    clientName,
    licensePlate,
    vehiculoSubmarca
  ) {
    try {
      console.log(`   Processing secondary device: ${secondaryImei} for VIN: ${vin}`);

      // Create or get secondary group with naming pattern "client (2)"
      console.log(`   🏢 Creating/getting secondary group for client: ${clientName}`);
      const secondaryGroupResult = await createOrUpdateSecondaryGroup(clientName);
      const groupId2 = secondaryGroupResult.groupId;
      console.log(
        `   ✅ Secondary group ${secondaryGroupResult.created ? "created" : "retrieved"} with ID: ${groupId2}`
      );

      // Create secondary vehicle in Pegasus with secondary group ID
      const secondaryVehicleId = await createSecondaryVehicle(
        vin,
        secondaryImei,
        groupId2,
        licensePlate,
        vehiculoSubmarca
      );

      console.log(`   ✅ Secondary device processed successfully with vehicle ID: ${secondaryVehicleId}`);
      return secondaryVehicleId;
    } catch (error) {
      console.error(`   ❌ Error processing secondary device: ${error.message}`);
      throw error;
    }
  }

  return processSecondaryDevice;
}

module.exports = { createSecondaryDeviceProcessor };
