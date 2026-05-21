# Operator & developer tooling

Small scripts for config checks, smoke tests, and drift audits. Run from the **repository root**.

## Prerequisites

- Node.js (same as app)
- `npm install` completed
- **`config.js`** present (copy from `config.example.js`) for config-based scripts

---

## `npm run qa:preflight` — QA dry-run preflight (`scripts/qa-dry-run-preflight.js`)

Read-only checks before a manual QA dry-run. Verifies `healthz` is **qa**, JWT login works, and `/api/health/credentials` has Pegasus1, Pegasus256, qservices, and search enabled. **Does not** call `/api/install`.

Exits non-zero if environment is not `qa` (unless `QA_DRY_RUN_ALLOW_PROD=true`).

```bash
npm start   # ENVIRONMENT=qa, .env.local loaded
npm run qa:preflight
```

Full supervisor checklist: **`docs/QA_DRY_RUN_CHECKLIST.md`**.

---

## `npm run smoke` — authenticated smoke (`test-workflow.js`)

Hits a **running** server with a real login + JWT. **Read-only** (no install / confirm / SIM writes).

| Step | Endpoint |
|------|-----------|
| Liveness | `GET /healthz` |
| Login | `POST /api/auth/login` |
| Auth | `GET /api/auth/me` |
| Config | `GET /api/config` |
| Pegasus | `GET /api/health/pegasus` |
| Search | `GET /api/search-installations?query=__SMOKE__` |
| Activity | `GET /api/activity/summary` |
| Status probe | `GET /api/installation-status/…` (expects non-auth failure; 404/502 from Pegasus is OK) |

**Environment variables**

| Variable | Default | Purpose |
|----------|---------|---------|
| `WIZARD_BASE_URL` | `http://localhost:8080` | Server origin (no trailing slash) |
| `WIZARD_SMOKE_USER` | `installer` | Login username |
| `WIZARD_SMOKE_PASSWORD` | `installer123` | Login password |

**Examples**

```bash
npm start   # in another terminal
npm run smoke
```

```bash
WIZARD_BASE_URL=http://127.0.0.1:3000 WIZARD_SMOKE_USER=admin WIZARD_SMOKE_PASSWORD=admin123 npm run smoke
```

```bash
node test-workflow.js http://localhost:8080
```

---

## `npm run validate:config` — env / config gate

Loads **`config.js`** and checks for **blocking misconfiguration** (especially when `NODE_ENV=production`).

| Check | Severity |
|-------|----------|
| Production without `JWT_SECRET` / `SESSION_SECRET` | **error** (exit 1) |
| Production without Pegasus tokens for active `ENVIRONMENT` | **error** |
| Empty Pegasus token in non-production | **warning** |
| `DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK=true` | **warning** |
| Deprecated `ENABLE_CONFIRMATION_FALLBACK` set alone | **warning** |
| `TEST_MODE=true` | **warning** |

**Examples**

```bash
npm run validate:config
NODE_ENV=production npm run validate:config
```

---

## `npm run audit:routes` — backend vs `public/` fetch heuristic

Parses **`server.js`** for `app.get` / `app.post` / etc. string paths ( **`app.use` middleware mounts are excluded** from counts) and scans **`public/**/*.html` and `public/**/*.js`** for `fetch(` / `testEndpoint(` patterns, including `` `${this.apiBaseUrl}/...` `` in `activity-tracker.js`.

**Output**

- **Backend without a matching `public/` fetch** — split into “often expected” (probes, `secondary-install`, etc.) vs “review”.
- **Frontend-only paths** — `/api/…` seen in UI with no matching Express route (possible typo).

This is **heuristic**, not proof: dynamic URLs, mobile clients, or external callers are not scanned.

**Example**

```bash
npm run audit:routes
```

---

## `npm run audit:activity` — `data/activities.json` hygiene

Reads **`data/activities.json`** (if present) and reports:

- **Duplicate** `sessionId` values  
- **Malformed** rows (missing `sessionId`, `steps` keys, etc.)  
- **Stale** `in_progress` rows older than `ACTIVITY_STALE_HOURS` (default **168** hours)

| Flag | Behavior |
|------|----------|
| `--strict` | Exit **1** if duplicates or malformed rows exist |
| `--strict --fail-on-stale` | Also exit **1** if any stale `in_progress` session exists |

**Examples**

```bash
npm run audit:activity
ACTIVITY_STALE_HOURS=72 npm run audit:activity
node scripts/audit-activity-json.js --strict
```

---

## Suggested CI / deploy order

1. `npm run validate:config` (with production env if applicable)  
2. `npm run audit:routes`  
3. `npm run audit:activity` or `… --strict` if you enforce clean activity files  
4. Start app → `npm run smoke`
