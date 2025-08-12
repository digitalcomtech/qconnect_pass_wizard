QConnect PASS Wizard — Developer Usage Guide (Draft v0.1)

Audience: Senior/advanced developers who will formalize and harden this tool.
Scope: Quick Start • Onboarding • End‑User Guide • Technical Reference.

⸻

1) What this project does (high level)

A small Node/Express proxy + single‑page wizard that helps an installer:
	1.	Search/select a client/VIN from Pegasus installations.
	2.	Enter IMEI/SIM (optionally a secondary unit).
	3.	Post data to a Zapier Catch Hook.
	4.	Poll device reporting status via Pegasus.
	5.	If the unit is reporting and the installer is physically near the last known device location, open a prefilled JotForm for closing paperwork.

Files present

root
├─ server.js         # Express API proxy to Zapier & Pegasus
└─ index.html        # SPA wizard (vanilla JS) served from /public (see note)

⚠️ Repo hygiene note: index.html expects to be served as a static asset; place it (and any assets) under a /public folder so express.static("public") can serve it. Move index.html to public/index.html.

⸻

2) Architecture & data flow
	•	Browser (index.html)
	•	Fetches installations list (currently calls https://qservices.pegasusgateway.com/installations/api/v1/installation from the browser with a Bearer token — must be moved behind server).
	•	Posts IMEI/SIM (and optional secondary IMEI) to POST /api/install on the same origin.
	•	Polls GET /api/device-status?imei=... until latest.loc.valid is truthy.
	•	Performs geofence proximity check (≈200 m) vs device location, then opens prefilled form.
	•	Server (server.js)
	•	POST /api/install → Zapier forwarder.
	•	POST /api/secondary-install → Zapier forwarder (endpoint constant missing—TODO).
	•	GET /api/device-status → Pegasus device lookup.

Sequence (happy path)
	1.	User searches/selects VIN → session state is stored (SessionStorage).
	2.	User enters IMEI/SIM → POST /api/install → Zapier hook.
	3.	UI polls /api/device-status (5s cadence) → sees latest.loc.valid.
	4.	UI compares user geolocation vs device latest.loc.{lat,lon} → if <200 m, open JotForm prefilled URL and show success.

⸻

3) Security & compliance (immediate concerns)
	•	Hard‑coded tokens in frontend & server:
	•	index.html uses Authorization: Bearer <token> directly in browser.
	•	server.js uses headers: { "Authenticate": "<token>" } (likely wrong header key).
	•	Action: Move all secrets to .env and proxy Pegasus calls via the server. Never expose tokens to the browser.
	•	CORS/HTTPS: Ensure HTTPS everywhere in production; restrict origins if you later expose CORS.
	•	PII: Names, VINs, and emails are handled—treat logs as sensitive, mask where possible.
	•	Rate limiting: Add minimal throttling on /api/* (e.g., express-rate-limit).
	•	Input validation: Enforce IMEI/SIM/ VIN formats server‑side; reject malformed input.

⸻

4) Configuration (.env)

Create a .env file at repo root:

PORT=8080
TEST_MODE=false

# Zapier
ZAPIER_HOOK_INSTALL=https://hooks.zapier.com/hooks/catch/xxxx/yyyy/
ZAPIER_HOOK_SECONDARY=https://hooks.zapier.com/hooks/catch/xxxx/zzzz/

# Pegasus
PEGASUS_BASE_URL=https://api.pegasusgateway.com
PEGASUS_TOKEN=REDACTED
PEGASUS_INSTALLATIONS_URL=https://qservices.pegasusgateway.com/installations/api/v1/installation
PEGASUS_TOKEN_TYPE=Bearer  # or leave blank if Pegasus uses a custom header
PEGASUS_AUTH_HEADER=Authorization  # or Authenticate if truly required by that endpoint

# Forms
CLOSING_FORM_BASE=https://forms.fleetmetriks.com/232204864076960
PROXIMITY_METERS=200
POLL_INTERVAL_MS=5000
POLL_MAX_ATTEMPTS=60

Update server.js and index.html to read env‑driven values (see TODOs).

⸻

5) Quick Start (local dev)

# 1) Install deps
npm init -y                      # if package.json not present
npm i express node-fetch@2 dotenv

# 2) Project layout (recommended)
mkdir -p public && mv index.html public/

# 3) Configure env
cp .env.example .env             # if you create one; otherwise create as above

# 4) Run
node server.js                   # or: nodemon server.js
# Server at http://localhost:8080

Open http://localhost:8080 → follow the wizard.

⸻

6) End‑User walkthrough (installers)
	1.	Step 1: Type client name or VIN start → click Load VINs.
	2.	Step 2: Pick a booked VIN from the list → Next.
	3.	Step 3: Enter IMEI, SIM, (optional secondary IMEI). Confirm values.
	•	You may Bypass Location Check for testing.
	•	Test Location Override lets you enter coordinates for dry‑runs.
	4.	After sending IMEI/SIM, the app waits for the device to report. If success and within 200 m, you’ll be redirected to the closing form with prefilled info.

Common messages:
	•	↻ Fetching all installations… — loading Pegasus data
	•	⏳ Waiting for device to report… — polling every 5s up to 5 min
	•	✅ You are close to the device… — geofence passed; form will open
	•	❌ You are too far… — outside of 200 m radius

⸻

7) API reference (server)

POST /api/install

Forwards IMEI/SIM payload to Zapier.
	•	Body (JSON)

{
  "client_name": "John Doe",
  "imei": "123456789012345",
  "sim_number": "8901…",
  "vin": "1FA…",
  "installationId": "...",
  "secondary_imei": "optional"
}

	•	Responses: Pass‑through of Zapier JSON on success; {success:false, message} on error.

POST /api/secondary-install

Like /api/install but for secondary units.

⚠️ Note: server.js references ZAPIER_HOOK_SECONDARY but does not define it. Add env + wiring.

GET /api/device-status?imei=…

Fetches device from Pegasus and returns a simplified status.
	•	Query params: imei (required), since (optional; currently unused)
	•	Response

{
  "isReporting": true,
  "latest": { "loc": { "lat": 19.43, "lon": -99.13, "valid": true }, ... }
}

Header mismatch: Code uses Authenticate: <token> for Pegasus, while the SPA uses Authorization: Bearer <token>. Unify to one scheme.

⸻

8) Frontend contract (index.html)

SessionStorage keys
	•	step → “1” | “2” | “3” | “waitingForDevice” | “done”
	•	clientName → free‑text input from Step 1
	•	filteredInst → array of filtered installations (Pegasus payload)
	•	selectedVIN → chosen VIN
	•	installationId → chosen installation _id
	•	selectedInstallation → full installation object (used for form prefill)
	•	selectedClientFullName → person name to show in UI / send to Zapier

Proximity check
	•	Threshold: 200 meters (computed by Haversine).
	•	Sources: Browser geolocation (navigator.geolocation) vs latest.loc from Pegasus.
	•	Testing: Optional “Test Location Override” to inject coordinates.

Prefilled closing form

openPrefilledForm() builds a URLSearchParams map from the selected installation to CLOSING_FORM_BASE.
Keep mapping updated when Pegasus fields change.

⸻

9) Error handling & UX messages
	•	Installations fetch: If 404/500 → show ❌ No installations found with the query echoed.
	•	POST /api/install: If non‑200 from Zapier → bubble status + text.
	•	Polling: Stop after POLL_MAX_ATTEMPTS → show ❌ Timed out waiting for device to report.
	•	Geolocation: Handle permission denied / unavailable → show reason and keep user on Step 3.

⸻

10) Local testing & cURL

Start install (simulated)

curl -X POST http://localhost:8080/api/install \
  -H 'Content-Type: application/json' \
  -d '{
    "client_name":"Test Client",
    "imei":"123456789012345",
    "sim_number":"8901",
    "vin":"TESTVIN123",
    "installationId":"abc123"
  }'

Device status

curl 'http://localhost:8080/api/device-status?imei=123456789012345'


⸻

11) Deployment notes
	•	Node 18+ recommended (native fetch if upgrading code to v3; currently uses node-fetch@2).
	•	Serve behind a reverse proxy (nginx) with HTTPS; set appropriate timeouts for long polling.
	•	Environment variables only; no tokens in code or HTML.
	•	Consider PM2 or systemd for process supervision.

⸻

12) TODOs for the formalization pass
	1.	Move Pegasus installations fetch to server (GET /api/installations) and strip PII as needed.
	2.	Replace all hard‑coded URLs/tokens with .env (see §4) and wire with dotenv.
	3.	Unify auth header for Pegasus (likely Authorization: Bearer <token>).
	4.	Implement ZAPIER_HOOK_SECONDARY path and expose in .env.
	5.	Add schema validation (e.g., zod/joi) for /api/install & /api/secondary-install payloads.
	6.	Add rate limiting and request logging (morgan/pino).
	7.	Extract shared Haversine code to a small util module on the client only; remove dead client‑side functions from server.js.
	8.	Introduce feature flags (TEST_MODE, proximity radius, poll frequency) pulling from env.
	9.	Unit tests for proximity logic and API Routes; smoke tests for Pegasus & Zapier integrations.
	10.	Add a /health endpoint and basic CI (lint + test).
	11.	Add error codes/documentation matrix for installer support.

⸻

13) Known quirks / risks (current code)
	•	server.js defines browser‑only functions at bottom (haversineDistance, checkProximityToDevice) that reference sessionStorage/alert. They are unused in Node context; remove or guard behind if (process.env.NODE_ENV === 'test') {} etc.
	•	index.html includes a debug panel call (debugPrint) that writes to #debugOutput, but no such element exists; either add it or remove calls.
	•	since query param is accepted by /api/device-status but unused.

⸻

14) Developer onboarding (first day checklist)
	•	Read §3 Security & move tokens to .env.
	•	Move index.html into /public and verify static serving.
	•	Implement /api/installations on server; make SPA call same‑origin.
	•	Validate payloads; add minimal logging & rate limiting.
	•	Run E2E dry‑run using Test Location Override.
	•	Document your environment and secrets rotation policy.

⸻

15) License & ownership

Add your internal license/ownership statement here.

⸻

16) Changelog
	•	v0.1 — Initial draft based on two files (server.js, index.html) uploaded on Aug 12, 2025.
