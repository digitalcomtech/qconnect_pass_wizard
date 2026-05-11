// Wizard: open Pegasus pre-filled external form (FleetMetriks)

/** Build FleetMetriks URL or null if installation data is missing. */
function buildFleetmetriksPrefilledFormUrl() {
  const inst = JSON.parse(sessionStorage.getItem("selectedInstallation") || "{}");
  if (!inst || !inst.vehiculo) {
    return null;
  }
  const params = new URLSearchParams({
    installationId: inst._id,
    driverName: inst.persona?.nombreAsegurado || "",
    "driverName[last]": inst.persona?.apellidoPaterno || "",
    email: inst.persona?.contactos?.[0]?.email || "",
    serviceType: inst.persona?.tipo || "",
    enterpriseName: inst.persona?.nombreAsegurado + " " + inst.persona?.apellidoPaterno,
    typeA127: "Instalación",
    plate: inst.vehiculo?.placas || "",
    make: inst.vehiculo?.marca || "",
    model: inst.vehiculo?.submarca || "",
    ano: inst.vehiculo?.modelo || "",
    vin: inst.vehiculo?.serie || "",
    color: inst.vehiculo?.color || "",
    numeroEconomico: inst.vehiculo?.numeroEconomico || "",
    noDe: inst.vehiculo?.numeroMotor || ""
  });
  const formId = appConfig.environment === "qa" ? "252054474420955" : "232983887026974";
  return `https://forms.fleetmetriks.com/${formId}?${params.toString()}`;
}

function openPrefilledForm() {
  const url = buildFleetmetriksPrefilledFormUrl();
  if (!url) {
    alert("No installation data found!");
    return;
  }
  console.log(`🔗 Opening ${appConfig.environment.toUpperCase()} form: ${url}`);

  recordPaperworkOpened(url);

  updateWorkflowStatus({
    currentStep: "5",
    status: "Form opened - Complete installation details"
  });

  window.open(url, "_blank");
}

/** Alias used by bypass path — same FleetMetriks open + paperwork recording. */
function openInstallationForm() {
  openPrefilledForm();
}
