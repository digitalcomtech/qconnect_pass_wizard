// activity-tracker.js - User activity tracking system
const fs = require('fs').promises;
const path = require('path');

// In-memory storage for activities (in production, use a database)
let activities = [];
let activityStats = {};

// Activity data file path
const ACTIVITY_FILE = path.join(__dirname, 'data', 'activities.json');
const STATS_FILE = path.join(__dirname, 'data', 'activity-stats.json');

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load activities from file
async function loadActivities() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(ACTIVITY_FILE, 'utf8');
    activities = JSON.parse(data);
    console.log(`✅ Loaded ${activities.length} activities from file`);
  } catch (error) {
    console.log('📝 No existing activities file found, starting fresh');
    activities = [];
  }
}

// Save activities to file
async function saveActivities() {
  try {
    await ensureDataDirectory();
    await fs.writeFile(ACTIVITY_FILE, JSON.stringify(activities, null, 2));
  } catch (error) {
    console.error('❌ Error saving activities:', error);
  }
}

// Load activity stats from file
async function loadActivityStats() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(STATS_FILE, 'utf8');
    activityStats = JSON.parse(data);
    console.log(`✅ Loaded activity stats for ${Object.keys(activityStats).length} users`);
  } catch (error) {
    console.log('📊 No existing activity stats file found, starting fresh');
    activityStats = {};
  }
}

// Save activity stats to file
async function saveActivityStats() {
  try {
    await ensureDataDirectory();
    await fs.writeFile(STATS_FILE, JSON.stringify(activityStats, null, 2));
  } catch (error) {
    console.error('❌ Error saving activity stats:', error);
  }
}

// Activity tracking functions

/**
 * Start tracking a new installation session
 * @param {Object} user - User object with id, username, role, name
 * @param {Object} sessionData - Initial session data (client_name, installationId, etc.)
 * @returns {string} sessionId - Unique session identifier
 */
function startInstallationSession(user, sessionData) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const activity = {
    sessionId,
    userId: user.id,
    username: user.username,
    userRole: user.role,
    userName: user.name,
    status: 'in_progress',
    progress: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
    steps: {
      clientSelection: { completed: false, timestamp: null, data: null },
      vinSelection: { completed: false, timestamp: null, data: null },
      deviceSetup: { completed: false, timestamp: null, data: null },
      locationCheck: { completed: false, timestamp: null, data: null },
      formCompletion: { completed: false, timestamp: null, data: null },
      finalConfirmation: { completed: false, timestamp: null, data: null }
    },
    inputData: {
      client_name: sessionData.client_name || null,
      installationId: sessionData.installationId || null,
      vin: null,
      imei: null,
      sim_number: null,
      secondary_imei: null,
      secondary_sim_number: null,
      location: null,
      formData: null
    },
    errors: [],
    completionReason: null,
    lastActivity: new Date().toISOString()
  };

  activities.push(activity);
  saveActivities();
  
  console.log(`📊 Started tracking session ${sessionId} for user ${user.username}`);
  return sessionId;
}

/**
 * Update installation progress
 * @param {string} sessionId - Session identifier
 * @param {string} step - Step name (clientSelection, vinSelection, etc.)
 * @param {Object} data - Step data
 */
function updateInstallationProgress(sessionId, step, data = {}) {
  const activity = activities.find(a => a.sessionId === sessionId);
  if (!activity) {
    console.error(`❌ Session ${sessionId} not found`);
    return;
  }

  // Update step completion
  if (activity.steps[step]) {
    activity.steps[step] = {
      completed: true,
      timestamp: new Date().toISOString(),
      data: data
    };
  }

  // Update input data based on step
  if (step === 'clientSelection' && data.client_name) {
    activity.inputData.client_name = data.client_name;
    activity.inputData.installationId = data.installationId;
  } else if (step === 'vinSelection' && data.vin) {
    activity.inputData.vin = data.vin;
  } else if (step === 'deviceSetup') {
    if (data.imei) activity.inputData.imei = data.imei;
    if (data.sim_number) activity.inputData.sim_number = data.sim_number;
    if (data.secondary_imei) activity.inputData.secondary_imei = data.secondary_imei;
    if (data.secondary_sim_number) activity.inputData.secondary_sim_number = data.secondary_sim_number;
  } else if (step === 'locationCheck' && data.location) {
    activity.inputData.location = data.location;
  } else if (step === 'formCompletion' && data.formData) {
    activity.inputData.formData = data.formData;
  }

  // Calculate progress percentage
  const completedSteps = Object.values(activity.steps).filter(step => step.completed).length;
  activity.progress = Math.round((completedSteps / Object.keys(activity.steps).length) * 100);
  
  activity.lastActivity = new Date().toISOString();
  
  saveActivities();
  console.log(`📊 Updated session ${sessionId} - ${step} completed (${activity.progress}% progress)`);
}

/**
 * Complete an installation session
 * @param {string} sessionId - Session identifier
 * @param {string} reason - Completion reason ('completed', 'cancelled', 'error')
 * @param {Object} finalData - Final session data
 */
function completeInstallationSession(sessionId, reason = 'completed', finalData = {}) {
  const activity = activities.find(a => a.sessionId === sessionId);
  if (!activity) {
    console.error(`❌ Session ${sessionId} not found`);
    return;
  }

  activity.status = reason === 'completed' ? 'completed' : 'incomplete';
  activity.endTime = new Date().toISOString();
  activity.completionReason = reason;
  
  // Calculate duration
  const startTime = new Date(activity.startTime);
  const endTime = new Date(activity.endTime);
  activity.duration = Math.round((endTime - startTime) / 1000); // Duration in seconds

  // Merge final data
  if (finalData) {
    Object.assign(activity.inputData, finalData);
  }

  // Update stats
  updateUserStats(activity.userId, activity);
  
  saveActivities();
  saveActivityStats();
  
  console.log(`📊 Completed session ${sessionId} - ${reason} (${activity.progress}% progress, ${activity.duration}s duration)`);
}

/**
 * Log an error during installation
 * @param {string} sessionId - Session identifier
 * @param {string} step - Step where error occurred
 * @param {string} error - Error message
 * @param {Object} context - Additional error context
 */
function logInstallationError(sessionId, step, error, context = {}) {
  const activity = activities.find(a => a.sessionId === sessionId);
  if (!activity) {
    console.error(`❌ Session ${sessionId} not found`);
    return;
  }

  const errorEntry = {
    timestamp: new Date().toISOString(),
    step: step,
    error: error,
    context: context
  };

  activity.errors.push(errorEntry);
  activity.lastActivity = new Date().toISOString();
  
  saveActivities();
  console.log(`📊 Logged error for session ${sessionId} at step ${step}: ${error}`);
}

/**
 * Update user statistics
 * @param {number} userId - User ID
 * @param {Object} activity - Completed activity
 */
function updateUserStats(userId, activity) {
  if (!activityStats[userId]) {
    activityStats[userId] = {
      userId: userId,
      totalSessions: 0,
      completedSessions: 0,
      incompleteSessions: 0,
      totalDuration: 0,
      averageDuration: 0,
      successRate: 0,
      lastActivity: null,
      stepCompletionRates: {
        clientSelection: 0,
        vinSelection: 0,
        deviceSetup: 0,
        locationCheck: 0,
        formCompletion: 0,
        finalConfirmation: 0
      },
      commonErrors: {},
      averageProgress: 0,
      totalProgress: 0
    };
  }

  const stats = activityStats[userId];
  
  // Update basic stats
  stats.totalSessions++;
  if (activity.status === 'completed') {
    stats.completedSessions++;
  } else {
    stats.incompleteSessions++;
  }
  
  stats.totalDuration += activity.duration || 0;
  stats.averageDuration = Math.round(stats.totalDuration / stats.totalSessions);
  stats.successRate = Math.round((stats.completedSessions / stats.totalSessions) * 100);
  stats.lastActivity = activity.lastActivity;
  
  // Update step completion rates
  Object.keys(activity.steps).forEach(step => {
    if (activity.steps[step].completed) {
      stats.stepCompletionRates[step]++;
    }
  });
  
  // Update progress stats
  stats.totalProgress += activity.progress;
  stats.averageProgress = Math.round(stats.totalProgress / stats.totalSessions);
  
  // Update error tracking
  activity.errors.forEach(error => {
    const errorKey = `${error.step}:${error.error}`;
    stats.commonErrors[errorKey] = (stats.commonErrors[errorKey] || 0) + 1;
  });
}

/**
 * Get user activity summary
 * @param {number} userId - User ID
 * @returns {Object} User activity summary
 */
function getUserActivitySummary(userId) {
  const userActivities = activities.filter(a => a.userId === userId);
  const stats = activityStats[userId] || {};
  
  return {
    userId: userId,
    totalSessions: userActivities.length,
    stats: stats,
    recentSessions: userActivities
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 10),
    incompleteSessions: userActivities.filter(a => a.status === 'in_progress')
  };
}

/**
 * Get all activities with optional filtering
 * @param {Object} filters - Filter options
 * @returns {Array} Filtered activities
 */
function getAllActivities(filters = {}) {
  let filteredActivities = [...activities];
  
  if (filters.userId) {
    filteredActivities = filteredActivities.filter(a => a.userId === filters.userId);
  }
  
  if (filters.status) {
    filteredActivities = filteredActivities.filter(a => a.status === filters.status);
  }
  
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filteredActivities = filteredActivities.filter(a => new Date(a.startTime) >= fromDate);
  }
  
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    filteredActivities = filteredActivities.filter(a => new Date(a.startTime) <= toDate);
  }
  
  return filteredActivities.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

/**
 * Get activity statistics for all users
 * @returns {Object} Overall activity statistics
 */
function getOverallStats() {
  const totalSessions = activities.length;
  const completedSessions = activities.filter(a => a.status === 'completed').length;
  const incompleteSessions = activities.filter(a => a.status === 'incomplete').length;
  const inProgressSessions = activities.filter(a => a.status === 'in_progress').length;
  
  const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const averageDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
  
  const successRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  
  // Step completion rates across all sessions
  const stepCompletionRates = {};
  Object.keys(activities[0]?.steps || {}).forEach(step => {
    const completed = activities.filter(a => a.steps[step]?.completed).length;
    stepCompletionRates[step] = totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0;
  });
  
  // Most common errors
  const allErrors = activities.flatMap(a => a.errors);
  const errorCounts = {};
  allErrors.forEach(error => {
    const errorKey = `${error.step}:${error.error}`;
    errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
  });
  
  const mostCommonErrors = Object.entries(errorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([error, count]) => ({ error, count }));
  
  return {
    totalSessions,
    completedSessions,
    incompleteSessions,
    inProgressSessions,
    successRate,
    averageDuration,
    stepCompletionRates,
    mostCommonErrors,
    userStats: activityStats
  };
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Session data
 */
function getSession(sessionId) {
  return activities.find(a => a.sessionId === sessionId) || null;
}

/**
 * Get user's incomplete sessions (where they left off)
 * @param {number} userId - User ID
 * @returns {Array} Incomplete sessions
 */
function getUserIncompleteSessions(userId) {
  return activities.filter(a => a.userId === userId && a.status === 'incomplete');
}

// Initialize the activity tracker
async function initializeActivityTracker() {
  await loadActivities();
  await loadActivityStats();
  console.log('📊 Activity tracker initialized');
}

// Export functions
module.exports = {
  initializeActivityTracker,
  startInstallationSession,
  updateInstallationProgress,
  completeInstallationSession,
  logInstallationError,
  getUserActivitySummary,
  getAllActivities,
  getOverallStats,
  getSession,
  getUserIncompleteSessions,
  // Utility functions
  loadActivities,
  saveActivities,
  loadActivityStats,
  saveActivityStats
};
