/**
 * Pegasus-backed read / verify endpoints (no full install workflow).
 * Mounted at /api — paths: search-installations, device-status, verify-imei, verify-sim, installation-status/:id
 */
const express = require("express");

function createPegasusReadRouter({ pegasus, currentConfig, authenticateToken }) {
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

      const response = await pegasus.qservicesGet(
        "search-installations",
        "/installations/api/v1/installation",
        30000
      );

      if (!response.ok) {
        const errBody = await response.text();
        console.error(
          "[search-installations] Pegasus error",
          JSON.stringify({
            upstream: pegasus.stripUrlForLog(
              `${pegasus.qBase}/installations/api/v1/installation`
            ),
            status: response.status,
            authConfigured: Boolean(currentConfig.pegasusToken),
          })
        );
        return res.status(response.status).json({
          success: false,
          message: `Pegasus API error: HTTP ${response.status}`,
          details: errBody,
        });
      }

      const installationsArray = await response.json();
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
        currentConfig.pegasusToken,
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
        currentConfig.pegasusToken,
        30000
      );

      if (!deviceResp.ok) {
        if (deviceResp.status === 404) {
          return res.status(404).json({
            success: false,
            message: "Device not found - IMEI does not exist in the system",
          });
        }
        return res.status(deviceResp.status).json({
          success: false,
          message: `Pegasus API error: ${deviceResp.status}`,
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

      let simType = "";
      let pegasus1Url = "";
      let pegasus256Url = "";

      if (iccid.startsWith("8988")) {
        simType = "SuperSIM";
        pegasus1Url = `https://api.pegasusgateway.com/m2m/supersims/v1/Sims?Iccid=${iccid}`;
        pegasus256Url = `https://api.pegasusgateway.com/m2m/supersims/v1/Sims?Iccid=${iccid}`;
      } else if (iccid.startsWith("8901")) {
        simType = "Wireless";
        pegasus1Url = `https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=${iccid}`;
        pegasus256Url = `https://api.pegasusgateway.com/m2m/wireless/v1/Sims?Iccid=${iccid}`;
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Invalid ICCID format. Must start with 8988 (SuperSIM) or 8901 (Wireless)",
          iccid: iccid,
        });
      }

      console.log(
        "[verify-sim]",
        JSON.stringify({
          simType,
          upstream1: pegasus.stripUrlForLog(pegasus1Url),
          upstream256: pegasus.stripUrlForLog(pegasus256Url),
          auth1Configured: Boolean(currentConfig.pegasus1Token),
          auth256Configured: Boolean(currentConfig.pegasus256Token),
        })
      );

      let simFound = false;
      let simData = null;
      let foundIn = null;

      try {
        const pegasus1Resp = await pegasus.apiGetFullUrl(
          "verify-sim-pegasus1",
          pegasus1Url,
          currentConfig.pegasus1Token,
          10000
        );

        if (pegasus1Resp.ok) {
          const pegasus1Data = await pegasus1Resp.json();

          const sims = pegasus1Data.sims || pegasus1Data.data || [];
          if (sims.length > 0) {
            simFound = true;
            simData = sims[0];
            foundIn = "Pegasus1";
            console.log(`${simType} SIM found in Pegasus1`);
          }
        }
      } catch (error) {
        console.error("[verify-sim] Pegasus1 check failed:", error.message);
      }

      if (!simFound) {
        try {
          const pegasus256Resp = await pegasus.apiGetFullUrl(
            "verify-sim-pegasus256",
            pegasus256Url,
            currentConfig.pegasus256Token,
            10000
          );

          if (pegasus256Resp.ok) {
            const pegasus256Data = await pegasus256Resp.json();

            const sims = pegasus256Data.sims || pegasus256Data.data || [];
            if (sims.length > 0) {
              simFound = true;
              simData = sims[0];
              foundIn = "Pegasus256";
              console.log(`${simType} SIM found in Pegasus256`);
            }
          }
        } catch (error) {
          console.error("[verify-sim] Pegasus256 check failed:", error.message);
        }
      }

      if (simFound && simData) {
        res.json({
          success: true,
          message: `${simType} SIM verified successfully in ${foundIn}`,
          simData: {
            iccid: simData.iccid,
            status: simData.status,
            simType: simType,
            fleet_sid: simData.fleet_sid || simData.fleet_id,
            account_sid: simData.account_sid || simData.account_id,
            date_created: simData.date_created,
            date_updated: simData.date_updated,
            foundIn: foundIn,
          },
        });
      } else {
        res.status(404).json({
          success: false,
          message: `${simType} SIM not found in either Pegasus instance`,
          checkedInstances: ["Pegasus1", "Pegasus256"],
          simType: simType,
          iccid: iccid,
        });
      }
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
              currentConfig.pegasusToken,
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
              currentConfig.pegasusToken,
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
