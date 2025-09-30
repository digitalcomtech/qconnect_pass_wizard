// activity-tracker.js - Frontend activity tracking
class ActivityTracker {
  constructor() {
    this.currentSessionId = null;
    this.isTrackingEnabled = true;
    this.apiBaseUrl = '/api';
    
    // Initialize tracking when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  async initialize() {
    console.log('📊 Initializing frontend activity tracker...');
    
    // Get current session ID from server
    await this.getCurrentSession();
    
    // Set up automatic tracking for form interactions
    this.setupFormTracking();
    
    // Set up step tracking for the installation wizard
    this.setupStepTracking();
    
    console.log('📊 Frontend activity tracker initialized');
  }

  async getCurrentSession() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${this.apiBaseUrl}/activity/current-session`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.currentSessionId = data.sessionId;
        console.log('📊 Current session ID:', this.currentSessionId);
      }
    } catch (error) {
      console.error('❌ Error getting current session:', error);
    }
  }

  setupFormTracking() {
    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form.tagName === 'FORM') {
        this.trackFormSubmission(form);
      }
    });

    // Track input changes for important fields
    const importantInputs = ['input[name="client_name"]', 'input[name="vin"]', 'input[name="imei"]', 'input[name="sim_number"]'];
    
    importantInputs.forEach(selector => {
      document.addEventListener('input', (event) => {
        if (event.target.matches(selector)) {
          this.trackInputChange(event.target);
        }
      });
    });
  }

  setupStepTracking() {
    // Track step transitions in the installation wizard
    const stepButtons = document.querySelectorAll('[data-step]');
    stepButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        const step = event.target.getAttribute('data-step');
        if (step) {
          this.trackStep(step, { action: 'click', timestamp: new Date().toISOString() });
        }
      });
    });

    // Track progress updates
    this.observeProgressUpdates();
  }

  observeProgressUpdates() {
    // Watch for changes in the status bar or progress indicators
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          
          // Check if this is a status update
          if (target.classList && target.classList.contains('status-bar')) {
            this.trackStatusUpdate(target.textContent);
          }
          
          // Check if this is a progress update
          if (target.classList && target.classList.contains('progress-indicator')) {
            this.trackProgressUpdate(target.textContent);
          }
        }
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  async trackStep(step, data = {}) {
    if (!this.isTrackingEnabled || !this.currentSessionId) return;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const payload = {
        sessionId: this.currentSessionId,
        step: step,
        data: {
          ...data,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      };

      await fetch(`${this.apiBaseUrl}/track-step`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`📊 Tracked step: ${step}`, data);
    } catch (error) {
      console.error('❌ Error tracking step:', error);
    }
  }

  trackFormSubmission(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    this.trackStep('formSubmission', {
      formId: form.id || 'unknown',
      formAction: form.action || 'unknown',
      formData: data,
      timestamp: new Date().toISOString()
    });
  }

  trackInputChange(input) {
    this.trackStep('inputChange', {
      fieldName: input.name || input.id || 'unknown',
      fieldValue: input.value,
      fieldType: input.type,
      timestamp: new Date().toISOString()
    });
  }

  trackStatusUpdate(status) {
    this.trackStep('statusUpdate', {
      status: status,
      timestamp: new Date().toISOString()
    });
  }

  trackProgressUpdate(progress) {
    this.trackStep('progressUpdate', {
      progress: progress,
      timestamp: new Date().toISOString()
    });
  }

  // Specific tracking methods for installation steps
  trackClientSelection(clientName, installationId) {
    this.trackStep('clientSelection', {
      client_name: clientName,
      installationId: installationId,
      timestamp: new Date().toISOString()
    });
  }

  trackVinSelection(vin, clientName) {
    this.trackStep('vinSelection', {
      vin: vin,
      client_name: clientName,
      timestamp: new Date().toISOString()
    });
  }

  trackDeviceSetup(imei, simNumber = null, secondaryImei = null, secondarySimNumber = null) {
    this.trackStep('deviceSetup', {
      imei: imei,
      sim_number: simNumber,
      secondary_imei: secondaryImei,
      secondary_sim_number: secondarySimNumber,
      timestamp: new Date().toISOString()
    });
  }

  trackLocationCheck(location, proximity = null) {
    this.trackStep('locationCheck', {
      location: location,
      proximity: proximity,
      timestamp: new Date().toISOString()
    });
  }

  trackFormCompletion(formData) {
    this.trackStep('formCompletion', {
      formData: formData,
      timestamp: new Date().toISOString()
    });
  }

  trackInstallationStart(installationData) {
    this.trackStep('installationStart', {
      installationData: installationData,
      timestamp: new Date().toISOString()
    });
  }

  trackInstallationComplete(success, result) {
    this.trackStep('finalConfirmation', {
      success: success,
      result: result,
      timestamp: new Date().toISOString()
    });
  }

  trackError(step, error, context = {}) {
    this.trackStep('error', {
      step: step,
      error: error.message || error,
      context: context,
      timestamp: new Date().toISOString()
    });
  }

  // Utility methods
  setSessionId(sessionId) {
    this.currentSessionId = sessionId;
    console.log('📊 Session ID set:', sessionId);
  }

  enableTracking() {
    this.isTrackingEnabled = true;
    console.log('📊 Activity tracking enabled');
  }

  disableTracking() {
    this.isTrackingEnabled = false;
    console.log('📊 Activity tracking disabled');
  }

  // Get user activity summary
  async getActivitySummary() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;

      const response = await fetch(`${this.apiBaseUrl}/activity/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
    } catch (error) {
      console.error('❌ Error getting activity summary:', error);
      return null;
    }
  }

  // Get incomplete sessions
  async getIncompleteSessions() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return [];

      const response = await fetch(`${this.apiBaseUrl}/activity/incomplete`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      }
    } catch (error) {
      console.error('❌ Error getting incomplete sessions:', error);
      return [];
    }
  }
}

// Create global instance
window.activityTracker = new ActivityTracker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ActivityTracker;
}
