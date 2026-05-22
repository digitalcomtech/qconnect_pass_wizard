// Installation search status + VIN section readiness (no API changes)

function setClientSearchStatus(mode, message) {
  if (typeof clientStatus === "undefined" || !clientStatus) return;
  clientStatus.classList.remove(
    "status-line--loading",
    "status-line--success",
    "status-line--error",
    "status-line--warn"
  );
  clientStatus.textContent = message || "";
  if (!message) return;
  if (mode === "loading") clientStatus.classList.add("status-line--loading");
  else if (mode === "success") clientStatus.classList.add("status-line--success");
  else if (mode === "warn") clientStatus.classList.add("status-line--warn");
  else if (mode === "error") clientStatus.classList.add("status-line--error");
}

function setVinHintStatus(message, mode) {
  if (typeof vinStatus === "undefined" || !vinStatus) return;
  vinStatus.classList.remove(
    "status-line--hint",
    "status-line--success",
    "status-line--error",
    "status-line--loading"
  );
  vinStatus.textContent = message || "";
  if (!message) return;
  if (mode === "success") vinStatus.classList.add("status-line--success");
  else vinStatus.classList.add("status-line--hint");
}

function formatSearchSuccessMessage(totalFetched, matchedCount, query) {
  const q = query || "";
  if (totalFetched != null && Number.isFinite(totalFetched)) {
    return (
      "Fetched " +
      totalFetched +
      " installation" +
      (totalFetched === 1 ? "" : "s") +
      ". " +
      matchedCount +
      " matched" +
      (q ? ' "' + q + '".' : " your search.")
    );
  }
  return (
    "Found " +
    matchedCount +
    " matching installation" +
    (matchedCount === 1 ? "" : "s") +
    (q ? ' for "' + q + '".' : ".")
  );
}

function formatSearchZeroMessage(totalFetched, query) {
  const q = query || "";
  if (totalFetched != null && Number.isFinite(totalFetched)) {
    return (
      "Fetched " +
      totalFetched +
      " installation" +
      (totalFetched === 1 ? "" : "s") +
      ". 0 matched" +
      (q ? ' "' + q + '".' : " your search.")
    );
  }
  return "0 installations matched" + (q ? ' "' + q + '".' : ".");
}

/**
 * @param {"disabled"|"loading"|"ready"|"empty"} state
 */
function setVinSectionState(state) {
  var section = document.getElementById("vinSection");
  if (section) {
    var locked = state === "disabled" || state === "loading" || state === "empty";
    section.classList.toggle("console-card--disabled", locked);
  }
  if (typeof vinSelect !== "undefined" && vinSelect) {
    vinSelect.disabled = state !== "ready";
  }

  if (state === "loading") {
    setVinHintStatus("VIN list will unlock after search completes.", "hint");
    if (typeof vinSelect !== "undefined" && vinSelect) {
      vinSelect.innerHTML = '<option value="">— Select VIN —</option>';
    }
  } else if (state === "ready") {
    setVinHintStatus("Select a VIN to continue.", "success");
  } else if (state === "empty") {
    setVinHintStatus("", "hint");
    if (typeof vinSelect !== "undefined" && vinSelect) {
      vinSelect.innerHTML = '<option value="">— No VINs found —</option>';
    }
  } else {
    setVinHintStatus("Search for an installation to enable VIN selection.", "hint");
    if (typeof vinSelect !== "undefined" && vinSelect) {
      vinSelect.innerHTML = '<option value="">— Select VIN —</option>';
    }
  }
}

function syncSearchUiFromJob(job) {
  var results = job && job.searchResults ? job.searchResults : [];
  var query = job && job.searchQuery ? job.searchQuery : "";
  if (results.length > 0) {
    setClientSearchStatus(
      "success",
      formatSearchSuccessMessage(null, results.length, query)
    );
    setVinSectionState("ready");
    if (job.selectedVin) {
      setVinHintStatus("Selected VIN: " + job.selectedVin, "success");
    }
  } else if (query) {
    setClientSearchStatus("warn", formatSearchZeroMessage(null, query));
    setVinSectionState("empty");
  } else {
    setVinSectionState("disabled");
  }
}

window.setClientSearchStatus = setClientSearchStatus;
window.setVinSectionState = setVinSectionState;
window.setVinHintStatus = setVinHintStatus;
window.formatSearchSuccessMessage = formatSearchSuccessMessage;
window.formatSearchZeroMessage = formatSearchZeroMessage;
window.syncSearchUiFromJob = syncSearchUiFromJob;
