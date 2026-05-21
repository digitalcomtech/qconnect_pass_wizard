# QA dry-run validation checklist

Use this checklist to validate the **PASS Provisioning Console** supervisor workflow in **QA** without touching production Pegasus data by mistake.

## Before you start

| Check | Action |
|-------|--------|
| **Intended environment** | You mean **QA**, not production. |
| **Local config** | `ENVIRONMENT=qa` in `.env.local` (or shell). Reload the server after changes. |
| **Tokens** | `npm run pegasus:fetch-tokens` with QA credentials; `QA_PEGASUS_BASE_URL=https://qservices.pegasusgateway.com/qa`. See `docs/PEGASUS_AUTH.md`. |
| **Automated preflight** | `npm run qa:preflight` (read-only API checks; fails if env is not QA). |

### Do not use production unless intentional

- Header badge must read **QA** (orange), not **PROD**.
- `GET /healthz` must return `"environment": "qa"`.
- If you see **PROD**, stop and fix `.env.local` before continuing.
- **Mutation testing in production** requires explicit approval and different test data.

---

## Phase A — Read-only validation (recommended first)

No Pegasus writes. Safe for routine QA verification.

### A1. Environment and credentials

| # | Step | Expected |
|---|------|----------|
| 1 | Open the console; confirm header badge **QA**. | Badge shows QA. |
| 2 | `GET /healthz` (no auth): `curl -s http://localhost:8080/healthz` | `"environment": "qa"` |
| 3 | Log in (e.g. `installer` / `installer123` in dev). | Login succeeds. |
| 4 | `GET /api/health/credentials` (with JWT). | See table below. |
| 5 | `GET /api/health/pegasus` (with JWT). | `success: true`, live JSON probe OK. |
| 6 | `npm run smoke` | All steps pass or expected upstream skips. |

**`/api/health/credentials` must show:**

| Field | Expected for full QA dry-run |
|-------|---------------------------|
| `pegasus1TokenConfigured` | `true` |
| `pegasus256TokenConfigured` | `true` |
| `qservicesTokenConfigured` | `true` |
| `deviceLookupAvailable` | `true` |
| `simLookupAvailable` | `true` |
| `installationSearchAvailable` | `true` |

Also confirm `GET /api/config` → `credentials` matches the same booleans and `environment` is `qa`.

**CLI helper (prints flags only, no secrets):**

```bash
npm run qa:preflight
```

### A2. Installation search and VIN

| # | Step | Expected |
|---|------|----------|
| 7 | Search using a **known QA client name** or **VIN prefix** (from your QA roster). | Status line shows results; VIN dropdown populated. |
| 8 | Select a **known QA VIN**. | Insured name appears; preview updates VIN + installation ID. |
| 9 | Confirm preview **Environment** row shows **QA**. | Must not show PROD. |

If search returns 502 with `upstream_non_json_response` or `upstream_redirect`, fix `QA_PEGASUS_BASE_URL` (see `docs/PEGASUS_AUTH.md`).

### A3. Device lookup (primary)

Use **QA test devices** your team has approved for lookup (not production IMEI/ICCID).

| # | Step | Expected |
|---|------|----------|
| 10 | Enter **known QA primary IMEI**; wait for live lookup. | Inline status: found in Pegasus (not linked). |
| 11 | Retype matching IMEI in confirm field. | Preview blockers clear when valid. |
| 12 | Enter **known QA primary SIM (ICCID)** if applicable. | Lookup shows **Pegasus256** or **Pegasus1** as source. |
| 13 | Retype matching SIM in confirm field. | No mismatch blocker. |

### A4. Device lookup (secondary, optional)

| # | Step | Expected |
|---|------|----------|
| 14 | Enable **secondary unit**; enter QA secondary IMEI/SIM if available. | Lookup statuses mirror primary behavior. |
| 15 | Disable secondary; confirm preview drops secondary lines. | Preview updates accordingly. |

### A5. Provisioning preview (stop here for read-only dry-run)

| # | Step | Expected in preview panel |
|---|------|---------------------------|
| 16 | **Client** | Matches selected installation / search. |
| 17 | **VIN** | Selected VIN. |
| 18 | **Installation ID** | Non-empty Pegasus installation id. |
| 19 | **Environment** | `QA`. |
| 20 | **Device lookup** | Primary IMEI/SIM lines; secondary if enabled. SIM line shows source (**Pegasus256** or **Pegasus1**). |
| 21 | **Planned Pegasus actions** | Group, vehicle, device link, SIM processing, qservices duplicate check. |
| 22 | **Provision button** | Enabled only when all blockers are resolved. |

**Stop before step 23** if you are not authorized to mutate QA Pegasus for this run.

---

## Phase B — Mutation validation (QA only, intentional)

`POST /api/install` creates/updates groups, vehicles, devices, and SIM state in Pegasus. Run only with **approved QA installation + devices** and a rollback plan.

| # | Step | Expected |
|---|------|----------|
| 23 | Re-read preview; confirm **QA** and planned actions. | No surprises. |
| 24 | Click **Provision in Pegasus**. | Request completes; receipt panel appears. |
| 25 | Receipt **status badge** | Success, partial, or failed — matches outcome. |
| 26 | Receipt **`details.steps`** (or legacy step summary) | Lists qservices duplicate check, group, vehicle, device, SIM, confirmation as applicable. |
| 27 | Step outcomes | Group/vehicle/device/SIM steps show ok/fail with readable messages. |
| 28 | **Secrets** | Receipt and UI show **no** tokens, passwords, or raw `auth` values. |
| 29 | **Copy receipt summary** | Paste into a ticket; confirm VIN, installation ID, IMEI, SIM, and step list are useful for support. |
| 30 | **Start over** | Page resets; receipt hidden; search fields cleared. |

If `TEST_MODE=true` in server env, Pegasus mutation may be skipped — note that in your run log.

---

## Quick reference — API probes

Replace `TOKEN` with JWT from login.

```bash
# Environment (no auth)
curl -s http://localhost:8080/healthz | jq .environment

# Credentials (auth required)
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8080/api/health/credentials \
  | jq '{pegasus1TokenConfigured, pegasus256TokenConfigured, qservicesTokenConfigured, installationSearchAvailable}'

# Live qservices probe
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8080/api/health/pegasus | jq '{success, status, upstream}'
```

---

## Sign-off template

Copy for Slack/email when completing a read-only dry-run:

```
QA dry-run (read-only): PASS / FAIL
Date:
Operator:
Server: [URL]
healthz environment: qa
credentials: p1= Y/N  p256= Y/N  qservices= Y/N  search= Y/N
search + VIN: Y/N
primary IMEI/SIM lookup: Y/N
preview complete (stopped before provision): Y/N
Notes:
```

For mutation runs, add: `Provision tested: Y/N`, `Receipt steps OK: Y/N`, `Receipt copy reviewed: Y/N`.

---

## Related docs

- `docs/PEGASUS_AUTH.md` — token refresh and qservices base URL
- `docs/ENVIRONMENT.md` — env vars
- `docs/TOOLING.md` — `npm run smoke`, `npm run qa:preflight`
