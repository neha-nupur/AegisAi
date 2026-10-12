const SENSITIVITY_RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };

function pickCandidate(store, candidates, modelPreference, sensitivityNeed) {
  let pool = candidates.filter((m) => m.enabled);
  if (pool.length === 0) return { error: "disabled" };
  if (modelPreference) {
    const pref = String(modelPreference).toLowerCase();
    const exact = pool.filter((m) => m.name.toLowerCase() === pref || m.id.toLowerCase() === pref);
    if (exact.length > 0) pool = exact;
    else {
      const fuzzy = pool.filter((m) => m.name.toLowerCase().includes(pref));
      if (fuzzy.length > 0) pool = fuzzy;
    }
  }
  if (sensitivityNeed) {
    const need = SENSITIVITY_RANK[sensitivityNeed] ?? 0;
    pool = pool.filter((m) => (SENSITIVITY_RANK[m.sensitivityLevel] ?? 0) >= need);
  }
  if (pool.length === 0) return { error: "none" };
  pool.sort((a, b) => {
    const ca = (a.costInformation && a.costInformation.inputCostPer1KTokens) || 0;
    const cb = (b.costInformation && b.costInformation.inputCostPer1KTokens) || 0;
    if (ca !== cb) return ca - cb;
    const pa = store.findProvider(a.providerId);
    const pb = store.findProvider(b.providerId);
    const ha = pa && pa.circuitState === "closed" ? 0 : 1;
    const hb = pb && pb.circuitState === "closed" ? 0 : 1;
    return ha - hb;
  });
  return { model: pool[0] };
}

function maskMessages(messages) {
  return messages.map((m) => ({
    role: m.role,
    content: String(m.content)
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[MASKED_EMAIL]")
      .replace(/\b\d{10}\b/g, "[MASKED_PHONE]")
  }));
}

module.exports = { pickCandidate, maskMessages, SENSITIVITY_RANK };
