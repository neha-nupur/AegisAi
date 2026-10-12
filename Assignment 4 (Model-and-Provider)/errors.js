const TITLES = {
  "invalid-request": "Invalid request",
  "unauthenticated": "Not authenticated",
  "not-authorised": "Not authorised",
  "provider-not-found": "Provider not found",
  "model-not-found": "Model not found",
  "provider-conflict": "Provider already registered",
  "no-model-available": "No model available",
  "provider-unavailable": "Provider unavailable",
  "provider-timeout": "Provider timeout",
  "circuit-open": "Provider circuit is open",
  "policy-blocked": "Request blocked by policy",
  "internal-error": "Internal server error"
};

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
