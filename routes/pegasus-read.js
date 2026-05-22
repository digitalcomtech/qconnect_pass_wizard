/**
 * Pegasus-backed read / verify endpoints (no full install workflow).
 * Mounted at /api — paths: search-installations, device-status, verify-imei, verify-sim, installation-status/:id
 */
const express = require("express");
const { lookupSimByIccid } = require("../services/pegasus/sim-lookup");
const { resolveApiAuthenticateToken } = require("../services/pegasus/auth-token");
const { missingQservicesTokenMessage } = require("../services/pegasus/qservices-auth-hint");
const {
  pegasus1TokenExpiredMessage,
  qservicesTokenExpiredMessage,
} = require("../services/pegasus/token-auth-messages");
const {
  readQservicesJson,
  qservicesErrorToHttpStatus,
} = require("../services/pegasus/qservices-response");

function tokenConfigured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createPegasusReadRouter({ pegasus, currentConfig, authenticateToken, environment }) {
  const router = express.Router();

  router.get("/search-installations", authenticateToken, async (req, res) => {
    try {
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Query parameter is required",
        });
      }

      console.log(`🔍 Searching for installations with query: ${query}`);

      if (!tokenConfigured(currentConfig.pegasusToken)) {
        return res.status(503).json({
          success: false,
          code: "qservices_token_missing",
          message: missingQservicesTokenMessage(environment || "qa"),
        });
      }

      const installPath = "/installations/api/v1/installation";
      const upstream = pegasus.stripUrlForLog(pegasus.qservicesRequestUrl(installPath));

      const response = await pegasus.qservicesGet(
        "search-installations",
        installPath,
        30000
      );

      const parsed = await readQservicesJson(response, {
        upstream,
        context: "search-installations",
      });

      if (!parsed.ok) {
        console.error(
          "[search-installations] Pegasus non-JSON or redirect",
          JSON.stringify({
            upstream,
            status: parsed.error.status,
            code: parsed.error.code,
            authConfigured: Boolean(currentConfig.pegasusToken),
          })
        );
        return res.status(qservicesErrorToHttpStatus(parsed.error)).json({
          success: false,
          code: parsed.error.code,
          message: parsed.error.message,
          upstream,
          status: parsed.error.status,
          contentType: parsed.error.contentType,
        });
      }

      if (!response.ok) {
        const errBody =
          typeof parsed.data === "object"
            ? JSON.stringify(parsed.data)
            : String(parsed.data);
        console.error(
          "[search-installations] Pegasus error",
          JSON.stringify({
            upstream,
            status: response.status,
            authConfigured: Boolean(currentConfig.pegasusToken),
          })
        );
        const message =
          response.status === 401
            ? qservicesTokenExpiredMessage()
            : `Pegasus API error: HTTP ${response.status}`;
        return res.status(response.status).json({
          success: false,
          code: response.status === 401 ? "qservices_token_expired" : undefined,
          message,
          upstream,
          details: errBody,
        });
      }

      const installationsArray = Array.isArray(parsed.data) ? parsed.data : [];
      console.log(`✅ Found ${installationsArray.length} total installations`);

      const normalize = (str) =>
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";
      const inputNorm = normalize(query);

      const filtered = installationsArray.filter((inst) => {
        const nombre = inst.persona?.nombreAsegurado || "";
        const apellido = inst.persona?.apellidoPaterno || "";
        const fullName = [nombre, apellido].filter(Boolean).join(" ");
        const vin = inst.vehiculo?.serie || "";
        return (
          normalize(fullName).includes(inputNorm) ||
          vin.toUpperCase().startsWith(inputNorm)
        );
      });

      console.log(`🔍 Filtered to ${filtered.length} matching installations`);

      res.json({
        success: true,
        installations: filtered,
        totalFetched: installationsArray.length,
        matchedCount: filtered.length,
        totalFound: filtered.length,
        query: query,
      });
    } catch (err) {
      console.error("❌ Error searching installations:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error while searching installations",
        error: err.message,
      });
    }
  });

  router.get("/device-status", authenticateToken, async (req, res) => {
    const { imei, since } = req.query;
    const requestTime = new Date().toISOString();

    if (!imei || typeof imei !== "string") {
      return res.status(400).json({
        success: false,
        error: "imei query parameter is required",
        requestTime,
      });
    }

    try {
      const devicePath = `/devices/${encodeURIComponent(imei)}`;
      const upstreamLog = pegasus.stripUrlForLog(`${pegasus.apiBase}${devicePath}`);
      const startTime = Date.now();
      const deviceResp = await pegasus.apiGet(
        "device-status",
        devicePath,
        resolveApiAuthenticateToken(currentConfig),
        30000
      );
      const responseTime = Date.now() - startTime;

      if (!deviceResp.ok) {
        return res.status(deviceResp.status).json({
          success: false,
          error: `Pegasus API returned ${deviceResp.status}`,
          message: deviceResp.statusText,
          upstream: upstreamLog,
          authConfigured: Boolean(currentConfig.pegasusToken),
        });
      }

      const deviceData = await deviceResp.json();

      const currentEpoch = Math.floor(Date.now() / 1000);
      const locationAge = deviceData.latest?.loc?.age || 0;
      const connectionAge = deviceData.connection?._epoch
        ? currentEpoch - deviceData.connection._epoch
        : null;
      const lastRxAge = deviceData.lastrx?._epoch
        ? currentEpoch - deviceData.lastrx._epoch
        : null;

      const hasLocationData =
        deviceData.latest?.loc?.lat != null && deviceData.latest?.loc?.lon != null;
      const isReporting = hasLocationData && locationAge <= 60;
      const isOnline = deviceData.connection?.online === true;

      const hasRecentConnection = locationAge <= 300;
      const hasRecentActivity = lastRxAge !== null && lastRxAge <= 300;

      console.log(
        "[device-status]",
        JSON.stringify({
          requestTime,
          imei,
          since: since || null,
          upstream: upstreamLog,
          ms: responseTime,
          httpStatus: deviceResp.status,
          isReporting,
          isOnline,
          hasRecentConnection,
          hasRecentActivity,
          locationAge,
          authConfigured: Boolean(currentConfig.pegasusToken),
        })
      );

      const response = {
        isReporting,
        latest: deviceData.latest,
        connection: deviceData.connection,
        deviceData: deviceData,
        isOnline,
        connectionState: deviceData.connection?.last?.state || "unknown",
        hasRecentConnection,
        hasRecentActivity,
        requestTime,
        dataFreshness: {
          locationAge,
          connectionAge,
          lastRxAge,
        },
      };

      res.json(response);
    } catch (error) {
      console.error(`\n❌ [${requestTime}] DEVICE STATUS CHECK ERROR:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        requestTime,
      });
    }
  });

  router.post("/verify-imei", authenticateToken, async (req, res) => {
    try {
      const { imei } = req.body;

      if (!imei) {
        return res.status(400).json({
          success: false,
          message: "IMEI is required",
        });
      }

      console.log("Verifying IMEI:", imei);

      const deviceResp = await pegasus.apiGet(
        "verify-imei",
        `/devices/${encodeURIComponent(imei)}`,
        resolveApiAuthenticateToken(currentConfig),
        30000
      );

      if (!deviceResp.ok) {
        if (deviceResp.status === 404) {
          return res.status(404).json({
            success: false,
            message: "Device not found - IMEI does not exist in the system",
          });
        }
        const imeiMessage =
          deviceResp.status === 401
            ? pegasus1TokenExpiredMessage()
            : `Pegasus API error: ${deviceResp.status}`;
        return res.status(deviceResp.status).json({
          success: false,
          code: deviceResp.status === 401 ? "pegasus1_token_expired" : undefined,
          message: imeiMessage,
        });
      }

      const deviceData = await deviceResp.json();
      console.log(
        "[verify-imei]",
        JSON.stringify({
          imei,
          upstream: pegasus.stripUrlForLog(
            `${pegasus.apiBase}/devices/${encodeURIComponent(imei)}`
          ),
          httpStatus: deviceResp.status,
          hasDevice: Boolean(deviceData.imei),
          authConfigured: Boolean(currentConfig.pegasusToken),
        })
      );

      if (!deviceData.imei) {
        return res.status(400).json({
          success: false,
          message: "Invalid device data received from Pegasus",
        });
      }

      const hasVehicle =
        deviceData.vehicle && Object.keys(deviceData.vehicle).length > 0;
      const vehicleHasDetails =
        hasVehicle && deviceData.vehicle.name && deviceData.vehicle.id;

      const isAcceptable = !hasVehicle || (hasVehicle && !vehicleHasDetails);

      if (!isAcceptable) {
        return res.status(400).json({
          success: false,
          message:
            "Device is already linked to a vehicle and cannot be used for installation",
          deviceState: "linked",
          vehicleName: deviceData.vehicle?.name,
          vehicleId: deviceData.vehicle?.id,
        });
      }

      res.json({
        success: true,
        message: "IMEI verified successfully",
        deviceState: hasVehicle ? "unlinked" : "never_linked",
        deviceData: deviceData,
      });
    } catch (err) {
      console.error("Error in /api/verify-imei:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error while verifying IMEI",
      });
    }
  });

  router.post("/verify-sim", authenticateToken, async (req, res) => {
    try {
      const { iccid } = req.body;

      if (!iccid) {
        return res.status(400).json({
          success: false,
          message: "ICCID is required",
        });
      }

      console.log("Verifying SIM ICCID:", iccid);

      const result = await lookupSimByIccid(pegasus, currentConfig, iccid);
      console.log(
        "[verify-sim]",
        JSON.stringify({
          iccid,
          success: result.success,
          foundIn: result.simData && result.simData.foundIn,
          checkedInstances: result.checkedInstances,
          auth1Configured: Boolean(currentConfig.pegasus1Token),
          auth256Configured: Boolean(currentConfig.pegasus256Token),
        })
      );

      if (result.success) {
        return res.json({
          success: true,
          message: result.message,
          simData: result.simData,
        });
      }

      return res.status(result.status).json({
        success: false,
        code: result.code,
        message: result.message,
        simType: result.simType,
        iccid: result.iccid,
        checkedInstances: result.checkedInstances,
      });
    } catch (err) {
      console.error("Error in /api/verify-sim:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error while verifying SIM",
      });
    }
  });

  router.get(
    "/installation-status/:installationId",
    authenticateToken,
    async (req, res) => {
      try {
        const { installationId } = req.params;

        if (!installationId) {
          return res.status(400).json({
            success: false,
            message: "Installation ID is required",
          });
        }

        console.log(
          "[installation-status]",
          JSON.stringify({
            installationId,
            upstream: pegasus.stripUrlForLog(
              `${pegasus.qBase}/installations/api/v1/installation/${encodeURIComponent(installationId)}`
            ),
            authConfigured: Boolean(currentConfig.pegasusToken),
          })
        );

        const response = await pegasus.qservicesGet(
          "installation-status",
          `/installations/api/v1/installation/${encodeURIComponent(installationId)}`,
          30000
        );

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({
            success: false,
            message: `Failed to fetch installation status: ${response.status}`,
            details: pegasus.truncate(errText, 500),
          });
        }

        const installationData = await response.json();

        let vehicleStatus = "unknown";
        if (installationData.vehiculo?.serie) {
          try {
            const vehicleResponse = await pegasus.apiGet(
              "installation-status-vehicle",
              `/vehicles?vin=${encodeURIComponent(installationData.vehiculo.serie)}`,
              resolveApiAuthenticateToken(currentConfig),
              30000
            );

            if (vehicleResponse.ok) {
              const vehicleData = await vehicleResponse.json();
              vehicleStatus =
                vehicleData.vehicles && vehicleData.vehicles.length > 0
                  ? "created"
                  : "not_found";
            }
          } catch (error) {
            console.error(
              "[installation-status] vehicle lookup failed:",
              error.message
            );
          }
        }

        let groupStatus = "unknown";
        if (installationData.persona?.nombreAsegurado) {
          try {
            const groupResponse = await pegasus.apiGet(
              "installation-status-group",
              `/groups?name=${encodeURIComponent(installationData.persona.nombreAsegurado)}`,
              resolveApiAuthenticateToken(currentConfig),
              30000
            );

            if (groupResponse.ok) {
              const groupData = await groupResponse.json();
              groupStatus =
                groupData.groups && groupData.groups.length > 0
                  ? "created"
                  : "not_found";
            }
          } catch (error) {
            console.error(
              "[installation-status] group lookup failed:",
              error.message
            );
          }
        }

        res.json({
          success: true,
          installationId,
          status: {
            installation: installationData.status || "unknown",
            vehicle: vehicleStatus,
            group: groupStatus,
            lastUpdated:
              installationData.updatedAt || installationData.createdAt,
            timestamp: new Date().toISOString(),
          },
          details: installationData,
        });
      } catch (error) {
        console.error("Error checking installation status:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error while checking installation status",
          error: error.message,
        });
      }
    }
  );

  return router;
}

module.exports = { createPegasusReadRouter };
