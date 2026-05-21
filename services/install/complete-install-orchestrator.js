/**
 * Step-by-step primary (+ optional secondary) install workflow.
 * Returns HTTP envelope for the route to send; optional beforeSend runs after success, before res (activity tracking).
 */

const { trackFrontendStep } = require("../../activity-middleware");

function createCompleteInstallOrchestrator({
  TEST_MODE,
  checkDuplicateInstallation,
  recordInstallationInRepeats,
  createOrUpdateGroup,
  clearVehiclesWorksheet,
  createVehicle,
  processHosSegmentConfiguration,
  processSimCard,
  processSecondaryDevice,
}) {
  async function runCompleteInstallOrchestration({ body, sessionId }) {
    console.log("\n🚀 STARTING COMPLETE INSTALLATION WORKFLOW");
    console.log("Request body:", JSON.stringify(body, null, 2));

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
    } = body;

    if (!client_name || !imei || !vin || !installationId) {
      return {
        status: 400,
        json: {
          success: false,
          status: "failed",
          code: "VALIDATION_ERROR",
          message: "Missing one of client_name, imei, vin, installationId",
        },
      };
    }

    if (TEST_MODE) {
      console.log("🧪 TEST_MODE is ON: Simulating complete workflow");
      return {
        status: 200,
        json: {
          success: true,
          status: "success",
          message: "Test mode: Complete workflow simulated successfully",
          workflow: "Complete installation workflow would have been executed",
        },
      };
    }

    // 2. Check for duplicate installation (repeats table logic)
    console.log("🔍 Step 2: Checking for duplicate installation...");
    const dupResult = await checkDuplicateInstallation(installationId);
    if (dupResult.outcome === "duplicate") {
      console.log("❌ Duplicate installation detected, stopping workflow");
      return {
        status: 400,
        json: {
          success: false,
          status: "failed",
          code: "DUPLICATE_INSTALLATION",
          message: "Installation ID already exists in system - duplicate detected",
        },
      };
    }
    if (dupResult.outcome === "lookup_failed") {
      console.error("[install] duplicate-check uncertain; aborting install.", dupResult);
      return {
        status: 503,
        json: {
          success: false,
          status: "failed",
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
    console.log("✅ No duplicate found, continuing...");

    // 3. Record installation in repeats table
    console.log("📝 Step 3: Recording installation in repeats table...");
    await recordInstallationInRepeats(installationId, client_name);
    console.log("✅ Installation recorded in repeats table");

    // 4. [DEPRECATED] First Pegasus request - skipping as noted in dossier
    console.log("⏭️  Step 4: Skipping deprecated first Pegasus request");

    // 5. Get or create group in Pegasus (idempotent, non-blocking)
    console.log("🏢 Step 5: Getting or creating group in Pegasus...");
    const groupResult = await createOrUpdateGroup(client_name);
    const groupId = groupResult.groupId;
    console.log(`✅ Group ${groupResult.created ? "created" : "retrieved"} with ID: ${groupId}`);

    // 6. Clear vehicles worksheet rows 2-50 (simulated)
    console.log("🧹 Step 6: Clearing vehicles worksheet...");
    await clearVehiclesWorksheet();
    console.log("✅ Vehicles worksheet cleared");

    // 7. [DEPRECATED] Third Pegasus request - skipping as noted in dossier
    console.log("⏭️  Step 7: Skipping deprecated third Pegasus request");

    // 8. Create vehicle in Pegasus
    console.log("🚗 Step 8: Creating vehicle in Pegasus...");
    const vehicleId = await createVehicle(vin, imei, groupId, license_plate, vehiculo_submarca);
    console.log(`✅ Vehicle created with ID: ${vehicleId}`);

    // 9. Configure HOS segment for primary device
    console.log("⚙️  Step 9: Configuring HOS segment for primary device...");
    const primaryHosResult = await processHosSegmentConfiguration(imei);
    console.log(`✅ Primary device HOS configuration: ${primaryHosResult.reason}`);

    // 10. Handle SIM card if provided
    if (sim_number) {
      console.log("📱 Step 10: Processing SIM card...");
      await processSimCard(sim_number);
      console.log("✅ SIM card processed successfully");
    } else {
      console.log("⏭️  Step 10: No SIM card provided, skipping");
    }

    // 11. Handle secondary device if provided
    let secondaryHosResult = null;
    if (secondary_imei) {
      console.log("🔧 Step 11: Processing secondary device...");

      if (secondary_sim_number) {
        console.log("📱 Step 11a: Processing secondary SIM card...");
        await processSimCard(secondary_sim_number);
        console.log("✅ Secondary SIM card processed successfully");
      } else {
        console.log("⏭️  Step 11a: No secondary SIM provided, skipping");
      }

      await processSecondaryDevice(
        secondary_imei,
        vin,
        client_name,
        license_plate,
        vehiculo_submarca
      );

      console.log("⚙️  Step 11b: Configuring HOS segment for secondary device...");
      secondaryHosResult = await processHosSegmentConfiguration(secondary_imei);
      console.log(`✅ Secondary device HOS configuration: ${secondaryHosResult.reason}`);

      console.log("✅ Secondary device processed successfully");
    } else {
      console.log("⏭️  Step 11: No secondary device provided, skipping");
    }

    console.log("🎉 COMPLETE INSTALLATION WORKFLOW FINISHED SUCCESSFULLY");

    const json = {
      success: true,
      status: "success",
      message: "Complete installation workflow executed successfully",
      details: {
        groupId,
        vehicleId,
        simProcessed: !!sim_number,
        secondaryDeviceProcessed: !!secondary_imei,
        secondarySimProcessed: !!secondary_sim_number,
        hosConfiguration: {
          primary: primaryHosResult,
          secondary: secondaryHosResult,
        },
        steps: {
          qservicesDuplicateCheck: { ok: true, outcome: dupResult.outcome },
          repeatsRecord: { ok: true },
          group: { ok: true, groupId, created: !!groupResult.created },
          vehicle: { ok: true, vehicleId },
          primaryDeviceLink: { ok: true, imei },
          primarySim: sim_number
            ? { ok: true, action: "processed" }
            : { ok: true, action: "skipped", reason: "No primary SIM in request" },
          secondary: secondary_imei
            ? {
                ok: true,
                imei: secondary_imei,
                sim: secondary_sim_number
                  ? { ok: true, action: "processed" }
                  : { ok: true, action: "skipped", reason: "No secondary SIM in request" },
                hos: secondaryHosResult,
              }
            : { ok: true, action: "skipped", reason: "No secondary device in request" },
          qservicesConfirmation: {
            ok: true,
            action: "not_applicable",
            reason: "Office provision path; confirm-installation not invoked",
          },
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
              vehicleId,
              timestamp: new Date().toISOString(),
            });
          }
        : undefined,
    };
  }

  return { runCompleteInstallOrchestration };
}

module.exports = { createCompleteInstallOrchestrator };
