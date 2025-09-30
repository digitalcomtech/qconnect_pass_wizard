// activity-middleware.js - Middleware for integrating activity tracking
const {
  startInstallationSession,
  updateInstallationProgress,
  completeInstallationSession,
  logInstallationError,
  getSession
} = require('./activity-tracker');

// Store active sessions in memory (in production, use Redis or database)
const activeSessions = new Map();

/**
 * Middleware to start tracking installation sessions
 */
function trackInstallationStart(req, res, next) {
  // Only track installation-related endpoints
  if (!req.path.includes('/api/install') && !req.path.includes('/api/secondary-install')) {
    return next();
  }

  // Skip if already tracking this request
  if (req.activityTrackingStarted) {
    return next();
  }

  const user = req.user;
  if (!user) {
    return next();
  }

  try {
    // Extract initial session data from request body
    const sessionData = {
      client_name: req.body.client_name,
      installationId: req.body.installationId,
      vin: req.body.vin,
      imei: req.body.imei,
      sim_number: req.body.sim_number,
      secondary_imei: req.body.secondary_imei,
      secondary_sim_number: req.body.secondary_sim_number
    };

    // Start tracking the session
    const sessionId = startInstallationSession(user, sessionData);
    
    // Store session ID in request for later use
    req.sessionId = sessionId;
    req.activityTrackingStarted = true;
    
    // Store in active sessions map
    activeSessions.set(sessionId, {
      userId: user.id,
      username: user.username,
      startTime: new Date(),
      requestBody: req.body
    });

    console.log(`📊 Started activity tracking for session ${sessionId} (${user.username})`);
    
  } catch (error) {
    console.error('❌ Error starting activity tracking:', error);
    // Don't fail the request if tracking fails
  }

  next();
}

/**
 * Middleware to track installation completion
 */
function trackInstallationComplete(req, res, next) {
  // Only for installation endpoints
  if (!req.path.includes('/api/install') && !req.path.includes('/api/secondary-install')) {
    return next();
  }

  // Store original res.json
  const originalJson = res.json.bind(res);

  // Override res.json to capture response
  res.json = function(data) {
    // Track completion based on response
    if (req.sessionId) {
      try {
        const isSuccess = data.status === 'success' || data.success === true;
        const reason = isSuccess ? 'completed' : 'error';
        
        // Extract final data from response
        const finalData = {
          success: isSuccess,
          message: data.message,
          details: data.details,
          timestamp: new Date().toISOString()
        };

        completeInstallationSession(req.sessionId, reason, finalData);
        
        // Clean up active session
        activeSessions.delete(req.sessionId);
        
        console.log(`📊 Completed activity tracking for session ${req.sessionId} - ${reason}`);
        
      } catch (error) {
        console.error('❌ Error completing activity tracking:', error);
      }
    }

    // Call original res.json
    return originalJson(data);
  };

  next();
}

/**
 * Middleware to track errors
 */
function trackInstallationErrors(err, req, res, next) {
  if (req.sessionId) {
    try {
      const errorStep = req.path.includes('/api/install') ? 'installation' : 'secondary-installation';
      const errorMessage = err.message || 'Unknown error';
      
      logInstallationError(req.sessionId, errorStep, errorMessage, {
        statusCode: res.statusCode,
        path: req.path,
        method: req.method,
        stack: err.stack
      });
      
      // Complete session as error
      completeInstallationSession(req.sessionId, 'error', {
        error: errorMessage,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });
      
      // Clean up active session
      activeSessions.delete(req.sessionId);
      
      console.log(`📊 Tracked error for session ${req.sessionId}: ${errorMessage}`);
      
    } catch (trackingError) {
      console.error('❌ Error tracking installation error:', trackingError);
    }
  }

  next(err);
}

/**
 * Helper function to track step progress from frontend
 */
function trackStepProgress(req, res, next) {
  // This will be called from frontend API endpoints
  if (req.path === '/api/track-step' && req.method === 'POST') {
    const { sessionId, step, data } = req.body;
    
    if (!sessionId || !step) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and step are required'
      });
    }

    try {
      updateInstallationProgress(sessionId, step, data);
      
      res.json({
        success: true,
        message: 'Step progress tracked successfully'
      });
      
    } catch (error) {
      console.error('❌ Error tracking step progress:', error);
      res.status(500).json({
        success: false,
        message: 'Error tracking step progress',
        error: error.message
      });
    }
  } else {
    next();
  }
}

/**
 * Helper function to get current session ID for a user
 */
function getCurrentSessionId(userId) {
  for (const [sessionId, session] of activeSessions) {
    if (session.userId === userId) {
      return sessionId;
    }
  }
  return null;
}

/**
 * Helper function to track frontend step completion
 */
function trackFrontendStep(sessionId, step, data) {
  if (!sessionId) {
    console.warn('⚠️ No session ID provided for step tracking');
    return;
  }

  try {
    updateInstallationProgress(sessionId, step, data);
    console.log(`📊 Tracked frontend step: ${step} for session ${sessionId}`);
  } catch (error) {
    console.error('❌ Error tracking frontend step:', error);
  }
}

/**
 * Middleware to add session ID to response headers
 */
function addSessionIdHeader(req, res, next) {
  if (req.sessionId) {
    res.setHeader('X-Session-ID', req.sessionId);
  }
  next();
}

/**
 * Cleanup old sessions (call this periodically)
 */
function cleanupOldSessions() {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [sessionId, session] of activeSessions) {
    if (now - session.startTime > maxAge) {
      // Complete old sessions as abandoned
      completeInstallationSession(sessionId, 'abandoned', {
        reason: 'Session timeout',
        timestamp: new Date().toISOString()
      });
      
      activeSessions.delete(sessionId);
      console.log(`📊 Cleaned up old session ${sessionId}`);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldSessions, 60 * 60 * 1000);

module.exports = {
  trackInstallationStart,
  trackInstallationComplete,
  trackInstallationErrors,
  trackStepProgress,
  getCurrentSessionId,
  trackFrontendStep,
  addSessionIdHeader,
  cleanupOldSessions
};
