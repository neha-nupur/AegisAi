const { VALID_SENSITIVITY } = require("./validators");

function mountExtraRoutes(app, store, authed, problem, etagFor) {
  app.get("/v1/models", authed, (req, res) => {
    const { capability, sensitivityLevel, page, limit, sort, order } = req.query;
    if (sensitivityLevel !== undefined && !VALID_SENSITIVITY.includes(sensitivityLevel)) {
      return problem(res, 400, "invalid-filter", "Invalid sensitivityLevel filter", [["sensitivityLevel", "must be valid"]]);
    }
    const pg = page === undefined ? 1 : Number(page);
    const lim = limit === undefined ? 10 : Number(limit);
    const sortBy = sort || "createdAt";
    const dir = order || "asc";
    if (!Number.isInteger(pg) || pg < 1 || !Number.isInteger(lim) || lim < 1 || lim > 100 ||
        !["createdAt", "name"].includes(sortBy) || !["asc", "desc"].includes(dir)) {
      return problem(res, 400, "invalid-filter", "Invalid pagination", [["page", "int>=1"], ["limit", "1..100"]]);
    }
    let items = store.listModels(req.orgId, { capability, sensitivityLevel });
    items.sort((a, b) => {
      const va = sortBy === "name" ? a.name : a.createdAt;
      const vb = sortBy === "name" ? b.name : b.createdAt;
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === "asc" ? c : -c;
    });
    const total = items.length;
    const slice = items.slice((pg - 1) * lim, (pg - 1) * lim + lim);
    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json({
      models: slice.map((m) => m.asJson()),
      page: pg, limit: lim, total,
      next: ((pg - 1) * lim + lim < total) ? `/v1/models?page=${pg + 1}&limit=${lim}` : null
    });
  });

  function singleModel(req, res) {
    const provider = store.findProvider(req.params.providerId);
    if (!provider || provider.orgId !== req.orgId) {
      return problem(res, 404, "provider-not-found", `No provider ${req.params.providerId}`);
    }
    const m = store.findModel(req.params.modelId);
    if (!m || m.providerId !== provider.id) {
      return problem(res, 404, "model-not-found", `No model ${req.params.modelId}`);
    }
    const body = m.asJson();
    const etag = etagFor(body);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=60");
    const inm = req.headers["if-none-match"];
    if (inm && inm.replace(/^W\//, "") === etag) return res.status(304).end();
    return res.status(200).json(body);
  }
  app.get("/v1/providers/:providerId/models/:modelId", authed, singleModel);
}

module.exports = { mountExtraRoutes };
