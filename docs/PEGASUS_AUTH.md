# Pegasus authentication tokens

The installer app uses **three** Pegasus credentials for QA or production (see `env.example`).

| Env var | Used for | How to obtain |
|---------|----------|----------------|
| `QA_PEGASUS1_TOKEN` | `Authenticate` on `api.pegasusgateway.com` — devices, groups, vehicles, SIM (Pegasus1) | Auth gateway `cloud.pegasusgateway.com` |
| `QA_PEGASUS256_TOKEN` | `Authenticate` on SIM APIs (Pegasus256 / migrated) | Auth gateway `qconnect.qualitas.com.mx` |
| `QA_PEGASUS_TOKEN` | **Bearer** on `QA_PEGASUS_BASE_URL` — installation search, confirm | Auth gateway **`dev2.pegasusgateway.com`** |

## QA qservices: two hosts

| Role | Host |
|------|------|
| **Auth gateway** (get `QA_PEGASUS_TOKEN`) | `dev2.pegasusgateway.com` via `POST https://auth.pegasusgateway.com/` |
| **Installations JSON API** (search, duplicate check, confirm) | **`https://qservices.pegasusgateway.com/qa`** |

`dev2.pegasusgateway.com` alone redirects `/installations/...` to `/v2/` (HTML SPA). Do **not** set `QA_PEGASUS_BASE_URL` to the dev2 root.

Default:

```bash
QA_PEGASUS_BASE_URL=https://qservices.pegasusgateway.com/qa
```

Installation path (unchanged): `GET /installations/api/v1/installation`

## Why search fails (401, 503, 500, or HTML)

| Symptom | Cause |
|---------|--------|
| **503** `qservices_token_missing` | `QA_PEGASUS_TOKEN` is empty. |
| **401** from Pegasus | Bearer missing, expired, or Pegasus1/256 token used by mistake. |
| **502** `upstream_non_json_response` or `upstream_redirect` | Wrong `QA_PEGASUS_BASE_URL` (e.g. `https://dev2.pegasusgateway.com`) — HTML from `/v2/` instead of JSON. |
| **500** invalid JSON parse (older builds) | Same as above; follow redirects to HTML. Fixed by correct base URL + defensive parsing. |

`QA_PEGASUS1_TOKEN` / `QA_PEGASUS256_TOKEN` are **not** valid qservices Bearer tokens.

### Legacy Zapier note

Zapier used **`https://qservices.pegasusgateway.com`** with **Basic** auth. This app uses **Bearer** on **`qservices.pegasusgateway.com/qa`** with a token from gateway **`dev2.pegasusgateway.com`**.

## Refresh all QA tokens (recommended)

```bash
export PEGASUS_AUTH_USERNAME='your@email'
export PEGASUS_AUTH_PASSWORD='your-password'
npm run pegasus:fetch-tokens
```

Writes **`.env.local`** with Pegasus1/256 tokens, `QA_PEGASUS_TOKEN`, and:

```bash
QA_PEGASUS_BASE_URL=https://qservices.pegasusgateway.com/qa
```

Load before start:

```bash
set -a && source .env.local && set +a && npm start
```

### Verify (optional)

```bash
set -a && source .env.local && set +a
npm run pegasus:probe-qservices
```

Expect **200** `application/json` on `qservices.pegasusgateway.com/qa/installations/api/v1/installation`.

## Manual curl (qservices / QA)

Token:

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

Use JSON **`auth`** as `QA_PEGASUS_TOKEN`. Test installations API:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer YOUR_AUTH" \
  'https://qservices.pegasusgateway.com/qa/installations/api/v1/installation'
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

Same request with `"gateway": "qconnect.qualitas.com.mx"`. Use **`auth`** as `QA_PEGASUS256_TOKEN`.

## API routing note

- **`api.pegasusgateway.com`**: `Authenticate` + `pegasus1Token` / `pegasus256Token`
- **qservices**: `Bearer` + `pegasusBaseUrl` + `/installations/api/v1/...`

Logs include sanitized upstream URLs: `[Pegasus] qservices request {"context":"search-installations","upstream":"https://qservices.pegasusgateway.com/qa/installations/api/v1/installation"}`

## Security

- Never commit passwords or tokens.
- Do not pass passwords on the CLI (shell history).
