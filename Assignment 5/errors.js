const TITLES = {
  "invalid-request": "Invalid request",
  "invalid-filter": "Invalid filter",
  "unauthenticated": "Not authenticated",
  "not-authorised": "Not authorised",
  "provider-not-found": "Provider not found",
  "model-not-found": "Model not found",
  "provider-conflict": "Provider already registered",
  "precondition-failed": "Precondition failed",
  "no-model-available": "No model available",
  "provider-unavailable": "Provider unavailable",
  "provider-timeout": "Provider timeout",
  "circuit-open": "Provider circuit is open",
  "rate-limit-exceeded": "Rate limit exceeded",
  "not-acceptable": "Not acceptable",
  "internal-error": "Internal server error"
};

// Single error shape everywhere (Assignments 4/5/6).
// A6 serves it as application/problem+json; A5 as application/json.
function problem(res, status, code, detail = "", errors = null, traceId = null) {
  const body = {
    type: `/errors/${code}`,
    title: TITLES[code] || code,
    status,
    detail: detail || TITLES[code] || code
  };
  if (errors) body.errors = errors;
  if (traceId) body.traceId = traceId;
  else if (res.locals && res.locals.traceId) body.traceId = res.locals.traceId;
  return res.status(status).json(body);
}

module.exports = { problem, TITLES };
