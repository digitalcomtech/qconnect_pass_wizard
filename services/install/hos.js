/**
 * HOS segment check + setup (primary/secondary device install steps).
 */

const { resolveApiAuthenticateToken } = require('../pegasus/auth-token');

function createHosHelpers({ pegasus, currentConfig }) {
  const apiToken = () => resolveApiAuthenticateToken(currentConfig);
  // Check if device has HOS segment configuration
  async function checkHosSegmentConfiguration(imei) {
    try {
      console.log(`   Checking HOS segment configuration for IMEI: ${imei}`);

      const response = await pegasus.apiGet(
        "hos-segment-check",
        `/devices?imeis=${encodeURIComponent(imei)}&select=segments`,
        apiToken(),
        30000
      );

      if (!response.ok) {
        const t = await response.text();
        throw new Error(
          `Failed to check HOS segment configuration: ${response.status} - ${pegasus.truncate(t, 200)}`
        );
      }

      const data = await response.json();
      console.log(`   HOS segment check: keys=${Object.keys(data || {}).join(",")}`);

      // Check if device has HOS segment configuration
      const deviceData = data.data && data.data[0];
      if (!deviceData) {
        console.log(`   ❌ No device data found for IMEI: ${imei}`);
        return { hasConfiguration: false, reason: "Device not found" };
      }

      const hasHosConfiguration =
        deviceData.segments && deviceData.segments.setup && deviceData.segments.setup.hos;

      console.log(`   HOS configuration status: ${hasHosConfiguration ? "EXISTS" : "MISSING"}`);

      return {
        hasConfiguration: hasHosConfiguration,
        deviceData: deviceData,
        reason: hasHosConfiguration
          ? "Configuration exists"
          : "No HOS segment configuration found",
      };
    } catch (error) {
      console.error(`   ❌ Error checking HOS segment configuration: ${error.message}`);
      throw error;
    }
  }

  // Set HOS segment configuration with default values
  async function setHosSegmentConfiguration(imei) {
    try {
      console.log(`   Setting HOS segment configuration for IMEI: ${imei}`);

      const hosPayload = {
        segment_type: "hos",
        signal: "speed_distance",
        max_work_hours: 14,
        min_rest_hours: 8,
        max_continuous_work_hours: 5,
        min_continuous_break_hours: 0.50,
        min_break_hours: 0.25,
      };

      console.log(`   HOS segment payload:`, JSON.stringify(hosPayload, null, 2));

      const response = await pegasus.apiPost(
        "hos-segment-setup",
        `/devices/${encodeURIComponent(imei)}/remote/segment_setup`,
        hosPayload,
        apiToken(),
        30000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to set HOS segment configuration: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log(`   HOS segment setup response:`, JSON.stringify(responseData, null, 2));

      console.log(`   ✅ HOS segment configuration set successfully for IMEI: ${imei}`);
      return responseData;
    } catch (error) {
      console.error(`   ❌ Error setting HOS segment configuration: ${error.message}`);
      throw error;
    }
  }

  // Process HOS segment configuration for a device
  async function processHosSegmentConfiguration(imei) {
    try {
      console.log(`   Processing HOS segment configuration for IMEI: ${imei}`);

      // Check if device already has HOS configuration
      const hosCheck = await checkHosSegmentConfiguration(imei);

      if (hosCheck.hasConfiguration) {
        console.log(`   ✅ Device already has HOS segment configuration, skipping setup`);
        return {
          configured: false,
          reason: "Already configured",
          existingConfiguration: hosCheck.deviceData.segments.setup.hos,
        };
      }

      // Set HOS configuration with default values
      console.log(`   Setting up HOS segment configuration with default values...`);
      const setupResult = await setHosSegmentConfiguration(imei);

      console.log(`   ✅ HOS segment configuration completed for IMEI: ${imei}`);
      return {
        configured: true,
        reason: "Configuration set with default values",
        setupResult: setupResult,
      };
    } catch (error) {
      console.error(`   ❌ Error processing HOS segment configuration: ${error.message}`);
      throw error;
    }
  }

  return { processHosSegmentConfiguration };
}

module.exports = { createHosHelpers };
