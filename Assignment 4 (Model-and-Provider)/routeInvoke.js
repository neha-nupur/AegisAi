const { validateRoute } = require("./validators");
const { pickCandidate, maskMessages } = require("./routing");

function mountRouteAndInvoke(app, store, authed, problem, invokeProvider, recordAudit) {
  app.post("/v1/route-and-invoke", authed, async (req, res) => {
    const errs = validateRoute(req.body);
    if (errs.length > 0) return problem(res, 400, "invalid-request", "Route request is invalid", errs);

    const { request: aiReq, policyDecision, modelPreference } = req.body;
    const sensitivityNeed = aiReq.metadata && aiReq.metadata.sensitivityLevel;

    const all = store.listModels(req.orgId, {});
    if (all.length === 0) {
      return problem(res, 503, "no-model-available", "No models registered for this organisation");
    }
    const found = pickCandidate(store, all, modelPreference, sensitivityNeed);
    if (!found.model) {
      const why = found.error === "disabled" ? "All candidate models are disabled" : "No model satisfies the request constraints";
      return problem(res, 503, "no-model-available", why);
    }
    const model = found.model;
    const provider = store.findProvider(model.providerId);
    if (!provider || !provider.enabled) {
      return problem(res, 503, "provider-unavailable", "Selected provider is not available");
    }
    if (!store.circuitAllows(provider)) {
      return problem(res, 503, "circuit-open", `Provider ${provider.id} circuit is open`);
    }

    const messages = policyDecision === "MASK" ? maskMessages(aiReq.messages) : aiReq.messages;
    const traceId = (aiReq.requestId && String(aiReq.requestId)) || res.locals.traceId;
    try {
      const out = await invokeProvider(provider, messages, { traceId });
      store.recordSuccess(provider, out.latencyMs);
      model.invocationCount += 1;
      recordAudit({
        providerId: provider.id, modelId: model.id, organizationId: req.orgId,
        latencyMs: out.latencyMs, status: "success", traceId
      }).catch(() => {});
      return res.status(200).json({
        response: out.text, modelUsed: model.id, providerId: provider.id,
        latencyMs: out.latencyMs, status: "success", traceId
      });
    } catch (err) {
      store.recordFailure(provider);
      recordAudit({
        providerId: provider.id, modelId: model.id, organizationId: req.orgId,
        latencyMs: null, status: "failed", traceId
      }).catch(() => {});
      if ((err && err.name === "ProviderTimeout") || (err && err.code === "ECONNABORTED")) {
        return problem(res, 504, "provider-timeout", (err && err.message) || "Provider timed out");
      }
      return problem(res, 503, "provider-unavailable", (err && err.message) || "Provider invocation failed");
    }
  });

  app.get("/v1/_fallback-audit", (req, res) => {
    const { fallbackAuditLog } = require("./providerClient");
    return res.status(200).json({ buffered: fallbackAuditLog() });
  });

  app.use((req, res) => problem(res, 404, "invalid-request", `No route ${req.method} ${req.path}`));
  app.use((err, req, res, _next) => {
    if (res.headersSent) return;
    if (err && err.type === "entity.parse.failed") return problem(res, 400, "invalid-request", "Malformed JSON body");
    return problem(res, 500, "internal-error", (err && err.message) || "Unexpected failure");
  });
}

module.exports = { mountRouteAndInvoke };
