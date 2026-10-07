# AegisAI — Assignment 4: Model & Provider Service in REST

**Team:** Aditi Garg (20251651008), Neha Nupur (20251651064), Shivam Kumar Soni (20251651084)
**Service rebuilt:** Model & Provider Service (owns `Provider`, `Model` — Assignment 2's boundary, owned by Shivam Kumar Soni, unchanged)

> **A note on scope.** This repo currently has Assignment 2 only — there's no
> Assignment 3 (SOAP/WSDL) artifact yet, unlike CampusEats. Questions 1–3
> below, which were originally written to compare against a WSDL, are
> answered here against Assignment 2's **Task 3 operation table** instead —
> AegisAI's own RPC-shaped contract for this service. Each answer says so
> explicitly where it matters.

---

## Part A — Modelling the service

### A2. Operations as they would have been written for the Task 3 contract (starting point only)

Straight from `AegisAi.pdf`, Section 3.5:

- `registerProvider(providerConfig)` → providerRef *(C15)*
- `registerModel(providerRef, modelInfo)` → modelRef *(C16)*
- `listModels(orgIdentity, filter)` → models[] *(feeds C17's routing decision)*
- `getProviderHealth(providerRef)` → health, circuitState

Plus one CRUD extension the Task 3 table doesn't literally name, needed to make the Model resource fully manageable — mirroring how CampusEats' `setItemAvailability` extended its own Task 3 contract the same way:
- `setModelStatus(modelRef, isActive)` → confirmed status

### A3. Nouns

`Providers`, `Models`. `register`, `list`, `get`, `set` do not survive into any URL.

### A4. Resource table

| Method | URL | What it does | Success | Failure |
|---|---|---|---|---|
| POST | `/providers` | Register a provider (`registerProvider` / C15) | 201 | 400, 422 |
| GET | `/providers/{providerId}` | Read a single provider | 200 | 404 |
| POST | `/providers/{providerId}/models` | Register a model under a provider (`registerModel` / C16); safely retryable via `Idempotency-Key` | 201 | 400, 404, 422 |
| GET | `/providers/{providerId}/models?active=true\|false` | List a provider's models, filtered by active status | 200 | 404 |
| PATCH | `/models/{modelId}/status` | Activate/deactivate a model (`setModelStatus`) — sub-resource, state-changing | 200 | 404, 409, 422 |
| POST | `/providers/{providerId}/health-check` | Probe the provider's real endpoint — a thin, real slice of C18 | 200 | 404 |

### A5. The hard choice — `routeAndInvoke`

The Task 3 operation that mapped least comfortably onto a resource wasn't one we implemented at all: `routeAndInvoke`. It's the real heart of capability C17/C18 — select a model *and* invoke the provider *and* apply timeout/retry/circuit-breaker protection, all in one RPC call whose response shape depends entirely on which provider answered. It has no stable resource identity (it isn't "a routing," it's a verb chained to another verb), it isn't idempotent in any natural sense (invoking a model has side effects and costs money), and its own error list — `NoModelAvailable`, `ProviderUnavailable`, `Timeout`, `CircuitOpen` — reads like a saga's failure modes, not a resource's. Exposing it as one big `POST /route-and-invoke` endpoint was rejected: it would have smuggled the entire AI Gateway orchestration (Identity → Privacy → Policy → Model routing, per Task 4's `submitAIRequest` walkthrough) into what's supposed to be *this* service's boundary alone. Instead, this assignment implements only the concrete, addressable slice of C18 that legitimately belongs to Model & Provider Service by itself: `POST /providers/{id}/health-check`, a real resource-shaped action with a clear before/after state (`status`, `circuit_state`) — exactly the "model an action as its own sub-resource" move CampusEats made for `setItemAvailability`.

---

## Part D — Surviving the network

### D1–D2. The call and its hardening

Task 6 already flags this service's weak point in writing: **"Independent — Partial. The service ultimately depends on external AI providers — if all configured providers are unavailable, an AI response cannot be produced."** `POST /providers/{id}/health-check` (`provider_client.py`) is the real, minimal implementation of the mitigation Task 6 itself proposes ("Retries, timeouts, circuit breakers and fallback providers reduce... this dependency").

The call is a single `GET {base_url}/health` — read-only, so every attempt is safe to retry: a 2s timeout, up to 3 attempts, exponential backoff with jitter, and a 4xx stops retrying immediately (retrying our own bad request wouldn't change the outcome).

**One deliberate departure from the CampusEats pattern**, worth calling out: CampusEats resolved its sibling-service address from a single `ORDER_SERVICE_URL` environment variable, because that address was infrastructure config for one fixed dependency. A provider's address isn't that — AegisAI can have many providers, each with its own `base_url` already sitting in the `providers` table (`AegisAiSchema.sql`). Reading it from the Provider record itself, not an env var, is the architecturally correct choice here, not a shortcut.

**Also worth flagging honestly:** this implements timeout + backoff-and-jitter retry and reflects the outcome into `status`/`circuit_state` as a simple closed/open toggle — it does **not** implement the full CLOSED → OPEN → HALF-OPEN state machine with failure-count thresholds that AegisAI's own roadmap reserves for Phase 7. That needs state persisted *across* calls (a failure count, a recovery timer), which is out of scope for a single-request REST slice. This is a correct, working stepping stone toward that phase, not a substitute for it.

### D3. Fallback

**Chosen fallback: degrade, don't fail** — same principle as CampusEats, applied to a case AegisAI's own design already anticipated. If the provider is unreachable, `POST /providers/{id}/health-check` still returns `200`; it just records `status: "unhealthy"` and `circuit_state: "open"` instead of raising an error. Failing the endpoint outright would be actively wrong here: the entire point of a health check is to surface bad news safely. An endpoint that throws an exception when the thing it's checking is down would be indistinguishable, to a caller, from the check itself being broken — exactly the ambiguity Task 6's proposed fix ("degrade gracefully to a cached... list when every configured provider is down") exists to avoid.

---

## Answers

**Q1.** *(Adapted — no WSDL exists yet; compared against the Task 3 operation table instead.)* Count the "lines" and see what the difference is made of.

**A1.** Task 3's Model & Provider row (`AegisAi.pdf`, Section 3.5) is 5 lines: one per operation, each just `name | input | output | errors`. `openapi.yaml` for the same service is 260+ lines. The difference isn't padding — it's that Task 3's table is *deliberately transport-agnostic*: it never says what an HTTP status code should be, what URL shape a caller hits, or what a request body looks like on the wire, because at the design stage that's the right level of abstraction. `openapi.yaml` has to commit to all of it. Two concrete things the Task 3 table never needed to specify that `openapi.yaml` does: (a) **the resource/URL mapping** — Task 3 just says `registerProvider(config) → providerRef`; it never says *"that's a `POST` to `/providers`."* (b) **HTTP status codes per outcome** — Task 3 lists `ValidationError`, `ProviderNotFound` as bare named labels; `openapi.yaml` has to decide, and document, that one is a `422` and the other a `404`.

**Q2.** *(Adapted — quoting a Task 3 named error instead of a `soap:Fault`.)* Quote one error and show what replaced it.

**A2.** Task 3 names `ProviderNotFound` as a possible error from `registerModel`, with no further shape attached to it — it's a bare label. The REST replacement is a `404` with a problem body: `{"type": "https://aegisai.example/errors/not_found", "title": "Not found", "status": 404, "detail": "No provider with id 999.", "code": "not_found"}`. The underlying issue Q2 is really asking about — a naive SOAP integration returning a fault inside a `200 OK` — has a direct analogue here even without SOAP: a bare named error string with **no HTTP status attached to it at all**, as Task 3's table has, has exactly the same failure mode as burying a fault in a `200`. Any generic intermediary (a cache, a load balancer, a retry policy) can act on a status code without understanding the domain; neither a `200`-wrapped fault nor an un-coded error label gives it anything to act on. Attaching the concrete status is what actually fixes it, whichever direction you're translating from.

**Q3.** Which of UDDI's three moves — publish, find, bind — still exist in this new setup, and which disappeared? Explain what took over the job.

**A3.** Same answer as the CampusEats exercise, and it doesn't depend on there having been a WSDL: *Bind* survives essentially unchanged — a consumer still needs a resolved address, it's just that for Model & Provider Service that address is the `base_url` column on the Provider record itself (see Part D1), rather than a WSDL `<soap:address>` or an env var. *Publish* survives in a lightweight form: `openapi.yaml` committed to this repo *is* the publication. *Find* is what disappeared — there's no runtime registry lookup step. For an internal AegisAI service that would ordinarily be environment configuration or a service mesh; for an external AI provider specifically, discovery is even more manual — an admin calls `registerProvider` and types in the `base_url` by hand, because there's no registry of "AI providers" to query in the first place.

**Q4.** Your XML Schema was enforced before your code ran; your OpenAPI schema is not. Name the specific function in your code that now carries that responsibility, and one failure that would get through if you had not written it.

**A4.** `validate_model_status_update()` (and its siblings `validate_provider_create()`, `validate_model_create()` in `errors.py`) is what now does, by hand, what a schema would have enforced automatically. Concretely: without it, `PATCH /models/{id}/status` with `{"is_active": 1}` (the integer `1`, not the boolean `true`) would sail straight into `model.is_active = requested` — Python doesn't complain, `1 == True`, and the model would end up "active" by accident of a language quirk rather than a deliberate boolean, with no exception ever raised to say a client sent the wrong type.

**Q5.** Name one part of your service where you would still choose the SOAP stack over REST, and state exactly what guarantee you would be buying. Answering "nowhere" needs a stronger argument than answering "somewhere".

**A5.** Not inside Model & Provider Service itself — but AegisAI's own README already commits to exactly one edge where SOAP wins: **Section 11, "SOAP/WSDL Integration."** It describes integrating with a *legacy enterprise system* that only exposes a WSDL contract, specifically to demonstrate that AegisAI can "read a WSDL contract... make a real SOAP request... apply timeout and resilience handling." That's a genuinely different guarantee than anything a health-check or a model registration needs: a legacy enterprise identity or HR system a customer already runs isn't going to be rewritten as REST just to talk to AegisAI, and WS-Security-style message-level contracts are often the compliance-mandated interface for exactly that kind of decades-old enterprise system. Nowhere inside the Model & Provider Service boundary needs that — every dependency here (an AI provider's `/health` endpoint, or the sibling services in Task 3) is something AegisAI itself designed and can keep as REST. The one place SOAP still wins is a boundary the project doesn't control at all: an external legacy system whose interface predates REST and won't change for this project's convenience.

---

## Files

- `Part B - Publish the Contract/openapi.yaml` — contract, validated with `openapi-spec-validator`
- `Part C - Implement It/` — `models.py`, `store.py`, `errors.py`, `app.py`, `tests/test_model_provider.py` (8 tests: the 4 required, plus the filter, the 409 conflict, and both health-check outcomes)
- `Part D - Survive the Network/` — `provider_client.py` (the hardened call), `stub_provider.py` (stand-in for a real AI provider's `/health` endpoint)
- `Evidence/curl-transcript.txt` — a full `curl -i` session against the live service, including the real outbound call
