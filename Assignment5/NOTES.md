# NOTES.md — Assignment 5: HTTP Methods & Headers (Model & Provider Service)

Student: Shivam Kumar Soni · Roll No.: 20251651084 · Team ID: AegisAI-MP
Base: Assignment 4 (`Assignment-4(Model-and-Provider)`) · Port 8002

## A1: Method map (action → method + URL)

| Action | Method | URL |
|---|---|---|
| Register a provider | POST | `/v1/providers` |
| Read a single provider | GET | `/v1/providers/{providerId}` |
| Partially update a provider | PATCH | `/v1/providers/{providerId}` |
| Remove a provider (+ its models) | DELETE | `/v1/providers/{providerId}` |
| Register a model (sub-resource) | POST | `/v1/providers/{providerId}/models` |
| List models (filter/sort/paginate) | GET | `/v1/models?capability=&sensitivityLevel=&page=&limit=&sort=&order=` |
| Read a single model | GET | `/v1/providers/{providerId}/models/{modelId}` |
| Select a model + invoke provider | POST | `/v1/route-and-invoke` |
| Provider health + circuit state | GET | `/v1/providers/{providerId}/health` |
| Capability discovery | OPTIONS | `/v1/providers`, `/v1/models` |

GET only reads; POST creates or processes; PATCH modifies; DELETE removes (204). No verb leaks into any URL.

## A2: Non-CRUD actions

`routeAndInvoke` is not CRUD — it selects a model by policy/capability/
sensitivity/cost/health, applies MASK redaction, invokes an external
provider behind timeout/retry/circuit-breaker, and returns a transient
completion. It stays `POST /v1/route-and-invoke`, never `POST /invokeProvider`.
Model registration is a true sub-resource `POST /v1/providers/{id}/models`.

## A3: Safe & idempotent

| Endpoint | Safe | Idempotent |
|---|---|---|
| GET /v1/models, GET single model/provider/health | Yes | Yes |
| OPTIONS | Yes | Yes |
| POST /v1/providers, POST .../models | No | No naturally — Idempotency-Key makes repeats safe |
| POST /v1/route-and-invoke | No | No (each call re-invokes the provider) |
| PATCH /v1/providers/{id} | No | Yes for same body; guarded by If-Match |
| DELETE /v1/providers/{id} | No | Yes (repeat → 404, same state) |

## A4: Reads take query params

`GET /v1/models` filters (`capability`, `sensitivityLevel`), sorts
(`sort=createdAt|name`, `order=asc|desc`) and paginates (`page`, `limit`
1..100) purely via the query string, returning `{models, page, limit,
total, next}`. Bad params → 400.

## A5: OPTIONS + Allow, and override

`OPTIONS /v1/providers` → `204` + `Allow: GET, POST, PATCH, DELETE,
OPTIONS`; `OPTIONS /v1/models` → `Allow: GET, OPTIONS`. Constrained clients
may tunnel via `POST /v1/providers/{id}` with `X-HTTP-Method-Override:
PATCH|DELETE` — documented fallback only.

## A6: One full exchange (HTTP/1.1)

Request:

```http
POST /v1/providers HTTP/1.1
Host: localhost:8002
Content-Type: application/json
Accept: application/json
Authorization: Bearer demo-token
X-Organization-Id: org-1
Idempotency-Key: a5-1
Content-Length: 35

{"name":"OpenAI","type":"openai"}
```

Response:

## Answers

1. Three endpoints, success + the header that matters most:
   - `POST /v1/providers` → 201; **Location** — the only way the client learns the new prov-* id.
   - `GET .../models/{modelId}` → 200; **ETag** — powers 304 caching and proves freshness.
   - `PATCH /v1/providers/{id}` → 200; **ETag** (new value) — proof of what was written; stale writers get 412.
2. Safe: all GETs + OPTIONS. Idempotent: GETs, OPTIONS, PATCH (same body), DELETE. Neither safe nor naturally idempotent: the three POSTs — creates made retry-safe via Idempotency-Key; route-and-invoke stays non-retryable client-side (outbound leg retries internally with the same key).
3. ETag `"mp-f1ab2248f5d22d84"` from `GET .../models/model-1`; `If-None-Match` with it → `304` no body (saves bandwidth + re-serialization); `PATCH` with stale `If-Match` → `412` (prevents overwriting another editor's change).
4. 400 vs 422 here: this service returns **400** for malformed shape (`POST /v1/providers {"name":""}` → 400 invalid-request) and **409** for well-formed-but-refused domain state (duplicate provider name). Same split as 400-vs-422: shape errors vs semantically refused requests.
5. Browser call blocked yet server logged 200: the **browser's CORS policy** blocked it — the response arrived but lacked `Access-Control-Allow-Origin`. Fix header: `Access-Control-Allow-Origin: *` (+ Allow-Headers/Methods + bare OPTIONS preflight), all implemented here.
6. Cacheable: `GET .../models/{id}` → `Cache-Control: private, max-age=60` (records change rarely; ETag validates). No-store: `GET .../health` → `Cache-Control: no-store` (live circuit state must never be stale).
7. Search-as-GET vs POST: GET while filters fit in a query string (cacheable, bookmarkable, safe). POST if the filter became a large JSON body (e.g. embedding vectors) overflowing URL limits — giving up cacheability, safe-retry and linkability.
8. Location on 201 → the **newly created resource** (`/v1/providers/prov-1`); on 3xx → the **redirect target** to fetch instead. Same header, different speech act: "here is what I made" vs "go look over there".

## Run

```bash
npm install
npm test            # 10 jest tests pass
node transcript.js  # writes curl-transcript.txt (201, 200-repeat, 304, 412, 400, 404, 401)
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /v1/providers/prov-1
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Access-Control-Allow-Origin: *
X-Trace-Id: 20158b0a-502a-4eb4-894a-601ea732dcc9

{"providerId":"prov-1","name":"OpenAI","status":"registered"}
```

## D2: Headers table

| Endpoint | Required request headers | Response headers set |
|---|---|---|
| POST /v1/providers | Authorization, X-Organization-Id, (Idempotency-Key) | Location, X-RateLimit-*, X-Trace-Id, CORS, security |
| POST .../models | Authorization, X-Organization-Id, (Idempotency-Key) | Location, X-RateLimit-*, X-Trace-Id |
| GET /v1/models | Authorization, X-Organization-Id | Cache-Control: private max-age=30, X-RateLimit-* |
| GET single model/provider | Authorization, X-Organization-Id, (If-None-Match) | ETag, Cache-Control: private max-age=60 |
| PATCH provider | Authorization, X-Organization-Id, (If-Match) | ETag (new), X-RateLimit-* |
| DELETE provider | Authorization, X-Organization-Id | 204, no body |
| POST /v1/route-and-invoke | Authorization, X-Organization-Id | X-RateLimit-*, X-Trace-Id |
| GET .../health | Authorization, X-Organization-Id | Cache-Control: no-store |
| OPTIONS * | (none — bare preflight) | Allow, Access-Control-Allow-*, 204 |

## C4: Safe-retry plan

| Risky endpoint | Mechanism | Why |
|---|---|---|
| POST /v1/providers, POST .../models | Idempotency-Key | Same key replays original (201→200), no phantom records |
| GET single read | If-None-Match → 304 | Saves a body round-trip |
| PATCH provider | If-Match → 412 | Two editors cannot clobber each other |
| DELETE provider | Retry freely | Idempotent (repeat → 404, same state) |
| POST /v1/route-and-invoke | Never blindly retried client-side | Each call re-invokes; only the outbound leg retries (timeout/5xx, same key, never 4xx) |
