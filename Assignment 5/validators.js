const VALID_PROVIDER_TYPES = ["openai", "gemini", "local", "custom"];
const VALID_SENSITIVITY = ["public", "internal", "confidential", "restricted"];
const VALID_DECISIONS = ["ALLOW", "MASK", "ROUTE"];
const VALID_ROLES = ["system", "user", "assistant"];

function validateProvider(body) {
  const errors = [];
  if (!body || typeof body !== "object") return [["body", "must be a JSON object"]];
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) errors.push(["name", "required non-empty string"]);
  if (!body.type || !VALID_PROVIDER_TYPES.includes(body.type)) errors.push(["type", "must be one of openai, gemini, local, custom"]);
  if (body.endpoint !== undefined && (typeof body.endpoint !== "string" || !/^https?:\/\/.+/.test(body.endpoint))) {
    errors.push(["endpoint", "must be a valid http(s) URI"]);
  }
  if (body.timeoutMs !== undefined && (!Number.isInteger(body.timeoutMs) || body.timeoutMs < 1)) {
    errors.push(["timeoutMs", "must be a positive integer"]);
  }
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") errors.push(["enabled", "must be boolean"]);
  return errors;
}

function validateModel(body) {
  const errors = [];
  if (!body || typeof body !== "object") return [["body", "must be a JSON object"]];
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) errors.push(["name", "required non-empty string"]);
  if (!Array.isArray(body.capabilities) || body.capabilities.length < 1) {
    errors.push(["capabilities", "must be a non-empty array of strings"]);
  }
  if (!VALID_SENSITIVITY.includes(body.sensitivityLevel)) errors.push(["sensitivityLevel", "must be one of public, internal, confidential, restricted"]);
  if (body.costInformation !== undefined) {
    const c = body.costInformation;
    if (typeof c !== "object" || c === null) errors.push(["costInformation", "must be an object"]);
    else {
      for (const k of ["inputCostPer1KTokens", "outputCostPer1KTokens"]) {
        if (c[k] !== undefined && (typeof c[k] !== "number" || c[k] < 0)) errors.push([`costInformation.${k}`, "must be a number >= 0"]);
      }
    }
  }
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") errors.push(["enabled", "must be boolean"]);
  return errors;
}

function validateRoute(body) {
  const errors = [];
  if (!body || typeof body !== "object") return [["body", "must be a JSON object"]];
  const r = body.request;
  if (!r || typeof r !== "object") errors.push(["request", "required object"]);
  else if (!Array.isArray(r.messages) || r.messages.length < 1) {
    errors.push(["request.messages", "must be a non-empty array"]);
  } else {
    r.messages.forEach((m, i) => {
      if (!m || typeof m !== "object" || !VALID_ROLES.includes(m.role) || typeof m.content !== "string" || !m.content.trim()) {
        errors.push([`request.messages[${i}]`, "each message needs a valid role and non-empty content"]);
      }
    });
  }
  if (!VALID_DECISIONS.includes(body.policyDecision)) errors.push(["policyDecision", "must be one of ALLOW, MASK, ROUTE"]);
  if (body.modelPreference !== undefined && body.modelPreference !== null && typeof body.modelPreference !== "string") {
    errors.push(["modelPreference", "must be a string or null"]);
  }
  return errors;
}

module.exports = { validateProvider, validateModel, validateRoute, VALID_PROVIDER_TYPES, VALID_SENSITIVITY, VALID_DECISIONS, VALID_ROLES };
