# Environment and configuration

This app reads **`config.js`** (gitignored; copy from `config.example.js`). All secrets and environment-specific Pegasus values are expected from **process environment variables**, not from committed files.

## Quick start (local)

1. Copy `env.example` to `.env` and fill in tokens (your shell or process manager must load them — Node does not load `.env` automatically unless you use a loader).
2. Export variables or use your host’s secret manager.
3. For local-only convenience, you may omit `JWT_SECRET` and `SESSION_SECRET` when **`NODE_ENV` is not `production`**. The server will log a warning and use fixed **insecure dev-only** fallbacks. Do not rely on this for any shared or deployed host.

## `NODE_ENV=production` (required behavior)

When `NODE_ENV=production`, the following **must** be set or the process **exits at startup**:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs and verifies JWTs (`auth.js`). |
| `SESSION_SECRET` | Express session cookie signing (`server.js`). |
| `PROD_PEGASUS_TOKEN` or `QA_PEGASUS_TOKEN` | Bearer token for qservices installation flows — whichever matches `ENVIRONMENT`. |
| `PROD_PEGASUS1_TOKEN` / `PROD_PEGASUS256_TOKEN` (or QA pair) | `Authenticate` header for `api.pegasusgateway.com` SIM and related calls. |

The active Pegasus block is selected by **`ENVIRONMENT`**: `production` or `qa` (default in example config is `qa` unless `ENVIRONMENT=production`).

## Optional / tuning

See `env.example` for the full list, including:

- `PORT`, `HOST`
- `TEST_MODE=true` — skips real Pegasus calls in several endpoints (labeled in logs)
- `PROD_DEFAULT_GROUP_ID`, `PROD_DEFAULT_GROUP_ID2`, `QA_*` — vehicle group defaults (numeric)
- `PROD_SIM_ACCOUNT_SID`, rate plan / fleet SIDs, SIM endpoint overrides
- API timeout and workflow polling envs (`API_*`, `MAX_DEVICE_WAIT_TIME`, etc.)

## Dangerous confirmation flag

`DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK=true` allows `/api/confirm-installation` to return **HTTP 200 with `success: true`** when Pegasus could not be reached. Default is **off**. See `docs/KNOWN_ISSUES.md`.

The deprecated name **`ENABLE_CONFIRMATION_FALLBACK`** does **nothing** (fallback is never enabled by it). If it is set to `true` without the dangerous flag, a startup **warning** is logged. Only **`DANGEROUS_PEGASUS_CONFIRMATION_FALLBACK=true`** can enable the unsafe path.

## Pegasus HTTP client

Outbound Pegasus calls are centralized in **`pegasus-client.js`** (`createPegasusClient`): qservices routes use **Bearer** + `pegasusBaseUrl`; `api.pegasusgateway.com` routes use the **`Authenticate`** header. Failures are logged as **`[Pegasus]`** JSON lines (upstream URL redacted, no secrets). `server.js` wires a single client instance after config load.

For **`api.pegasusgateway.com`**, the client prefers **`pegasus1Token`** over **`pegasusToken`** when both are set (devices, groups, vehicles, IMEI verify).

### Refreshing expired tokens

**QA qservices (installation search):** set **`QA_PEGASUS_BASE_URL=https://qservices.pegasusgateway.com/qa`** and obtain **`QA_PEGASUS_TOKEN`** via auth gateway **`dev2.pegasusgateway.com`** (`npm run pegasus:fetch-tokens` sets both when `PEGASUS_AUTH_USERNAME` / `PEGASUS_AUTH_PASSWORD` are exported). The dev2 host is for auth only, not the installations API.

See **`docs/PEGASUS_AUTH.md`**. Quick path:

```bash
export PEGASUS_AUTH_USERNAME='…'
export PEGASUS_AUTH_PASSWORD='…'
npm run pegasus:fetch-tokens
set -a && source .env.local && set +a && npm start
```

## Tooling

Config validation, smoke flow, route drift audit, and activity JSON audit: **`docs/TOOLING.md`**.

## Health

- **`GET /healthz`** — unauthenticated liveness (process up, JSON). Safe for probes.
- **`GET /api/health/credentials`** — authenticated, **no upstream call**; which of the three Pegasus token families are configured (boolean flags only, never token values).
- **`GET /api/health/pegasus`** — authenticated live probe of **qservices** `/health` only (Bearer). Returns 503 with explanation if qservices token is missing.
- **`GET /api/config`** — includes a `credentials` summary for the frontend (same booleans, no secrets).

## Files

| File | Role |
|------|------|
| `config.example.js` | Tracked template; same shape as `config.js`. |
| `config.js` | Local overrides / copy; gitignored. |
| `env.example` | Variable names and comments only. |
