const express = require("express");
const crypto = require("crypto");
const store = require("./store");
const { problem } = require("./errors");
const { invokeProvider, recordAudit } = require("./providerClient");
const { mountCrudRoutes } = require("./routes");
const { mountRouteAndInvoke } = require("./routeInvoke");

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.locals.traceId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.setHeader("X-Trace-Id", res.locals.traceId);
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

mountCrudRoutes(app, store, authed, problem);
mountRouteAndInvoke(app, store, authed, problem, invokeProvider, recordAudit);

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 8002;
  app.listen(PORT, () => console.log(`Model & Provider service running on ${PORT}`));
}


