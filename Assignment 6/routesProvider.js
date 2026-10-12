function providerBody(p) {
  return { providerId: p.id, name: p.name, type: p.type, status: p.enabled ? "registered" : "disabled", createdAt: p.createdAt };
}

function mountProviderRoutes(app, store, authed, problem, etagFor, effectiveMethod) {
  function singleProvider(req, res) {
    const p = store.findProvider(req.params.providerId);
    if (!p || p.orgId !== req.orgId) return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
    const body = providerBody(p);
    const etag = etagFor(body);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=60");
    const inm = req.headers["if-none-match"];
    if (inm && inm.replace(/^W\//, "") === etag) return res.status(304).end();
    return res.status(200).json(body);
  }
  app.get("/v1/providers/:providerId", authed, singleProvider);

  function patchProvider(req, res) {
    const p = store.findProvider(req.params.providerId);
    if (!p || p.orgId !== req.orgId) return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
    const current = etagFor(providerBody(p));
    const match = req.headers["if-match"];
    if (match && match !== "*" && match.replace(/^W\//, "") !== current) {
      return problem(res, 412, "precondition-failed", "Provider changed since you read it; re-read and retry");
    }
    const b = req.body || {};
    if (b.name !== undefined) {
      if (typeof b.name !== "string" || !b.name.trim()) return problem(res, 422, "invalid-request", "Invalid name", [["name", "non-empty string"]]);
      const dup = store.findProviderByName(req.orgId, b.name);
      if (dup && dup.id !== p.id) return problem(res, 409, "provider-conflict", `Provider '${b.name}' exists`);
      p.name = b.name;
    }
    if (b.endpoint !== undefined) {
      if (typeof b.endpoint !== "string" || !/^https?:\/\/.+/.test(b.endpoint)) {
        return problem(res, 422, "invalid-request", "Invalid endpoint", [["endpoint", "http(s) URI"]]);
      }
      p.endpoint = b.endpoint;
    }
    if (b.timeoutMs !== undefined) {
      if (!Number.isInteger(b.timeoutMs) || b.timeoutMs < 1) return problem(res, 422, "invalid-request", "Bad timeout", [["timeoutMs", "positive int"]]);
      p.timeoutMs = b.timeoutMs;
    }
    if (b.enabled !== undefined) {
      if (typeof b.enabled !== "boolean") return problem(res, 422, "invalid-request", "Bad enabled", [["enabled", "boolean"]]);
      p.enabled = b.enabled;
      if (!b.enabled) p.circuitState = "open";
      else { p.circuitState = "closed"; p.failureCount = 0; }
    }
    const out = providerBody(p);
    res.setHeader("ETag", etagFor(out));
    return res.status(200).json(out);
  }
  app.patch("/v1/providers/:providerId", authed, patchProvider);

  function deleteProvider(req, res) {
    const p = store.findProvider(req.params.providerId);
    if (!p || p.orgId !== req.orgId) return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
    store.removeProvider(p.id);
    return res.status(204).send();
  }
  app.delete("/v1/providers/:providerId", authed, deleteProvider);

  app.post("/v1/providers/:providerId", authed, (req, res) => {
    const eff = effectiveMethod(req);
    if (eff === "PATCH") return patchProvider(req, res);
    if (eff === "DELETE") return deleteProvider(req, res);
    return problem(res, 405, "invalid-request", "Use PATCH or DELETE (or X-HTTP-Method-Override)");
  });

  app.get("/v1/providers/:providerId/health", authed, (req, res) => {
    const provider = store.findProvider(req.params.providerId);
    if (!provider || provider.orgId !== req.orgId) {
      return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
    }
    store.circuitAllows(provider);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(provider.asHealth());
  });
}

module.exports = { mountProviderRoutes, providerBody };
