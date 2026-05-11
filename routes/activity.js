/**
 * Activity tracking API + frontend step ping.
 * Mounted at /api
 */
const express = require("express");

function createActivityRouter({ authenticateToken, requireRole }) {
  const router = express.Router();

  router.get("/activity/summary", authenticateToken, (req, res) => {
    try {
      const { getUserActivitySummary } = require("../activity-tracker");
      const summary = getUserActivitySummary(req.user.id);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("Error getting activity summary:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving activity summary",
        error: error.message,
      });
    }
  });

  router.get("/activity/incomplete", authenticateToken, (req, res) => {
    try {
      const { getUserIncompleteSessions } = require("../activity-tracker");
      const incompleteSessions = getUserIncompleteSessions(req.user.id);

      res.json({
        success: true,
        data: incompleteSessions,
      });
    } catch (error) {
      console.error("Error getting incomplete sessions:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving incomplete sessions",
        error: error.message,
      });
    }
  });

  router.get(
    "/activity/all",
    authenticateToken,
    requireRole("admin"),
    (req, res) => {
      try {
        const { getAllActivities } = require("../activity-tracker");

        const filters = {
          userId: req.query.userId,
          status: req.query.status,
          dateFrom: req.query.dateFrom,
          dateTo: req.query.dateTo,
        };

        Object.keys(filters).forEach((key) => {
          if (filters[key] === undefined) {
            delete filters[key];
          }
        });

        const activities = getAllActivities(filters);

        res.json({
          success: true,
          data: activities,
          filters: filters,
          count: activities.length,
        });
      } catch (error) {
        console.error("Error getting all activities:", error);
        res.status(500).json({
          success: false,
          message: "Error retrieving activities",
          error: error.message,
        });
      }
    }
  );

  router.get(
    "/activity/stats",
    authenticateToken,
    requireRole("admin"),
    (req, res) => {
      try {
        const { getOverallStats } = require("../activity-tracker");
        const stats = getOverallStats();

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        console.error("Error getting activity stats:", error);
        res.status(500).json({
          success: false,
          message: "Error retrieving activity statistics",
          error: error.message,
        });
      }
    }
  );

  router.get("/activity/session/:sessionId", authenticateToken, (req, res) => {
    try {
      const { getSession } = require("../activity-tracker");
      const session = getSession(req.params.sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }

      if (session.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      console.error("Error getting session details:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving session details",
        error: error.message,
      });
    }
  });

  router.post("/track-step", authenticateToken, (req, res) => {
    try {
      const { sessionId, step, data } = req.body;

      if (!sessionId || !step) {
        return res.status(400).json({
          success: false,
          message: "sessionId and step are required",
        });
      }

      const { trackFrontendStep } = require("../activity-middleware");
      trackFrontendStep(sessionId, step, data);

      res.json({
        success: true,
        message: "Step progress tracked successfully",
      });
    } catch (error) {
      console.error("Error tracking step:", error);
      res.status(500).json({
        success: false,
        message: "Error tracking step progress",
        error: error.message,
      });
    }
  });

  router.get("/activity/current-session", authenticateToken, (req, res) => {
    try {
      const { getCurrentSessionId } = require("../activity-middleware");
      const sessionId = getCurrentSessionId(req.user.id);

      res.json({
        success: true,
        sessionId: sessionId,
      });
    } catch (error) {
      console.error("Error getting current session:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving current session",
        error: error.message,
      });
    }
  });

  return router;
}

module.exports = { createActivityRouter };
