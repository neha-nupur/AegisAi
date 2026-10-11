const express = require("express");
const compression = require("compression");
const crypto = require("crypto");
const store = require("./store");
const { problem } = require("./errors");
const { invokeProvider, recordAudit } = require("./providerClient");
const { mountCrudRoutes, etagFor } = require("./routes");
const { mountExtraRoutes } = require("./routesExtra");
const { mountProviderRoutes } = require("./routesProvider");
const { mountRouteAndInvoke } = require("./routeInvoke");

const app = express();
app.disable("x-powered-by");
app.use(compression({ threshold: 1024 })); // B1: gzip large JSON
app.use(express.json());

// ---- A5 preflight / B6 CORS + B5 rate-limit signalling + B7 security headers ----
const RATE_LIMIT = 100;
const _buckets = new Map(); // client -> { remaining, resetAt }

function rateLimiter(req, res, next) {
  const client = `${req.ip}|${req.headers.authorization || "anon"}`;
  const now = Date.now();
  let b = _buckets.get(client);
  if (!b || now >= b.resetAt) {
    b = { remaining: RATE_LIMIT, resetAt: now + 60000 };
    _buckets.set(client, b);
  }
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  if (b.remaining <= 0) {
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader("Retry-After", Math.max(1, Math.ceil((b.resetAt - now) / 1000)));
    return problem(res, 429, "rate-limit-exceeded", "Too many requests");
  }
  b.remaining -= 1;
  res.setHeader("X-RateLimit-Remaining", b.remaining);
  next();
}

// CORS preflight answered before auth (browser sends OPTIONS bare).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Idempotency-Key, If-None-Match, If-Match, X-Organization-Id, X-HTTP-Method-Override");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Location, ETag, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After, Allow, X-Trace-Id");
  if (req.method === "OPTIONS") {
    const allow = allowFor(req.path);
    if (allow) res.setHeader("Allow", allow);
    return res.status(204).send();
  }
  next();
});

function allowFor(path) {
  if (path === "/v1/providers") return "GET, POST, PATCH, DELETE, OPTIONS";
  if (path === "/v1/models" || path === "/v1/route-and-invoke") return "GET, POST, OPTIONS";
  if (/^\/v1\/providers\/[^/]+\/models$/.test(path)) return "POST, OPTIONS";
  if (/^\/v1\/providers\/[^/]+$/.test(path)) return "GET, PATCH, DELETE, OPTIONS";
  if (/^\/v1\/providers\/[^/]+\/models\/[^/]+$/.test(path)) return "GET, OPTIONS";
  if (/^\/v1\/providers\/[^/]+\/health$/.test(path)) return "GET, OPTIONS";
  return null;
}

app.use(rateLimiter);

app.use((req, res, next) => {
  res.locals.traceId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.setHeader("X-Trace-Id", res.locals.traceId);
  // B7 security & general headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// B1 content negotiation: JSON only; 406 otherwise.
app.use((req, res, next) => {
  const accept = req.headers.accept;
  if (accept && !accept.includes("application/json") && !accept.includes("*/*")) {
    return problem(res, 406, "not-acceptable", "Only application/json is supported");
  }
  next();
});

function requireBearer(req, res, next) {
  const a = req.headers.authorization;
  if (!a || !a.startsWith("Bearer ") || !a.slice(7).trim()) {
    return problem(res, 401, "unauthenticated", "Bearer token required");
  }
  next();
}

function requireOrg(req, res, next) {
  const org = req.headers["x-organization-id"];
  if (!org || !String(org).trim()) {
    return problem(res, 400, "invalid-request", "X-Organization-Id required", [["X-Organization-Id", "required header"]]);
  }
  req.orgId = String(org);
  next();
}
const authed = [requireBearer, requireOrg];

function effectiveMethod(req) {
  const ov = req.headers["x-http-method-override"];
  if (req.method === "POST" && ov && ["PATCH", "DELETE"].includes(String(ov).toUpperCase())) {
    return String(ov).toUpperCase();
  }
  return req.method;
}

mountCrudRoutes(app, store, authed, problem);
mountExtraRoutes(app, store, authed, problem, etagFor);
mountProviderRoutes(app, store, authed, problem, etagFor, effectiveMethod);
mountRouteAndInvoke(app, store, authed, problem, invokeProvider, recordAudit);

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 8002;
  app.listen(PORT, () => console.log(`A5 Model & Provider service running on ${PORT}`));
}
