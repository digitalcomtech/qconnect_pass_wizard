#!/usr/bin/env node
/**
 * Compares Express routes in server.js vs /api/ references in public HTML/JS.
 * Flags likely orphaned backend routes and frontend calls with no matching route.
 *
 * Usage: node scripts/audit-routes.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "server.js");
const ROUTES_DIR = path.join(ROOT, "routes");
const PUBLIC = path.join(ROOT, "public");

/** How each routes/*.js file is mounted in server.js (for audit path joining). */
const ROUTE_MODULE_MOUNT = {
  "auth.js": "/api/auth",
  "system.js": "/api",
  "pegasus-read.js": "/api",
  "activity.js": "/api",
};

function readAllPublicFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) readAllPublicFiles(p, acc);
    else if (/\.(html|js)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

function extractExpressRoutes(source) {
  const routes = [];
  const re = /app\.(get|post|put|delete|patch)\(\s*["'`]([^"'`]+)["'`]/gi;
  let m;
  while ((m = re.exec(source))) {
    routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  const useRe = /app\.use\(\s*["'`](\/[^"'`]+)["'`]/gi;
  while ((m = useRe.exec(source))) {
    routes.push({ method: "USE", path: m[1] });
  }
  return routes;
}

function joinMount(mountBase, routePath) {
  const base = mountBase.replace(/\/$/, "");
  const sub = routePath.startsWith("/") ? routePath : `/${routePath}`;
  if (!base) return sub;
  return base + sub;
}

/** `router.get("/foo"` or `router.get(\n  "/foo"` style handlers in route modules. */
function extractRouterRoutes(source, mountBase) {
  const routes = [];
  const re =
    /router\.(get|post|put|delete|patch)\([\s\n]*["'`]([^"'`]+)["'`]/gi;
  let m;
  while ((m = re.exec(source))) {
    routes.push({
      method: m[1].toUpperCase(),
      path: joinMount(mountBase, m[2]),
    });
  }
  return routes;
}

function extractRoutesFromRouteModules() {
  const out = [];
  if (!fs.existsSync(ROUTES_DIR)) return out;
  for (const name of fs.readdirSync(ROUTES_DIR)) {
    if (!name.endsWith(".js")) continue;
    const mountBase = ROUTE_MODULE_MOUNT[name];
    const full = path.join(ROUTES_DIR, name);
    const src = fs.readFileSync(full, "utf8");
    out.push(...extractExpressRoutes(src));
    if (mountBase) out.push(...extractRouterRoutes(src, mountBase));
  }
  return out;
}

function collectFrontendApiPaths(text) {
  const out = new Set();

  const add = (p) => {
    if (!p || !p.startsWith("/api")) return;
    const noQuery = p.split("?")[0].trim();
    if (noQuery.length < 4) return;
    out.add(noQuery);
  };

  let m;
  const re1 = /\bfetch\(\s*["'](\/api\/[^'"]+)["']/g;
  while ((m = re1.exec(text))) add(m[1]);

  const re2 = /\bfetch\(\s*`(\/api\/[^`$?]+)/g;
  while ((m = re2.exec(text))) add(m[1]);

  const re3 = /`(\/api\/[^`$?]+)\$\{/g;
  while ((m = re3.exec(text))) add(m[1]);

  const re4 = /testEndpoint\(\s*["'](\/api\/[^'"]+)["']/g;
  while ((m = re4.exec(text))) add(m[1]);

  const re5 = /\$\{this\.apiBaseUrl\}\/([^`$"']+)/g;
  while ((m = re5.exec(text))) add("/api/" + m[1].split("?")[0].replace(/\/+$/, ""));

  return out;
}

/** Static prefix for a route (strip Express :params segment). */
function routeStaticPrefix(routePath) {
  const idx = routePath.indexOf(":");
  if (idx === -1) return routePath;
  return routePath.slice(0, idx).replace(/\/$/, "") || routePath;
}

function frontendUsesRoute(routePath, frontendPaths) {
  if (routePath === "/healthz") {
    for (const f of frontendPaths) {
      if (f.includes("healthz")) return true;
    }
    return false;
  }

  const exact = routePath.indexOf(":") === -1;
  const prefix = routeStaticPrefix(routePath);

  for (const f of frontendPaths) {
    if (exact && f === routePath) return true;
    if (!exact && (f === routePath || f.startsWith(prefix + "/"))) return true;
  }
  return false;
}

function routeMatchesFrontendPath(routeDefs, frontPath) {
  for (const r of routeDefs) {
    const p = r.path;
    if (p.indexOf(":") === -1) {
      if (p === frontPath) return true;
    } else {
      const pre = routeStaticPrefix(p);
      if (frontPath === p) return true;
      if (frontPath.startsWith(pre + "/")) return true;
    }
  }
  return false;
}

const serverSrc = fs.readFileSync(SERVER, "utf8");
const routes = [
  ...extractExpressRoutes(serverSrc),
  ...extractRoutesFromRouteModules(),
];

const files = readAllPublicFiles(PUBLIC);
const frontendPaths = new Set();
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const p of collectFrontendApiPaths(text)) {
    frontendPaths.add(p);
  }
}

const backendApiAndHealth = routes.filter(
  (r) => r.path.startsWith("/api") || r.path === "/healthz"
);

// `app.use` mounts are not HTTP verbs the UI calls; skip for drift analysis.
const backendForAudit = backendApiAndHealth.filter((r) => r.method !== "USE");

const notInFrontend = backendForAudit.filter(
  (r) => !frontendUsesRoute(r.path, frontendPaths)
);

/** Common Express paths not invoked from static `fetch()` in public/ (smoke tests, probes, or alternate flows). */
const oftenBackendOnlyPaths = new Set([
  "/healthz",
  "/api/health/pegasus",
  "/api/health/credentials",
  "/api/secondary-install",
  "/api/installation-status/:installationId",
  "/api/activity/session/:sessionId",
]);

const expectedOps = notInFrontend.filter((r) => oftenBackendOnlyPaths.has(r.path));
const suspiciousOrphan = notInFrontend.filter((r) => !oftenBackendOnlyPaths.has(r.path));

const frontendOnly = [...frontendPaths].filter(
  (fp) => !routeMatchesFrontendPath(backendForAudit, fp)
);

console.log("--- audit-routes ---");
console.log("Express routes (api + healthz, excluding USE mounts):", backendForAudit.length);
console.log("Unique /api… paths seen in public/:", frontendPaths.size);
console.log("");

console.log("Backend routes with no public/ fetch match (often expected):");
if (expectedOps.length === 0) console.log("  (none)");
else
  expectedOps.forEach((r) =>
    console.log(`  ${r.method.padEnd(6)} ${r.path}`)
  );

console.log("");
console.log("Backend routes with no public/ match — review if unexpected:");
if (suspiciousOrphan.length === 0) console.log("  (none)");
else
  suspiciousOrphan.forEach((r) =>
    console.log(`  ${r.method.padEnd(6)} ${r.path}`)
  );

console.log("");
console.log("Frontend /api paths with NO matching Express route (check typos / stale UI):");
if (frontendOnly.length === 0) console.log("  (none)");
else frontendOnly.sort().forEach((p) => console.log(" ", p));

console.log("");
console.log(
  "Note: Express `app.use` mounts are excluded above. `POST /api/install` is the wizard path for primary + secondary devices."
);
process.exit(0);
