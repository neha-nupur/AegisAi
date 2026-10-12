const { validateProvider, validateModel, VALID_SENSITIVITY } = require("./validators");

function mountCrudRoutes(app, store, authed, problem) {
app.post("/v1/providers", authed, (req, res) => {
  const errs = validateProvider(req.body);
  if (errs.length > 0) return problem(res, 400, "invalid-request", "Provider configuration is invalid", errs);
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
  if (errs.length > 0) return problem(res, 400, "invalid-request", "Model registration is invalid", errs);
  const key = req.headers["idempotency-key"];
  if (key) {
    const prior = store.findModelByKey(provider.id, key);
    if (prior) return res.status(200).json({ modelId: prior.id, providerId: provider.id, name: prior.name });
  }
  const m = store.createModel(provider, req.body, key || null);
  res.setHeader("Location", `/v1/providers/${provider.id}/models/${m.id}`);
  return res.status(201).json({ modelId: m.id, providerId: provider.id, name: m.name });
});

app.get("/v1/models", authed, (req, res) => {
  const { capability, sensitivityLevel } = req.query;
  if (sensitivityLevel !== undefined && !VALID_SENSITIVITY.includes(sensitivityLevel)) {
    return problem(res, 400, "invalid-request", "Invalid sensitivityLevel filter", [["sensitivityLevel", "must be valid"]]);
  }
  const items = store.listModels(req.orgId, { capability, sensitivityLevel });
  return res.status(200).json({ models: items.map((m) => m.asJson()) });
});

app.get("/v1/providers/:providerId/models/:modelId", authed, (req, res) => {
  const provider = store.findProvider(req.params.providerId);
  if (!provider || provider.orgId !== req.orgId) {
    return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
  }
  const m = store.findModel(req.params.modelId);
  if (!m || m.providerId !== provider.id) {
    return problem(res, 404, "model-not-found", `No model ${req.params.modelId}`);
  }
  return res.status(200).json(m.asJson());
});

app.get("/v1/providers/:providerId/health", authed, (req, res) => {
  const provider = store.findProvider(req.params.providerId);
  if (!provider || provider.orgId !== req.orgId) {
    return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
  }
  store.circuitAllows(provider);
  return res.status(200).json(provider.asHealth());
});
}

module.exports = { mountCrudRoutes };
