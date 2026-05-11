// Small shared helpers (debug panel + distance)
function debugPrint(obj, label = "") {
  const out = document.getElementById("debugOutput");
  if (out) {
    out.textContent = (label ? label + ":\n" : "") + JSON.stringify(obj, null, 2);
  }
}
// Haversine Distance calculation (for proximity check)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

// Meters (used by primary manual proximity UI; haversineDistance returns km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  return haversineDistance(lat1, lon1, lat2, lon2) * 1000;
}
