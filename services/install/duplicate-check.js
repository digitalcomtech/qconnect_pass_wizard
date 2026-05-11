/**
 * Pegasus-backed duplicate installation probe (install + secondary-install preflight).
 */
function createDuplicateInstallationChecker(pegasus) {
  /**
   * Duplicate probe against Pegasus qservices.
   * @returns {{ outcome: 'duplicate'|'not_duplicate'|'lookup_failed', httpStatus?: number, reason?: string, installationStatus?: string }}
   */
  async function checkDuplicateInstallation(installationId) {
    const context = "duplicate-check";
    const path = `/installations/api/v1/installation/${encodeURIComponent(installationId)}`;
    console.log(`   Checking for duplicate installation ID: ${installationId}`);
    try {
      const response = await pegasus.qservicesGetAllow404(context, path);
      if (response.status === 404) {
        return { outcome: "not_duplicate", httpStatus: 404 };
      }
      if (!response.ok) {
        let reason = response.statusText;
        try {
          const text = await response.text();
          if (text) reason = pegasus.truncate(text, 400);
        } catch (_) {
          /* ignore */
        }
        return { outcome: "lookup_failed", httpStatus: response.status, reason };
      }
      let data;
      try {
        data = await response.json();
      } catch (e) {
        return {
          outcome: "lookup_failed",
          httpStatus: response.status,
          reason: "Invalid or empty JSON from Pegasus installation lookup",
        };
      }
      const duplicate =
        data.status === "completed" || data.status === "confirmed";
      return {
        outcome: duplicate ? "duplicate" : "not_duplicate",
        httpStatus: response.status,
        installationStatus: data.status,
      };
    } catch (error) {
      return { outcome: "lookup_failed", httpStatus: null, reason: error.message };
    }
  }

  return checkDuplicateInstallation;
}

module.exports = { createDuplicateInstallationChecker };
