# NOTES.md — AegisAI Model & Provider Service (Assignment 4)

Student: Shivam Kumar Soni · Roll No.: 20251651084
Service: Model & Provider Management · Port: 8002

## Resource Table (Part A4)

| Method | URL | What it does | Success | Failures |
|---|---|---|---|---|
| POST | `/v1/providers` | Register an AI provider (OpenAI, Gemini, local, custom) | 201 + `Location` | 400, 401, 403, 409 |
| POST | `/v1/providers/{providerId}/models` | Register a model under a provider (sub-resource) | 201 + `Location` | 400, 401, 403, 404 |
| GET | `/v1/models?capability=&sensitivityLevel=` | List models, filtered by capability / sensitivity | 200 | 400, 401, 403 |
| GET | `/v1/providers/{providerId}/models/{modelId}` | Read a single model | 200 | 401, 403, 404 |
| POST | `/v1/route-and-invoke` | Select a model and invoke a provider (state-changing: circuit counters, invocation counts) | 200 | 400, 401, 403, 503, 504 |
| GET | `/v1/providers/{providerId}/health` | Provider health + circuit state (computed only) | 200 | 401, 403, 404 |

## A5: Justification — the hard choice

`routeAndInvoke(aiRequest, policyDecision, modelPreference)` mapped least
comfortably onto a resource because it is not CRUD on a stored thing: it
selects a model by policy/capability/sensitivity/cost/health, applies
masking, invokes an external provider behind timeout/retry/circuit-breaker,
and returns a transient completion. I rejected modelling it as
`POST /v1/invocations` with a persisted invocation resource (nothing durable
needs storing — the audit trail belongs to the Security & Audit service) and
rejected splitting it into `GET /v1/route` + `POST /v1/invoke` (the selection
is only valid at invoke time; health changes between the two calls). Instead
`POST /v1/route-and-invoke` is a processing RPC-style endpoint whose result
is ephemeral, which is exactly what the AegisAI contract prescribes.

## SOAP operations mapped (Part A2 → A3)

Starting SOAP-style verbs from Assignment 2 Task 3.5:
`listModels`, `registerProvider`, `registerModel`, `routeAndInvoke`,
`getProviderHealth`. Nouns extracted: **providers**, **models** (+ health as a
computed view, route-and-invoke as a processing action). Verbs
(`register`, `get`, `route`) do not survive into any URL — they became HTTP
methods + resource paths.

## D3: Fallback reasoning

Two outbound directions exist. (1) Provider invocation: when the provider is
unreachable after timeout + 3 retries with backoff/jitter, the service FAILS
with 503/504 rather than degrading — returning a fabricated completion would
violate the governance purpose of AegisAI (a wrong or hallucinated answer
attributed to a provider is worse than an explicit failure, and the gateway
can fall back to another model). (2) Audit write to Security & Audit: this
one degrades gracefully — the interaction is buffered in the local fallback
log (`GET /v1/_fallback-audit`) and the caller still gets its completion,
because losing observability must never break the data path.

## Answers

1. WSDL vs OpenAPI line counts: my `openapi.yaml` is 508 lines. A WSDL
describing the same 5 operations would be ~600–700 lines because every
operation needs `<message>` + `<portType>` + `<binding>` + `<service>/<port>`
scaffolding. Two things the WSDL declared that OpenAPI does not need:
(a) the `<binding>` element (concrete SOAP/transport encoding — HTTP is
assumed in REST), and (b) the `<service>/<port>` endpoint address block (the
server URL + path already identifies the endpoint).
2. Assignment 3 style fault: `<soap:Fault><faultcode>soap:Server</faultcode>
<faultstring>ProviderUnavailable</faultstring></soap:Fault>` inside a
`200 OK` envelope. Replacement: `503 Service Unavailable` with body
`{"type":"/errors/provider-unavailable","title":"Provider unavailable",
"status":503,"detail":"..."}`. A fault inside 200 OK is a problem because
every intermediary (proxies, caches, load balancers, retry layers) keys off
the status code — a 200 is cached, treated as success, and never retried or
failed-over, so the failure silently propagates as if it were data.
3. UDDI publish/find/bind: **publish** still exists (the service registers
itself by listening on :8002 / container registration); **find** still exists
(DNS + `AUDIT_URL`/`PROVIDERS` env resolution, `GET /v1/models` discovery).
**Bind** disappeared — there is no stub generation / protocol negotiation
step; any HTTP client can bind trivially because the contract is plain
HTTP+JSON described by openapi.yaml.
4. The functions now carrying schema enforcement: `validateProvider()`,
`validateModel()`, `validateRoute()` in `validators.js`, called before any
field is touched. Without them, e.g. `capabilities: "text-generation"`
(a string instead of an array) would pass through and crash routing with a
500 (`m.capabilities.includes is not a function`) instead of a clean 400.
5. Where I would still choose SOAP: the audit-trail handoff
(`recordProviderInteraction` → Security & Audit) if it ever required
exactly-once, cross-database atomicity with the invocation record.
SOAP buys WS-AtomicTransaction / WS-ReliableMessaging — a distributed
commit/rollback guarantee across two systems — which REST can only
approximate with hand-rolled sagas and idempotency keys.

## How to run

```bash
npm install
npm test            # jest suite (7 tests)
PORT=8002 npm start # service on http://localhost:8002
AUDIT_URL=http://127.0.0.1:8006 npm start  # resolve audit service from env, never hard-coded
```
