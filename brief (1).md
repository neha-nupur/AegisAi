# brief.md

**The AegisAI System Brief**

| | |
|---|---|
| **Course** | CS 543 — Web Services |
| **Project** | AegisAI — Enterprise AI Security & Governance Gateway |
| **Repository** | https://github.com/neha-nupur/AegisAi |
| **Group** | Group 7 |
| **Covers** | Assignments 1–6 (HTTP by hand → services and contracts → SOAP partner → REST Model & Provider service → HTTP methods and headers → honest responses, errors and validation) |

| Role | Team member | Roll number |
|---|---|---|
| Group Leader | Aditi Garg | 20251651008 |
| Group Member | Neha Nupur | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |

---

## What the system does

AegisAI is an enterprise **AI Security and Governance Gateway**. It sits between an
organisation's own applications — human-facing consoles and autonomous AI agents — and the
external large-language-model providers those applications want to use (OpenAI, Gemini, a
local LLM). Every AI request is forced through one controlled pipeline:

1. receive the request and assign a **Correlation ID**,
2. authenticate the caller and check permissions,
3. validate the request structure and fields,
4. check idempotency and rate limits,
5. scan for PII, secrets and other sensitive content,
6. evaluate the organisation's policy,
7. select an eligible model and provider,
8. invoke the provider under an explicit timeout, with retry and circuit-breaker controls,
9. filter and validate the provider's response,
10. record an audit event and trace, then return the response.

The policy step decides what happens next:

| Decision | Effect |
|---|---|
| `BLOCK` | Stop with a controlled error; record a security event. |
| `REQUIRE_APPROVAL` | Hold the request for a human to approve or reject. |
| `MASK` | Redact the sensitive values, then continue. |
| `ALLOW` / route | Continue to model and provider selection. |

**Design principle.** A request must never reach an AI provider before validation, privacy and
policy checks have run, and a failure must be reported honestly with an appropriate HTTP status
rather than disguised as a successful response.

The model is treated as an *external dependency*. The engineering value of AegisAI is everything
*surrounding* the model — security, privacy, policy, reliability, interoperability,
observability and cost control — rather than merely forwarding prompts.

The problem it removes is duplication and drift. Without a gateway, every application invents
its own authentication, its own PII rules, its own provider client, its own retry behaviour and
its own audit log, and no two agree. With AegisAI those decisions are made once, in one place,
and enforced uniformly.

## Project goals

- Authenticate callers and apply role- or permission-based access control.
- Validate requests before processing them.
- Detect or mask sensitive information before it reaches a provider.
- Apply organisation-defined policy decisions, with approval workflows for requests that need human review.
- Select a model by capability, sensitivity, policy, cost and provider health.
- Reduce duplicate processing with idempotency controls; enforce request limits with predictable HTTP responses.
- Handle provider failures with timeouts, retries and circuit-breaker behaviour.
- Preserve audit records and correlation identifiers for troubleshooting.
- Describe both modern REST interfaces and a legacy SOAP/WSDL partner boundary.

## Who uses it

- **Organisation Administrator** — configures the organisation, users, access, policies, models,
  providers, usage limits and security settings.
- **Developer** — integrates an application or agent, submits AI requests, and reads permitted
  request history, traces and usage.
- **Security Auditor** — inspects audit logs, security events, blocked requests, policy outcomes,
  traces and compliance evidence; cannot submit requests or change policies or models.
- **AI Agent / Service Account** — a machine-to-machine client that authenticates with
  service-account credentials and may reach only the capabilities its policy permits.

## Service architecture

Responsibilities are separated into six services so each capability has a clear owner. They
communicate through published contracts, and each service's storage stays behind its own
boundary.

| # | Service | Responsibility | Typical store |
|---:|---|---|---|
| 1 | **Identity & Access** | Organisations, users, service accounts, authentication and authorisation. | PostgreSQL |
| 2 | **AI Gateway** | Main entry point; coordinates validation, idempotency, limits, policy, routing and the request lifecycle. | PostgreSQL, Redis |
| 3 | **Privacy Scanner** | Detects configured sensitive-data patterns; supports masking and redaction decisions. | MongoDB |
| 4 | **Policy & Approval** | Evaluates governance rules (`ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL`) and routing decisions; runs the approval workflow. | PostgreSQL |
| 5 | **Model & Provider** | Registers providers and models, exposes their capabilities, selects eligible models, invokes providers, reports provider health. | PostgreSQL |
| 6 | **Security Audit** | Stores and exposes security events, decisions, request traces and investigation evidence. | MongoDB |

PostgreSQL holds relational and business data, MongoDB holds document and trace-oriented data,
and Redis holds rate-limit and other short-lived coordination state. These are architectural
roles; the datastore actually used depends on the assignment component being demonstrated.

---

## Nouns — the things and services the system stores state about

| # | Noun | What it is |
|---:|---|---|
| 1 | **Organisation** | The tenant that owns every policy, user, model and quota. |
| 2 | **User** | A human identity with a role and permissions. |
| 3 | **Role / Permission** | The RBAC unit that decides who may do what. |
| 4 | **Service Account (Agent)** | A machine client with its own credentials and scope. |
| 5 | **Credential / API Key / JWT** | The proof of identity presented on every call. |
| 6 | **Application** | A named consumer that submits AI requests. |
| 7 | **AI Request** | One submission travelling through the pipeline — the central resource. |
| 8 | **Privacy Rule / Finding** | A detectable sensitive construct (email, phone, card number, secret, keyword) and the finding it produces. |
| 9 | **Policy** | A named rule binding a condition to an action: `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL`, or a routing decision. |
| 10 | **Model** | A registered model with capabilities, reachable through a provider. |
| 11 | **Provider** | An external model host: OpenAI, Gemini, a local LLM. |
| 12 | **Routing Decision** | The record of which model was chosen and why. |
| 13 | **Approval Request** | A held request awaiting a human `APPROVE` or `REJECT`. |
| 14 | **Rate Limit / Quota / Budget** | The ceiling on requests, tokens or spend. |
| 15 | **Idempotency Key** | The token that makes a retry safe rather than duplicative. |
| 16 | **Security Event** | A durable record of a block, mask, anomaly or violation. |
| 17 | **Audit Record / Trace** | The end-to-end history of one request. |
| 18 | **Correlation (Trace) ID** | The identifier that joins every stage of one request together. |
| 19 | **Health / Circuit State** | A provider's `CLOSED` / `OPEN` / `HALF-OPEN` availability. |
| 20 | **Usage Report / Dashboard** | Aggregated counts, cost and security score. |
| 21 | **Legacy Partner Service** | An external system reached through SOAP/WSDL instead of REST. |
| 22 | **ETag / Representation Version** | The validator that makes caching and conditional updates safe. |
| 23 | **Error Body** | A machine-readable error (`type`, `title`, `status`, `detail`, plus field-level errors) that never leaks internals. |

## Verbs — the actions and contracts the system performs

| # | Verb (operation family) | The contract it exposes |
|---:|---|---|
| 1 | **register / authenticate / authorize** | Prove identity (JWT, service account) and grant or deny access by role. |
| 2 | **submit / place** | `POST /v1/ai-requests` — put one AI request into the pipeline. |
| 3 | **validate** | Reject malformed or invalid payloads before any work is done. |
| 4 | **deduplicate (idempotency)** | Recognise a replayed `Idempotency-Key` and return the original result. |
| 5 | **limit (rate-limit)** | Enforce per-caller and per-organisation ceilings; answer `429` with `Retry-After`. |
| 6 | **scan / detect** | Find sensitive data in the request and response. |
| 7 | **evaluate / decide** | Apply policy and return `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL` or a routing decision. |
| 8 | **mask / redact / block** | Act on the decision before the provider is contacted. |
| 9 | **approve / reject** | Resolve a held request from an authorised human. |
| 10 | **route / select** | Choose model and provider by policy, capability, sensitivity, cost and health (`POST /v1/route-and-invoke`). |
| 11 | **invoke / forward** | Call the provider under an explicit timeout. |
| 12 | **retry / trip** | Recover from transient failure with backoff; open the circuit breaker when a provider keeps failing. |
| 13 | **filter** | Sanitise and validate the response before it returns to the caller. |
| 14 | **trace / audit / correlate** | Persist every stage under one Correlation ID. |
| 15 | **report / query** | Read usage, security events and dashboards, with filtering, sorting and pagination. |
| 16 | **bind / describe / discover** | Read a WSDL contract, form the SOAP call, locate a partner endpoint, and translate partner faults into AegisAI-level errors. |
| 17 | **create / read / update / delete** | Use the correct method per resource (`POST`, `GET`, `PATCH`, `DELETE`, `OPTIONS`); return `201` with `Location`, `204` for no content. |
| 18 | **condition (cache / guard)** | `ETag` with `If-None-Match` → `304 Not Modified`; `If-Match` → `412 Precondition Failed` for stale updates. |
| 19 | **negotiate / explain** | Honour `Accept` (JSON or XML, else `406`); return distinct, honest error statuses with retry guidance. |

---

## Assignment coverage

The assignments form a progression from protocol observation to service design and implementation.

| # | Assignment | What it delivers | Where |
|---:|---|---|---|
| 1 | **HTTP by Hand & Project Setup** | Annotated `curl -i` exchanges, analysis of a real page load, the project README and this brief. | `docs/http-log.md`, `docs/network-analysis.md`, `README.md`, `brief.md` |
| 2 | **Services, Contracts & Schema** | Capability catalogue, service ownership, service contracts, the central `submitAIRequest` operation, service-property validation, service architecture diagram, ER diagram and SQL schema. | `Assignment 2/Task 1, 3, 4, 6/AegisAi.pdf`, `Task 2/AegisAIServices.drawio(.png)`, `Task 5/AegisAiERDiagram.drawio(.png)`, `Task 5/AegisAiSchema.sql` |
| 3 | **Integrate an External SOAP Partner** | A WSDL 1.1 contract for a hypothetical *Meridian Messaging* SMS partner. Its `sendSMS` operation notifies an approver when an AI request awaits approval. Includes example request, response and fault, discovery entry and fault mapping. | `Assignment 3/` (`integration.pdf`, `partner.wsdl`, `soap-request.xml`, `soap-response.xml`, `soap-fault.xml`, `verification.txt`) |
| 4 | **Model the Service, Publish the Contract, Implement It, Survive the Network** | REST resource model for Model & Provider, OpenAPI contract, implementation with validation, a provider client with timeouts and retries, and tests. Built twice: Python/Flask and JavaScript. | `Assignment 4/` (Python/Flask, Parts A–D, evidence); `Assignment-4(Model-and-Provider)/` (JavaScript baseline) |
| 5 | **HTTP Methods & Headers** | Correct method semantics, `Location` on creation, `ETag` / `If-None-Match` / `304`, `If-Match` / `412`, `Idempotency-Key`, filtering, sorting and pagination, `Allow`, CORS preflight and documented method-override behaviour. | `Assignment5/` |
| 6 | **Honest Responses, Errors & Validation** | Clear separation of malformed input, invalid fields, missing resources and state conflicts; Problem Details-style error bodies; field-level errors; safe error exposure; `Retry-After`; JSON/XML negotiation. | `Assignment6/` |

Boundaries worth stating:

- Assignment 3 is a **design-time** integration exercise. It does not claim a live Meridian service or a running AegisAI SOAP endpoint.
- Assignments 4–6 implement the **Model & Provider** service concretely. The other services are specified in the design (Assignment 2) rather than each shipped as a separate deployed product.
- For the exact request and response schemas of any endpoint, the `openapi.yaml` in that assignment's folder is the source of truth, because the API evolves between assignments.

## Model & Provider service API (Assignments 4–6, JavaScript, `/v1`)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/v1/providers` | Register a provider (`201 Created` with `Location`). |
| `GET` | `/v1/providers/{providerId}` | Retrieve a provider. |
| `PATCH` | `/v1/providers/{providerId}` | Partially update a provider, subject to precondition rules. |
| `DELETE` | `/v1/providers/{providerId}` | Remove a provider and its models where applicable. |
| `POST` | `/v1/providers/{providerId}/models` | Register a model under a provider. |
| `GET` | `/v1/models` | List models, with filtering, sorting and pagination. |
| `GET` | `/v1/providers/{providerId}/models/{modelId}` | Retrieve a model. |
| `POST` | `/v1/route-and-invoke` | Select a suitable model and invoke its provider. |
| `GET` | `/v1/providers/{providerId}/health` | Read provider health and circuit state. |
| `OPTIONS` | `/v1/providers`, `/v1/models` | Discover supported methods. |

`POST /v1/route-and-invoke` is a processing operation, not ordinary CRUD. It selects an eligible
model at invocation time, applies the request and policy constraints, and calls the provider
through a client that enforces timeouts, retries and circuit-breaker behaviour. If a provider
cannot return a valid result, the service returns an explicit failure rather than inventing a
model completion.

## HTTP behaviour

| Status | Meaning in this project |
|---|---|
| `200 OK` | A read, update, health response or processing operation completed. |
| `201 Created` | A provider or model was created; `Location` identifies it. |
| `204 No Content` | Success without a body, such as a deletion or an `OPTIONS` response. |
| `304 Not Modified` | The client's cached representation is still current. |
| `400 Bad Request` | The request cannot be parsed, or its query parameters are malformed. |
| `401 Unauthorized` | Authentication is missing or invalid. |
| `404 Not Found` | The resource or route does not exist. |
| `406 Not Acceptable` | No representation matches the `Accept` header. |
| `409 Conflict` | The request conflicts with existing state, such as a duplicate provider name. |
| `412 Precondition Failed` | A conditional update failed because its `If-Match` was stale. |
| `422 Unprocessable Content` | The body is well-formed but fails field or semantic validation. |
| `429 Too Many Requests` | The caller's request budget or rate limit was exceeded. |
| `503 Service Unavailable` | No suitable model, a provider is unavailable, or a circuit is open. |
| `504 Gateway Timeout` | A provider did not respond within the configured timeout. |

The key rule: **a failed request must never be disguised as `200 OK`.** The exact status for a
given validation case follows that assignment version's contract.

- `Idempotency-Key` makes repeated creation requests safe when the same key and request are replayed.
- `ETag` and `If-None-Match` let clients avoid downloading unchanged representations.
- `If-Match` stops a client silently overwriting a newer representation.
- `Retry-After` says when to retry a rate-limit or temporary-service failure.
- `GET` and `OPTIONS` are safe; retry-safety for state-changing requests depends on the method and the contract.

**Security and privacy.** Keep credentials and API keys in environment variables, never in the
repository. Keep error responses free of stack traces, file paths, credentials and internal
provider details. Validate fields before using them in routing or persistence. Treat privacy
scanning and policy enforcement as controls that reduce risk, not as a guarantee of perfect
detection.

## Technology

| Area | Used |
|---|---|
| REST service | JavaScript / Node.js with Express-style modules; Python / Flask for the separate Assignment 4 implementation. |
| API contracts | OpenAPI YAML. |
| SOAP integration design | WSDL 1.1, SOAP 1.1, XML, XSD, SOAP faults, WS-Security examples. |
| Data modelling | SQL schema and entity-relationship diagram. |
| Test evidence | Automated service tests, contract validation output, `curl` transcripts. |
| Wider architecture | PostgreSQL, MongoDB, Redis, external AI providers, audit/trace storage, containerised deployment concepts. |
| Diagrams and documents | Draw.io, Markdown, PDF, XML, SQL, YAML. |

A technology appearing in the wider architecture does not mean every assignment folder
configures or deploys it independently.

## Evidence

Recorded results are included with the submitted files. They are not a claim that every folder
has been executed in the current environment.

- **Assignment 3:** `verification.txt` records **27 passed, 0 failed** (WSDL structure, XML schema conformance, request element order, WS-Security signature and digest checks, SOAP fault structure).
- **Assignment 4 (Python):** `Part C - Implement It/pytest-output.txt` records **8 passed** (creation, idempotent replay, malformed bodies, unknown IDs, conflicts, filtered model lists, provider health).
- **Assignment 4 (OpenAPI):** `Part B - Publish the Contract/openapi-validation.txt` records the contract validation result.
- **Assignments 4–6 (JavaScript):** each folder carries its own test suite, plus `curl-transcript.txt` or `transcript.txt` and `NOTES.md`.

## Running the Model & Provider service

- **Python/Flask (Assignment 4):** in `Assignment 4/`, run `setup.bat` once, start the provider stub with `run_provider_stub.bat` (port 6001), start the service with `run_service.bat` (port 6000), and run `run_tests.bat`. See `RUNME.md`.
- **JavaScript (Assignments 4–6):** each folder is a self-contained iteration. From the folder you want to test, run `npm install` then `npm test`, using the scripts in that folder's `package.json`. Compare behaviour with its transcript and read its `NOTES.md` and `openapi.yaml`.

---

## Wider reference implementation (separate technical reference)

The team's *Complete Technical & Presentation Reference* describes a fuller build of the same
design as a **modular monolith**: six logical services in one Node.js/TypeScript runtime
(`apps/api`), with private repositories, isolated data ownership and shared contract types.
It is a different artefact from the assignment folders above, and it goes further than they do:

- **Request path:** JWT auth → AJV draft-07 validation → Redis idempotency (24 h cache) → per-organisation sliding-window rate limit → privacy scan → first-match policy → sensitivity-based model routing → provider call (30 s timeout, up to 3 jittered retries, circuit breaker that opens after 5 consecutive failures and probes again after 30 s) → sanitisation → trace and audit.
- **Roles:** `ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`, plus service accounts.
- **Privacy scanner:** detects phone numbers, emails, card numbers, API keys and passwords, and classifies sensitivity `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`. Routing sends a prompt only to models whose approved rank is at least the prompt's sensitivity.
- **Storage:** PostgreSQL for tenants, users, requests, policies, approvals, providers and models; MongoDB for scan results, traces, security events and audit events; Redis for idempotency and rate limiting.
- **API surface:** REST under `/v1` with OpenAPI and Swagger UI, plus GraphQL at `/v1/graphql`.
- **SOAP:** a live SOAP 1.1 client that reads a WSDL and calls `CheckLegacyEmployee` against an HR directory mock, with a 5 s timeout, retry and circuit breaker. This is distinct from the design-time Meridian SMS partner in Assignment 3.
- **Ownership:** Neha Nupur — Identity & Access and Security Audit; Aditi Garg — AI Gateway and Policy & Approval; Shivam Kumar Soni — Privacy Scanner and Model & Provider.

---

## One sentence

**AegisAI takes a single noun — the *AI Request* — and wraps it in a family of verbs so that an
organisation can say *yes* to using large language models without giving up control of who may
call them, what may leave, what it costs, and what can be proved afterwards.**

---
