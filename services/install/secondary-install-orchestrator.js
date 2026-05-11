/**
 * Secondary-only install workflow (duplicate check → group → SIM → vehicle → HOS).
 */

const { trackFrontendStep } = require("../../activity-middleware");

function createSecondaryInstallOrchestrator({
  TEST_MODE,
  checkDuplicateInstallation,
  recordInstallationInRepeats,
  createOrUpdateGroup,
  processSimCard,
  processSecondaryDevice,
  processHosSegmentConfiguration,
}) {
  async function runSecondaryInstallOrchestration({ body, sessionId }) {
    console.log("\n🔧 STARTING SECONDARY DEVICE INSTALLATION WORKFLOW");
    console.log("Request body:", JSON.stringify(body, null, 2));

    const {
      client_name,
      secondary_imei,
      secondary_sim_number,
      vin,
      installationId,
      license_plate,
    } = body;

    if (!client_name || !secondary_imei || !vin || !installationId) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Missing one of client_name, secondary_imei, vin, installationId",
        },
      };
    }

    if (TEST_MODE) {
      console.log("🧪 TEST_MODE is ON: Simulating secondary device workflow");
      return {
        status: 200,
        json: {
          status: "success",
          message: "Test mode: Secondary device workflow simulated successfully",
          workflow: "Secondary device installation workflow would have been executed",
        },
      };
    }

    console.log("🔍 Checking for duplicate installation...");
    const dupResult = await checkDuplicateInstallation(installationId);
    if (dupResult.outcome === "duplicate") {
      console.log("❌ Duplicate installation detected, stopping workflow");
      return {
        status: 400,
        json: {
          success: false,
          message: "Installation ID already exists in system - duplicate detected",
        },
      };
    }
    if (dupResult.outcome === "lookup_failed") {
      console.error("[secondary-install] duplicate-check uncertain; aborting.", dupResult);
      return {
        status: 503,
        json: {
          success: false,
          code: "DUPLICATE_CHECK_UNAVAILABLE",
          message:
            "Could not verify installation state with Pegasus. Install was stopped to avoid duplicate or conflicting work.",
          duplicateCheck: {
            outcome: dupResult.outcome,
            httpStatus: dupResult.httpStatus,
            reason: dupResult.reason || null,
          },
        },
      };
    }

    console.log("📝 Recording installation in repeats table...");
    await recordInstallationInRepeats(installationId, client_name);

    console.log("🏢 Creating/updating group in Pegasus...");
    const groupResult = await createOrUpdateGroup(client_name);
    const groupId = groupResult.groupId;

    if (secondary_sim_number) {
      console.log("📱 Processing secondary SIM card...");
      await processSimCard(secondary_sim_number);
      console.log("✅ Secondary SIM card processed successfully");
    } else {
      console.log("⏭️  No secondary SIM provided, skipping");
    }

    console.log("🔧 Creating secondary vehicle in Pegasus...");
    const secondaryVehicleId = await processSecondaryDevice(
      secondary_imei,
      vin,
      client_name,
      license_plate
    );

    console.log("⚙️  Configuring HOS segment for secondary device...");
    const secondaryHosResult = await processHosSegmentConfiguration(secondary_imei);
    console.log(`✅ Secondary device HOS configuration: ${secondaryHosResult.reason}`);

    console.log("🎉 SECONDARY DEVICE INSTALLATION WORKFLOW FINISHED SUCCESSFULLY");

    const json = {
      status: "success",
      message: "Secondary device installation workflow executed successfully",
      details: {
        groupId,
        secondaryVehicleId,
        secondarySimProcessed: !!secondary_sim_number,
        hosConfiguration: {
          secondary: secondaryHosResult,
        },
        timestamp: new Date().toISOString(),
      },
    };

    return {
      status: 200,
      json,
      beforeSend: sessionId
        ? () => {
            trackFrontendStep(sessionId, "finalConfirmation", {
              success: true,
              groupId,
              secondaryVehicleId,
              timestamp: new Date().toISOString(),
            });
          }
        : undefined,
    };
  }

  return { runSecondaryInstallOrchestration };
}

module.exports = { createSecondaryInstallOrchestrator };
