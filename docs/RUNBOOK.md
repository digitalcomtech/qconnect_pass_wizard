# Runbook — QConnect PASS Wizard (installer-app)

## Run locally

```bash
npm install
# Set env vars (see docs/ENVIRONMENT.md), then:
npm start
```

**Verification scripts** (smoke, config validation, route & activity audits): see **`docs/TOOLING.md`** (`npm run smoke`, `validate:config`, `audit:routes`, `audit:activity`).

Default listen: `PORT` or **8080**. Open the wizard in a browser at `http://localhost:8080` (or your host/port).

## Production deploy checklist

1. Set **`NODE_ENV=production`**.
2. Set strong **`JWT_SECRET`** and **`SESSION_SECRET`** (long random strings).
3. Set **`ENVIRONMENT`** to `production` or `qa` to match the Pegasus realm you target.
4. Set all required Pegasus tokens for that realm (`PROD_*` or `QA_*` per `docs/ENVIRONMENT.md`).
5. Ensure **`DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK`** is **unset** or **`false`** unless operations explicitly accept false-positive confirmations (see `docs/KNOWN_ISSUES.md`).
6. Terminate TLS at your reverse proxy and consider **`secure: true`** on session cookies when the app is only served over HTTPS (code still uses `secure: false` today — tracked as follow-up).

## Health checks

| Endpoint | Auth | Use |
|----------|------|-----|
| `GET /healthz` | No | Liveness: process responding. |
| `GET /api/health/pegasus` | JWT | Dependency check against Pegasus qservices `health`. |

Configure load balancers and orchestrators to use **`/healthz`** for liveness.

## Logs to watch

- **`[startup]`** — missing Pegasus token in non-production, or production validation.
- **`[Pegasus]`** — JSON lines from `pegasus-client.js`: `context`, redacted `upstream`, HTTP `status`, `authMode`, `authConfigured`, short `reason` (no raw tokens).
- **`[install]` / `[secondary-install]`** with **`duplicate-check uncertain`** — Pegasus duplicate probe failed; user receives **503** + `DUPLICATE_CHECK_UNAVAILABLE`.
- **`[confirm-installation] DANGEROUS_...`** — unsafe fallback path used; investigate Pegasus connectivity immediately.
- **`[config] ENABLE_CONFIRMATION_FALLBACK is deprecated`** — remove old env var; use explicit dangerous flag only if needed.

## Common failures

| Symptom | Likely cause |
|---------|----------------|
| Process exits immediately on boot | `NODE_ENV=production` without required secrets or Pegasus env vars. |
| 401 on all API routes | Missing or invalid `Authorization: Bearer` JWT after login. |
| 503 from `/api/health/pegasus` | Pegasus unreachable or bad token for qservices. |
| Installation API errors with 401/403 from Pegasus | Wrong or empty `Authenticate` / Bearer token for the host being called. |

## Rotate credentials

1. Issue new Pegasus tokens in your operator console.
2. Update env vars on the host; restart the process.
3. Invalidate old JWTs if **`JWT_SECRET`** changes (all users must log in again).

## Data on disk

Activity tracking writes **`data/activities.json`** and **`data/activity-stats.json`**. Back up or prune as part of your ops policy; not covered by this slice.
