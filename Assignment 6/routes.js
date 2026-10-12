const crypto = require("crypto");
const { validateProvider, validateModel } = require("./validators");

function etagFor(obj) {
  return `"mp-${crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex").slice(0, 16)}"`;
}

function mountCrudRoutes(app, store, authed, problem) {
  function effectiveMethod(req) {
    const ov = req.headers["x-http-method-override"];
    if (req.method === "POST" && ov && ["PATCH", "DELETE"].includes(String(ov).toUpperCase())) {
      return String(ov).toUpperCase();
    }
    return req.method;
  }

  app.post("/v1/providers", authed, (req, res) => {
    const errs = validateProvider(req.body);
    if (errs.length > 0) return problem(res, 422, "invalid-request", "Provider configuration is invalid", errs);
    const key = req.headers["idempotency-key"];
    if (key) {
      const prior = store.findProviderByKey(req.orgId, key);
      if (prior) return res.status(200).json({ providerId: prior.id, name: prior.name, status: "registered" });
    }
    const dup = store.findProviderByName(req.orgId, req.body.name);
    if (dup) return problem(res, 409, "provider-conflict", `Provider '${req.body.name}' is already registered`);
    const p = store.createProvider(req.body, req.orgId, key || null);
    res.setHeader("Location", `/v1/providers/${p.id}`);
    return res.status(201).json({ providerId: p.id, name: p.name, status: "registered" });
  });

  app.post("/v1/providers/:providerId/models", authed, (req, res) => {
    const provider = store.findProvider(req.params.providerId);
    if (!provider || provider.orgId !== req.orgId) {
      return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
    }
    const errs = validateModel(req.body);
    if (errs.length > 0) return problem(res, 422, "invalid-request", "Model registration is invalid", errs);
    const key = req.headers["idempotency-key"];
    if (key) {
      const prior = store.findModelByKey(provider.id, key);
      if (prior) return res.status(200).json({ modelId: prior.id, providerId: provider.id, name: prior.name });
    }
    const m = store.createModel(provider, req.body, key || null);
    res.setHeader("Location", `/v1/providers/${provider.id}/models/${m.id}`);
    return res.status(201).json({ modelId: m.id, providerId: provider.id, name: m.name });
  });
}

module.exports = { mountCrudRoutes, etagFor };
