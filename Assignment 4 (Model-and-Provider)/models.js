class Provider {
  constructor(id, { name, type, endpoint, timeoutMs, enabled }, orgId, idempotencyKey = null) {
    // ---- stored record (internal) ----
    this.id = id;                       // internal id, also used as public providerId
    this.orgId = orgId;                 // tenancy scope — never published
    this.name = name;
    this.type = type;
    this.endpoint = endpoint || null;   // internal routing detail — never published
    this.timeoutMs = timeoutMs || 5000;
    this.enabled = enabled !== undefined ? enabled : true;
    this.apiKeyRef = `secret-ref-${id}`; // credential handle — MUST never leak
    this.failureCount = 0;               // circuit-breaker internals — never published
    this.successCount = 0;
    this.circuitState = "closed";        // exposed only via /health, not in provider JSON
    this.circuitOpenedAt = null;
    this.lastCheckedAt = new Date().toISOString();
    this.lastLatencyMs = null;
    this.idempotencyKey = idempotencyKey;
    this.createdAt = new Date().toISOString();
  }

  // ---- published representation: differs from stored record ----
  asJson() {
    return {
      providerId: this.id,
      name: this.name,
      type: this.type,
      status: this.enabled ? "registered" : "disabled",
      createdAt: this.createdAt
    };
  }

  asHealth() {
    let status = "healthy";
    if (this.circuitState === "open") status = "unavailable";
    else if (this.failureCount > 0) status = "degraded";
    if (!this.enabled) status = "unavailable";
    return {
      providerId: this.id,
      status,
      circuitState: this.circuitState,
      lastCheckedAt: this.lastCheckedAt,
      latencyMs: this.lastLatencyMs
    };
  }
}

class Model {
  constructor(id, providerId, providerName, { name, capabilities, sensitivityLevel, costInformation, enabled }) {
    // ---- stored record (internal) ----
    this.id = id;                       // internal id, public as modelId
    this.internalSeq = id;              // internal sequence — never published
    this.providerId = providerId;
    this.providerName = providerName;
    this.name = name;
    this.capabilities = capabilities;
    this.sensitivityLevel = sensitivityLevel;
    this.costInformation = costInformation || null;
    this.enabled = enabled !== undefined ? enabled : true;
    this.invocationCount = 0;           // internal counter — never published
    this.createdAt = new Date().toISOString();
  }

  // ---- published representation ----
  asJson() {
    const out = {
      modelId: this.id,
      name: this.name,
      providerId: this.providerId,
      providerName: this.providerName,
      capabilities: this.capabilities,
      sensitivityLevel: this.sensitivityLevel,
      enabled: this.enabled
    };
    if (this.costInformation) out.costInformation = this.costInformation;
    return out;
  }
}

module.exports = { Provider, Model };
