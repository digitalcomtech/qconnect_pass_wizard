# Known issues and technical debt

Repo-specific items the stabilization audit called out. This list is not exhaustive.

## Confirmation “success” without Pegasus (mitigated in Phase 1A)

Previously, when Pegasus confirmation could not be reached, the API could still return **`success: true`**. That is **false success** from a business perspective.

**Current behavior:** That path is **disabled by default**. It only runs if **`DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK=true`**. The JSON response includes **`dangerousUnconfirmedPegasusSuccess: true`** and an explicit **`message`** that upstream confirmation did not occur. Logs use **`console.error`** with a clear prefix.

**Still debt:** The UI may still show a green path if it only checks `success` — consider a follow-up to surface **`dangerousUnconfirmedPegasusSuccess`** in the wizard.

## `ENABLE_CONFIRMATION_FALLBACK` (deprecated)

The old env flag is **ignored** for enabling fallback. If set to `true` without the dangerous flag, a **startup warning** is printed. Remove it from deployment configs to avoid confusion.

## Duplicate installation check (Phase 2)

`checkDuplicateInstallation` now returns **`outcome`**: `duplicate` | `not_duplicate` | **`lookup_failed`**. On **`lookup_failed`**, **`POST /api/install`** and **`POST /api/secondary-install`** respond with **503** and body **`code: DUPLICATE_CHECK_UNAVAILABLE`** instead of proceeding silently. Pegasus **404** on the installation record is treated as **not duplicate** (record not found).

## Activity tracker file races

`activity-tracker.js` persists to JSON without serializing concurrent writes. Not changed in Phase 1A.

## Monolithic `server.js` and `public/index.html`

Business logic and HTTP routing live together in a very large `server.js`; the client is a single large HTML file. Planned later refactor; not in scope for Phase 1A.

## `/api/secondary-install` vs main install

The UI submits secondary devices via **`POST /api/install`**. **`POST /api/secondary-install`** exists for API/testing and may drift from the main path. Not removed in Phase 1A.

## Zapier references in older docs

Zapier env vars were removed from **`env.example`** and dead Zapier constants from **`server.js`**. Other markdown files (`DEPLOYMENT.md`, `GITHUB_SETUP.md`, etc.) may still mention Zapier until edited in a later pass.

## Session cookie `secure: false`

Express session cookies are still **`secure: false`**, suitable for plain HTTP local dev. Production behind HTTPS should eventually set **`secure: true`** when cookies are only sent over TLS.

## Proximity helpers

Browser-only proximity helpers were removed from the bottom of **`server.js`** (they referenced `sessionStorage` / `alert`). Any proximity UX belongs in **`public/`** client code only.
