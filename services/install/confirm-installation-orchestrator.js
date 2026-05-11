/**
 * Pegasus installation confirmation (retry, optional dangerous fallback, JSON parse).
 * Returns { status, json } for all handled outcomes; throws when Pegasus unreachable and fallback is off.
 */

function createConfirmInstallationOrchestrator({
  pegasus,
  currentConfig,
  TEST_MODE,
  allowDangerousPegasusConfirmationFallback,
}) {
  async function runConfirmInstallationOrchestration({ installationId }) {
    if (!installationId) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Installation ID is required",
        },
      };
    }

    if (TEST_MODE) {
      console.log("TEST_MODE is ON: Skipping Pegasus confirmation call.");
      return {
        status: 200,
        json: {
          status: "success",
          message: "Test mode: Pegasus confirmation not called.",
        },
      };
    }

    const confirmPath = `/installations/api/v1/review/${encodeURIComponent(installationId)}/confirmation?finish=true`;
    console.log(
      "[confirm-installation]",
      JSON.stringify({
        installationId,
        upstream: pegasus.stripUrlForLog(`${pegasus.qBase}${confirmPath.split("?")[0]}?…`),
        authConfigured: Boolean(currentConfig.pegasusToken),
      })
    );

    const confirmationPayload = [
      "valid_position",
      "io_pwr",
      "io_ign",
      "io_in1",
      "io_out1",
    ];

    console.log("Confirmation payload:", confirmationPayload);
    console.log(
      "Pegasus bearer token:",
      currentConfig.pegasusToken ? "configured (value not logged)" : "MISSING"
    );

    let pegasusResp = null;
    let lastError = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to confirm installation...`);

        pegasusResp = await pegasus.qservicesPost(
          "confirm-installation",
          confirmPath,
          confirmationPayload,
          30000
        );

        console.log(
          "[confirm-installation] attempt",
          JSON.stringify({ attempt, maxRetries, httpStatus: pegasusResp.status })
        );

        if (pegasusResp.ok) {
          break;
        }

        if (pegasusResp.status >= 400 && pegasusResp.status < 500) {
          break;
        }

        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt} failed with status ${pegasusResp.status}, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      } catch (fetchError) {
        lastError = fetchError;
        console.error(`Attempt ${attempt} failed:`, fetchError.message);

        if (attempt < maxRetries) {
          console.log(`Retrying in ${2 * attempt} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    if (!pegasusResp) {
      if (allowDangerousPegasusConfirmationFallback) {
        console.error(
          "[confirm-installation] DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK is enabled: returning HTTP 200 success without Pegasus confirmation.",
          { installationId, attempts: maxRetries, lastError: lastError && lastError.message }
        );
        return {
          status: 200,
          json: {
            success: true,
            dangerousUnconfirmedPegasusSuccess: true,
            fallbackMode: true,
            message:
              "UNSAFE: Pegasus confirmation was NOT completed (API unreachable). Operator enabled DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK. Treat as NOT confirmed upstream.",
            pegasusResponse: {
              fallback: true,
              dangerous: true,
              message:
                "Pegasus confirmation endpoint was never reached successfully; this is not a real upstream confirmation.",
              timestamp: new Date().toISOString(),
            },
            attempts: maxRetries,
          },
        };
      }
      throw lastError || new Error("All retry attempts failed");
    }

    if (!pegasusResp.ok) {
      const text = await pegasusResp.text();
      console.error("Pegasus confirmation failed after retries:", pegasusResp.status, text);
      return {
        status: pegasusResp.status,
        json: {
          success: false,
          message: `Pegasus confirmation failed: ${pegasusResp.status} - ${text}`,
          attempts: maxRetries,
        },
      };
    }

    const responseText = await pegasusResp.text();
    let pegasusJson = null;

    if (responseText && responseText.trim()) {
      try {
        pegasusJson = JSON.parse(responseText);
        console.log("Pegasus confirmation successful:", pegasusJson);
      } catch (parseError) {
        console.warn("Pegasus returned non-JSON response, treating as success:", responseText);
        pegasusJson = { rawResponse: responseText };
      }
    } else {
      console.log("Pegasus confirmation successful (empty response)");
      pegasusJson = { message: "Empty response from server" };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Installation confirmed successfully",
        pegasusResponse: pegasusJson,
        attempts: 1,
      },
    };
  }

  return { runConfirmInstallationOrchestration };
}

module.exports = { createConfirmInstallationOrchestrator };
