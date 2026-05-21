// Auth gate + API header helper + header logout
(function () {
  var token = localStorage.getItem("authToken");
  if (!token) {
    window.location.replace("/login.html");
    return;
  }

  fetch("/api/auth/me", {
    headers: { Authorization: "Bearer " + token },
  })
    .then(function (res) {
      if (!res.ok) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userInfo");
        window.location.replace("/login.html");
      }
    })
    .catch(function () {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userInfo");
      window.location.replace("/login.html");
    });
})();

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + localStorage.getItem("authToken"),
  };
}

function setupUserInfo() {
  var userInfo = {};
  try {
    userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  } catch (e) {
    userInfo = {};
  }

  var headerUserLabel = document.getElementById("headerUserLabel");
  var logoutBtn = document.getElementById("logoutBtn");

  if (headerUserLabel && userInfo.name) {
    var role = userInfo.role ? " (" + userInfo.role + ")" : "";
    headerUserLabel.textContent = userInfo.name + role;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      var authToken = localStorage.getItem("authToken");
      var logoutRequest = authToken
        ? fetch("/api/auth/logout", {
            method: "POST",
            headers: { Authorization: "Bearer " + authToken },
          })
        : Promise.resolve();

      logoutRequest
        .catch(function (err) {
          console.warn("Logout request failed:", err);
        })
        .finally(function () {
          localStorage.removeItem("authToken");
          localStorage.removeItem("userInfo");
          window.location.replace("/login.html");
        });
    });
  }
}
