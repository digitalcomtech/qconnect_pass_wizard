/**
 * SIM warehouse lookup + activate (Pegasus1) / status update (Pegasus256).
 */

function createSimHelpers({ pegasus, currentConfig }) {
  // Activate SIM in Pegasus1
  async function activateSimInPegasus1(simSid, apiEndpoint) {
    try {
      console.log(`   Activating SIM ${simSid} in Pegasus1...`);

      const response = await pegasus.apiPostFullUrl(
        "activate-sim-pegasus1",
        `${apiEndpoint}/${simSid}`,
        { Status: "active" },
        currentConfig.pegasus1Token,
        30000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to activate SIM in Pegasus1: ${response.status} - ${errorText}`);
      }

      console.log(`   ✅ SIM activated in Pegasus1`);
    } catch (error) {
      console.error(`   ❌ Error activating SIM in Pegasus1: ${error.message}`);
      throw error;
    }
  }

  // Update SIM status in Pegasus256
  async function updateSimStatusInPegasus256(simSid, apiEndpoint) {
    try {
      console.log(`   Updating SIM ${simSid} status in Pegasus256...`);

      const response = await pegasus.apiPostFullUrl(
        "update-sim-pegasus256",
        `${apiEndpoint}/${simSid}`,
        { Status: "active" },
        currentConfig.pegasus256Token,
        30000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update SIM status in Pegasus256: ${response.status} - ${errorText}`);
      }

      console.log(`   ✅ SIM status updated in Pegasus256`);
    } catch (error) {
      console.error(`   ❌ Error updating SIM status in Pegasus256: ${error.message}`);
      throw error;
    }
  }

  // Process SIM card based on type (SuperSIM vs Wireless)
  async function processSimCard(simNumber) {
    try {
      console.log(`   Processing SIM card: ${simNumber}`);

      // Determine SIM type based on first 4 digits
      const simPrefix = simNumber.substring(0, 4);
      let simType, apiEndpoint;

      if (simPrefix === "8988") {
        simType = "SuperSIM";
        apiEndpoint = "https://api.pegasusgateway.com/m2m/supersims/v1/Sims";
      } else if (simPrefix === "8901") {
        simType = "Wireless";
        apiEndpoint = "https://api.pegasusgateway.com/m2m/wireless/v1/Sims";
      } else {
        throw new Error(
          `Invalid SIM ICCID format: ${simNumber}. Must start with 8988 (SuperSIM) or 8901 (Wireless)`
        );
      }

      console.log(`   SIM Type: ${simType}, Endpoint: ${apiEndpoint}`);

      // Check if SIM exists in Pegasus256 first
      let simFound = false;
      let simData = null;
      let foundIn = null;

      try {
        console.log(`   Checking Pegasus256 for ${simType} SIM...`);
        const pegasus256Response = await pegasus.apiGetFullUrl(
          "process-sim-lookup-256",
          `${apiEndpoint}?Iccid=${encodeURIComponent(simNumber)}`,
          currentConfig.pegasus256Token,
          30000
        );

        if (pegasus256Response.ok) {
          const pegasus256Data = await pegasus256Response.json();
          const sims = pegasus256Data.sims || pegasus256Data.data || [];

          if (sims.length > 0) {
            simFound = true;
            simData = sims[0];
            foundIn = "Pegasus256";
            console.log(`   ✅ SIM found in Pegasus256`);
          }
        }
      } catch (error) {
        console.log(`   Error checking Pegasus256: ${error.message}`);
      }

      // If not found in Pegasus256, check Pegasus1
      if (!simFound) {
        try {
          console.log(`   Checking Pegasus1 for ${simType} SIM...`);
          const pegasus1Response = await pegasus.apiGetFullUrl(
            "process-sim-lookup-1",
            `${apiEndpoint}?Iccid=${encodeURIComponent(simNumber)}`,
            currentConfig.pegasus1Token,
            30000
          );

          if (pegasus1Response.ok) {
            const pegasus1Data = await pegasus1Response.json();
            const sims = pegasus1Data.sims || pegasus1Data.data || [];

            if (sims.length > 0) {
              simFound = true;
              simData = sims[0];
              foundIn = "Pegasus1";
              console.log(`   ✅ SIM found in Pegasus1`);
            }
          }
        } catch (error) {
          console.log(`   Error checking Pegasus1: ${error.message}`);
        }
      }

      if (!simFound) {
        throw new Error(`${simType} SIM not found in either Pegasus instance`);
      }

      // Process SIM based on where it was found
      if (foundIn === "Pegasus1") {
        console.log(`   SIM is in Pegasus1 warehouse, activating...`);
        // Activate SIM in Pegasus1
        await activateSimInPegasus1(simData.sid, apiEndpoint);
      } else {
        console.log(`   SIM is already in Pegasus256, updating status...`);
        // Update SIM status in Pegasus256
        await updateSimStatusInPegasus256(simData.sid, apiEndpoint);
      }

      console.log(`   ✅ SIM card processed successfully`);
    } catch (error) {
      console.error(`   ❌ Error processing SIM card: ${error.message}`);
      throw error;
    }
  }

  return { processSimCard };
}

module.exports = { createSimHelpers };
