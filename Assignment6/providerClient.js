// providerClient.js — hardened outbound calls (Part D).
//
// Two outbound directions:
//  1. invokeProvider() — calls the provider's own endpoint to get a
//     completion. Timeout + retry with exponential backoff + jitter.
//     Only network faults / timeouts / 5xx are retried; a 4xx from the
//     provider is never retried. Every retried POST carries an
//     idempotency key so a duplicate delivery is harmless.
//  2. recordAudit() — best-effort POST to the Security & Audit service
//     (AUDIT_URL env, never hard-coded). Failures never fail the
//     caller; the interaction is kept locally instead (see NOTES.md D3).
const axios = require("axios");
const crypto = require("crypto");

const AUDIT_URL = process.env.AUDIT_URL || "http://127.0.0.1:8006";

class ProviderTimeout extends Error {
  constructor(msg) { super(msg); this.name = "ProviderTimeout"; }
}
class ProviderFault extends Error {
  constructor(msg, status) { super(msg); this.name = "ProviderFault"; this.status = status; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  // Never retry 4xx — the request itself is at fault.
  if (err.response && err.response.status >= 400 && err.response.status < 500) return false;
  return true;
}

// Generic hardened POST: timeout + up-to-N attempts, exponential
// backoff with jitter between attempts. Retried sends reuse the same
// Idempotency-Key header.
async function postWithRetry(url, body, { timeoutMs = 3000, attempts = 3, idempotencyKey = null } = {}) {
  const key = idempotencyKey || crypto.randomUUID();
  let lastErr = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await axios.post(url, body, {
        headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
        timeout: timeoutMs
      });
      return res.data;
    } catch (err) {
      if (!isRetryable(err)) throw err; // 4xx: fail immediately, no retry
      lastErr = err;
      if (attempt < attempts - 1) {
        const wait = (Math.pow(2, attempt) * 200) + Math.random() * 100;
        await sleep(wait);
      }
    }
  }
  if (lastErr && (lastErr.code === "ECONNABORTED" || /timeout/i.test(lastErr.message || ""))) {
    throw new ProviderTimeout(`Provider call timed out after ${attempts} attempts: ${lastErr.message}`);
  }
  const status = lastErr && lastErr.response ? lastErr.response.status : null;
  throw new ProviderFault(`Provider call failed after ${attempts} attempts: ${(lastErr && lastErr.message) || "unknown"}`, status);
}

// Invoke a registered provider. Providers without a configured
// endpoint are served by the built-in mock engine (instant, reliable);
// providers WITH an endpoint get a real hardened HTTP call.
async function invokeProvider(provider, messages, { timeoutMs = null, traceId = null } = {}) {
  const started = Date.now();
  const timeout = timeoutMs || provider.timeoutMs || 3000;
  const idemKey = traceId || crypto.randomUUID();

  if (!provider.endpoint) {
    // Mock engine: echo-style completion so the service is demonstrable
    // without real provider credentials (which must never be stored here).
    await sleep(5 + Math.random() * 20);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return {
      text: `[${provider.name}/${provider.type} mock] ${lastUser ? lastUser.content.slice(0, 200) : "(no user message)"}`,
      latencyMs: Date.now() - started
    };
  }

  const data = await postWithRetry(
    provider.endpoint,
    { messages, traceId: idemKey },
    { timeoutMs: timeout, attempts: 3, idempotencyKey: idemKey }
  );
  return {
    text: (data && (data.response || data.text || data.output)) || "",
    latencyMs: Date.now() - started
  };
}

// Best-effort audit of a provider interaction (Model&Provider ->
// Security&Audit recordProviderInteraction). Never throws: on failure
// the record is kept in the local fallback buffer.
const _fallbackAuditLog = [];

async function recordAudit(entry) {
  const url = `${AUDIT_URL.replace(/\/$/, "")}/v1/provider-interactions`;
  try {
    await postWithRetry(url, entry, { timeoutMs: 1500, attempts: 2 });
    return { delivered: true };
  } catch (err) {
    _fallbackAuditLog.push({ ...entry, fallbackReason: String((err && err.message) || err), at: new Date().toISOString() });
    return { delivered: false, buffered: true };
  }
}

function fallbackAuditLog() {
  return _fallbackAuditLog.slice();
}

module.exports = {
  invokeProvider,
  recordAudit,
  fallbackAuditLog,
  postWithRetry,
  ProviderTimeout,
  ProviderFault,
  AUDIT_URL
};
