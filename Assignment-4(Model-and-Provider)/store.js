const { Provider, Model } = require("./models");

const _providers = new Map();       // providerId -> Provider
const _providerByKey = new Map();   // idempotency-key -> providerId
const _models = new Map();          // modelId -> Model
const _modelByKey = new Map();      // idempotency-key -> modelId
let _nextProvider = 1;
let _nextModel = 1;

const CIRCUIT_THRESHOLD = 3;        // consecutive failures before circuit opens
const CIRCUIT_COOLDOWN_MS = 30000;  // 30s before half-open probe allowed

function createProvider(data, orgId, key = null) {
  const id = `prov-${_nextProvider++}`;
  const p = new Provider(id, data, orgId, key);
  _providers.set(id, p);
  if (key) _providerByKey.set(`${orgId}:${key}`, id);
  return p;
}

function findProvider(id) {
  return _providers.get(id) || null;
}

function findProviderByKey(orgId, key) {
  const id = _providerByKey.get(`${orgId}:${key}`);
  return id ? _providers.get(id) : null;
}

function findProviderByName(orgId, name) {
  const n = String(name).toLowerCase();
  for (const p of _providers.values()) {
    if (p.orgId === orgId && p.name.toLowerCase() === n) return p;
  }
  return null;
}

function createModel(provider, data, key = null) {
  const id = `model-${_nextModel++}`;
  const m = new Model(id, provider.id, provider.name, data);
  _models.set(id, m);
  if (key) _modelByKey.set(`${provider.id}:${key}`, id);
  return m;
}

function findModel(id) {
  return _models.get(id) || null;
}

function findModelByKey(providerId, key) {
  const id = _modelByKey.get(`${providerId}:${key}`);
  return id ? _models.get(id) : null;
}

function listModels(orgId, { capability, sensitivityLevel } = {}) {
  let items = Array.from(_models.values()).filter((m) => {
    const p = _providers.get(m.providerId);
    return p && p.orgId === orgId;
  });
  if (capability) {
    items = items.filter((m) => m.capabilities.includes(capability));
  }
  if (sensitivityLevel) {
    items = items.filter((m) => m.sensitivityLevel === sensitivityLevel);
  }
  return items;
}

// ---- circuit-breaker bookkeeping ----
function recordSuccess(provider, latencyMs) {
  provider.successCount += 1;
  provider.failureCount = 0;
  provider.circuitState = "closed";
  provider.circuitOpenedAt = null;
  provider.lastCheckedAt = new Date().toISOString();
  provider.lastLatencyMs = latencyMs;
}

function recordFailure(provider) {
  provider.failureCount += 1;
  provider.lastCheckedAt = new Date().toISOString();
  if (provider.failureCount >= CIRCUIT_THRESHOLD && provider.circuitState === "closed") {
    provider.circuitState = "open";
    provider.circuitOpenedAt = Date.now();
  }
}

function circuitAllows(provider) {
  if (provider.circuitState !== "open") return true;
  // half-open probe: allow one trial after cooldown
  if (Date.now() - provider.circuitOpenedAt >= CIRCUIT_COOLDOWN_MS) {
    provider.circuitState = "half_open";
    return true;
  }
  return false;
}

function isProviderUsable(provider) {
  if (!provider.enabled) return false;
  return circuitAllows(provider);
}

function _reset() {
  _providers.clear();
  _providerByKey.clear();
  _models.clear();
  _modelByKey.clear();
  _nextProvider = 1;
  _nextModel = 1;
}

module.exports = {
  createProvider,
  findProvider,
  findProviderByKey,
  findProviderByName,
  createModel,
  findModel,
  findModelByKey,
  listModels,
  recordSuccess,
  recordFailure,
  circuitAllows,
  isProviderUsable,
  CIRCUIT_THRESHOLD,
  CIRCUIT_COOLDOWN_MS,
  _reset
};
