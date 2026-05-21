# Pegasus authentication tokens

The installer app uses **three** Pegasus credentials for QA or production (see `env.example`).

| Env var | Used for | How to obtain |
|---------|----------|----------------|
| `QA_PEGASUS1_TOKEN` | `Authenticate` on `api.pegasusgateway.com` — devices, groups, vehicles, SIM (Pegasus1) | Auth gateway `cloud.pegasusgateway.com` |
| `QA_PEGASUS256_TOKEN` | `Authenticate` on SIM APIs (Pegasus256 / migrated) | Auth gateway `qconnect.qualitas.com.mx` |
| `QA_PEGASUS_TOKEN` | **Bearer** on `QA_PEGASUS_BASE_URL` (default `https://dev2.pegasusgateway.com`) — installation search, confirm, health | Auth gateway **`dev2.pegasusgateway.com`** |

## Why `/api/search-installations` returns 401 or 503

| Symptom | Cause |
|---------|--------|
| **503** `qservices_token_missing` | `QA_PEGASUS_TOKEN` is empty. The app does not call Pegasus until the token is set. |
| **401** from Pegasus | Bearer token is missing, **expired**, or **wrong type** (e.g. Pegasus1 `Authenticate` token used as Bearer). |
| **401** after host change | Token was issued for gateway `dev2.pegasusgateway.com` but requests go to `qservices.pegasusgateway.com/qa` (or the reverse). **Base URL and auth gateway must match the same tenant.** |

`QA_PEGASUS1_TOKEN` and `QA_PEGASUS256_TOKEN` **cannot** replace `QA_PEGASUS_TOKEN`. They only work on `api.pegasusgateway.com` with the `Authenticate` header.

### Legacy Zapier note

The Zapier dossier used **`https://qservices.pegasusgateway.com`** with **`Authorization: Basic …`**. This app uses **Bearer** on the **QA dev2 host** (`dev2.pegasusgateway.com`), obtained via `POST https://auth.pegasusgateway.com/` with gateway **`dev2.pegasusgateway.com`**. Do not paste Pegasus1 tokens into `QA_PEGASUS_TOKEN`.

## Refresh all QA tokens (recommended)

```bash
export PEGASUS_AUTH_USERNAME='your@email'
export PEGASUS_AUTH_PASSWORD='your-password'
npm run pegasus:fetch-tokens
```

This calls `POST https://auth.pegasusgateway.com/` and writes **`.env.local`** (gitignored) with:

- `QA_PEGASUS1_TOKEN` (gateway `cloud.pegasusgateway.com`)
- `QA_PEGASUS256_TOKEN` (gateway `qconnect.qualitas.com.mx`)
- `QA_PEGASUS_BASE_URL=https://dev2.pegasusgateway.com`
- `QA_PEGASUS_TOKEN` (gateway `dev2.pegasusgateway.com` unless overridden)

Override the qservices auth gateway only if your tenant uses a different name:

```bash
export PEGASUS_AUTH_GATEWAY_QSERVICES='dev2.pegasusgateway.com'
npm run pegasus:fetch-tokens
```

Load tokens before starting the server:

```bash
set -a && source .env.local && set +a && npm start
```

### Verify qservices auth (optional)

```bash
set -a && source .env.local && set +a
node scripts/probe-qservices-auth.js
```

Prints **HTTP status codes only** (no token values). Expect **200** on `dev2` when `QA_PEGASUS_TOKEN` is valid.

## Manual curl (qservices / QA)

```bash
curl -s -X POST 'https://auth.pegasusgateway.com/' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "YOUR_EMAIL",
    "password": "YOUR_PASSWORD",
    "gateway": "dev2.pegasusgateway.com",
    "scheme": "infinite"
  }'
```

Use the JSON field **`auth`** as `QA_PEGASUS_TOKEN`. Set:

```bash
QA_PEGASUS_BASE_URL=https://dev2.pegasusgateway.com
```

Test upstream (replace `YOUR_AUTH` with the `auth` value):

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer YOUR_AUTH" \
  'https://dev2.pegasusgateway.com/installations/api/v1/installation'
```

## Manual curl (Pegasus1)

```bash
curl -X POST 'https://auth.pegasusgateway.com/' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "YOUR_EMAIL",
    "password": "YOUR_PASSWORD",
    "gateway": "cloud.pegasusgateway.com",
    "scheme": "infinite"
  }'
```

Use **`auth`** as `QA_PEGASUS1_TOKEN`.

## Manual curl (Pegasus256)

Same request, but set:

```json
"gateway": "qconnect.qualitas.com.mx"
```

Use **`auth`** as `QA_PEGASUS256_TOKEN`.

## API routing note

`pegasus-client.js` uses **`pegasus1Token` first** for `api.pegasusgateway.com` routes (device verify, groups, vehicles). IMEI/SIM lookup works when only `QA_PEGASUS1_TOKEN` / `QA_PEGASUS256_TOKEN` are set.

**Installation search** (`GET /api/search-installations`) calls `pegasus.qservicesGet` with **Bearer** + `pegasusBaseUrl` + path `/installations/api/v1/installation`.

Diagnostics (no secrets): **`GET /api/health/credentials`** and **`GET /api/health/pegasus`** (live probe when token is set).

## Security

- Never commit passwords or tokens.
- Rotate credentials if they were shared in chat or logs.
- Do not pass passwords as CLI arguments (shell history).
- `npm run pegasus:fetch-tokens` and probe scripts never log token values.
