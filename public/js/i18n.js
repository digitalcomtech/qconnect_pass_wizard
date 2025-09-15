// i18next configuration and initialization
// Load i18next from CDN
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Load all required scripts
async function loadI18nextScripts() {
  try {
    await loadScript('https://unpkg.com/i18next@23.7.6/dist/umd/i18next.min.js');
    await loadScript('https://unpkg.com/i18next-browser-languagedetector@7.2.0/dist/umd/i18nextBrowserLanguageDetector.min.js');
    await loadScript('https://unpkg.com/i18next-http-backend@2.4.2/dist/umd/i18nextHttpBackend.min.js');
    
    // Wait a bit for scripts to be available globally
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  } catch (error) {
    console.error('Failed to load i18next scripts:', error);
    return false;
  }
}

// Initialize i18next
async function initializeI18next() {
  const scriptsLoaded = await loadI18nextScripts();
  if (!scriptsLoaded) {
    console.error('i18next scripts failed to load');
    return;
  }

  if (typeof window.i18next === 'undefined') {
    console.error('i18next not available');
    return;
  }

  try {
    await window.i18next
      .use(window.i18nextHttpBackend)
      .use(window.i18nextBrowserLanguageDetector)
      .init({
        // Language detection options
        detection: {
          order: ['localStorage', 'navigator', 'htmlTag'],
          caches: ['localStorage'],
          lookupLocalStorage: 'i18nextLng'
        },
        
        // Fallback language
        fallbackLng: 'en',
        
        // Supported languages
        supportedLngs: ['en', 'es'],
        
        // Namespace
        ns: ['translation'],
        defaultNS: 'translation',
        
        // Backend configuration
        backend: {
          loadPath: '/locales/{{lng}}/{{ns}}.json'
        },
        
        // Interpolation options
        interpolation: {
          escapeValue: false
        },
        
        // Debug mode
        debug: true
      });

    console.log('i18next initialized successfully');
    console.log('Current language:', window.i18next.language);
    updatePageLanguage();
    updatePageLanguageHTML();
    
    // Initialize language selector
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
      languageSelector.value = window.i18next.language;
      
      // Add change event listener
      languageSelector.addEventListener('change', (e) => {
        changeLanguage(e.target.value);
      });
    }
    
    // Set up language change listener
    window.i18next.on('languageChanged', () => {
      updatePageLanguage();
      updatePageLanguageHTML();
      
      // Update language selector if it exists
      const languageSelector = document.getElementById('languageSelector');
      if (languageSelector) {
        languageSelector.value = window.i18next.language;
      }
    });
    
  } catch (error) {
    console.error('Failed to initialize i18next:', error);
  }
}

// Helper function to change language
function changeLanguage(lng) {
  console.log('Changing language to:', lng);
  if (window.i18next) {
    return window.i18next.changeLanguage(lng).then(() => {
      console.log('Language changed to:', lng);
      updatePageLanguage();
      updatePageLanguageHTML();
    });
  }
}

// Helper function to get current language
function getCurrentLanguage() {
  return window.i18next ? window.i18next.language : 'en';
}

// Helper function to translate text
function t(key, options = {}) {
  return window.i18next ? window.i18next.t(key, options) : key;
}

// Helper function to update all elements with data-i18n attributes
function updatePageLanguage() {
  if (!window.i18next) {
    console.log('i18next not available for updatePageLanguage');
    return;
  }
  
  const elements = document.querySelectorAll('[data-i18n]');
  console.log('Found', elements.length, 'elements with data-i18n attributes');
  
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const text = window.i18next.t(key);
    console.log('Translating', key, 'to', text);
    
    if (element.tagName === 'INPUT' && element.type === 'text') {
      element.placeholder = text;
    } else if (element.tagName === 'INPUT' && element.type === 'password') {
      element.placeholder = text;
    } else {
      element.textContent = text;
    }
  });
}

// Helper function to update elements with data-i18n-html attributes (for HTML content)
function updatePageLanguageHTML() {
  if (!window.i18next) return;
  
  const elements = document.querySelectorAll('[data-i18n-html]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n-html');
    const html = window.i18next.t(key);
    element.innerHTML = html;
  });
}

// Make functions globally available
window.changeLanguage = changeLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.t = t;
window.updatePageLanguage = updatePageLanguage;
window.updatePageLanguageHTML = updatePageLanguageHTML;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeI18next();
});