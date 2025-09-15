// Simple i18next implementation without CDN dependencies
// This will work with a basic translation system

// Translation data
const translations = {
  en: {
    "app.title": "QConnect PASS Wizard",
    "app.language": "Language",
    "installation.title": "Device Installation",
    "installation.clientSelection": "Client Selection",
    "installation.enterClientName": "Enter client name or VIN",
    "installation.vinSelection": "VIN Selection",
    "installation.chooseVin": "Choose installation VIN",
    "installation.deviceSetup": "Device Setup",
    "installation.enterImeiSim": "Enter IMEI & SIM details",
    "installation.locationCheck": "Location Check",
    "installation.verifyProximity": "Verify proximity to device",
    "installation.imei": "IMEI (Primary Device)",
    "installation.clientName": "Client Name or VIN Start:",
    "installation.formCompletion": "Form Completion",
    "installation.completeForm": "Complete installation form",
    "installation.finalConfirmation": "Final Confirmation",
    "installation.confirmComplete": "Confirm installation complete",
    "buttons.verify": "Verify IMEI",
    "buttons.next": "Submit ▶ Load VINs",
    "buttons.back": "Back",
    "buttons.startInstallation": "Start Installation",
    "buttons.stopWaiting": "Stop Waiting",
    "buttons.checkNow": "Check Now",
    "buttons.logout": "Logout",
    "user.fieldInstaller": "Field Installer",
    "user.installer": "Installer",
    "header.step": "STEP",
    "header.vin": "VIN",
    "header.primary": "PRIMARY",
    "header.secondary": "SECONDARY",
    "header.status": "STATUS",
    "status.monitoringLocation": "Monitoring device location...",
    "status.waitingForDevice": "Waiting for device to report location...",
    "status.imeiVerified": "IMEI verified successfully! Device state: unlinked",
    "status.retypeImei": "Retype IMEI",
    "status.simCard": "SIM Card # (Optional)",
    "status.simPlaceholder": "Leave blank if no SIM card",
    "status.verifySim": "Verify SIM",
    "status.retypeSim": "Retype SIM Card # (Optional)",
    "status.addSecondary": "Add Secondary Unit (IMEI)",
    "location.title": "Location Verification",
    "location.description": "The app will verify your location is within 200 meters of the device before proceeding with installation.",
    "location.elapsedTime": "Elapsed time",
    "location.nextCheck": "Next check in",
    "location.attempts": "Attempts",
    "location.currentInterval": "Current interval",
    "location.tip": "Tip: Device may take up to 30 minutes to report. We'll check every minute at a steady pace.",
    "location.enhancedRequirements": "Enhanced Requirements",
    "location.bypassAvailable": "Bypass Available",
    "location.bypassDescription": "After 15 minutes, you can bypass the location check and proceed with installation"
  },
  es: {
    "app.title": "Asistente QConnect PASS",
    "app.language": "Idioma",
    "installation.title": "Instalación de Dispositivo",
    "installation.clientSelection": "Selección de Cliente",
    "installation.enterClientName": "Ingrese nombre del cliente o VIN",
    "installation.vinSelection": "Selección de VIN",
    "installation.chooseVin": "Elija VIN de instalación",
    "installation.deviceSetup": "Configuración del Dispositivo",
    "installation.enterImeiSim": "Ingrese detalles de IMEI y SIM",
    "installation.locationCheck": "Verificación de Ubicación",
    "installation.verifyProximity": "Verificar proximidad al dispositivo",
    "installation.imei": "IMEI (Dispositivo Principal)",
    "installation.clientName": "Nombre del Cliente o Inicio de VIN:",
    "installation.formCompletion": "Finalización del Formulario",
    "installation.completeForm": "Complete el formulario de instalación",
    "installation.finalConfirmation": "Confirmación Final",
    "installation.confirmComplete": "Confirmar instalación completa",
    "buttons.verify": "Verificar IMEI",
    "buttons.next": "Enviar ▶ Cargar VINs",
    "buttons.back": "Atrás",
    "buttons.startInstallation": "Iniciar Instalación",
    "buttons.stopWaiting": "Dejar de Esperar",
    "buttons.checkNow": "Verificar Ahora",
    "buttons.logout": "Cerrar Sesión",
    "user.fieldInstaller": "Instalador de Campo",
    "user.installer": "Instalador",
    "header.step": "PASO",
    "header.vin": "VIN",
    "header.primary": "PRINCIPAL",
    "header.secondary": "SECUNDARIO",
    "header.status": "ESTADO",
    "status.monitoringLocation": "Monitoreando ubicación del dispositivo...",
    "status.waitingForDevice": "Esperando que el dispositivo reporte ubicación...",
    "status.imeiVerified": "¡IMEI verificado exitosamente! Estado del dispositivo: desvinculado",
    "status.retypeImei": "Reescribir IMEI",
    "status.simCard": "Tarjeta SIM # (Opcional)",
    "status.simPlaceholder": "Dejar en blanco si no hay tarjeta SIM",
    "status.verifySim": "Verificar SIM",
    "status.retypeSim": "Reescribir Tarjeta SIM # (Opcional)",
    "status.addSecondary": "Agregar Unidad Secundaria (IMEI)",
    "location.title": "Verificación de Ubicación",
    "location.description": "La aplicación verificará que su ubicación esté dentro de 200 metros del dispositivo antes de proceder con la instalación.",
    "location.elapsedTime": "Tiempo transcurrido",
    "location.nextCheck": "Próxima verificación en",
    "location.attempts": "Intentos",
    "location.currentInterval": "Intervalo actual",
    "location.tip": "Consejo: El dispositivo puede tardar hasta 30 minutos en reportar. Verificaremos cada minuto a un ritmo constante.",
    "location.enhancedRequirements": "Requisitos Mejorados",
    "location.bypassAvailable": "Omisión Disponible",
    "location.bypassDescription": "Después de 15 minutos, puede omitir la verificación de ubicación y proceder con la instalación"
  }
};

// Current language
let currentLanguage = 'en';

// Get translation
function t(key) {
  return translations[currentLanguage][key] || translations['en'][key] || key;
}

// Change language
function changeLanguage(lng) {
  console.log('Changing language to:', lng);
  currentLanguage = lng;
  localStorage.setItem('i18nextLng', lng);
  updatePageLanguage();
  console.log('Language changed to:', lng);
}

// Get current language
function getCurrentLanguage() {
  return currentLanguage;
}

// Update all elements with data-i18n attributes
function updatePageLanguage() {
  const elements = document.querySelectorAll('[data-i18n]');
  console.log('Found', elements.length, 'elements with data-i18n attributes');
  
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const text = t(key);
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

// Update elements with data-i18n-html attributes
function updatePageLanguageHTML() {
  const elements = document.querySelectorAll('[data-i18n-html]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n-html');
    const html = t(key);
    element.innerHTML = html;
  });
}

// Initialize language from localStorage or browser
function initializeLanguage() {
  const savedLanguage = localStorage.getItem('i18nextLng');
  const browserLanguage = navigator.language.split('-')[0];
  
  if (savedLanguage && translations[savedLanguage]) {
    currentLanguage = savedLanguage;
  } else if (translations[browserLanguage]) {
    currentLanguage = browserLanguage;
  } else {
    currentLanguage = 'en';
  }
  
  console.log('Initialized with language:', currentLanguage);
}

// Make functions globally available
window.changeLanguage = changeLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.t = t;
window.updatePageLanguage = updatePageLanguage;
window.updatePageLanguageHTML = updatePageLanguageHTML;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguage();
  updatePageLanguage();
  updatePageLanguageHTML();
  
  // Initialize language selector
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    languageSelector.value = currentLanguage;
    
    // Add change event listener
    languageSelector.addEventListener('change', (e) => {
      changeLanguage(e.target.value);
    });
  }
});
