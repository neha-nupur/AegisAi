# brief.md

**The AegisAI System Brief**

| | |
|---|---|
| **Course** | CS 543 — Web Services |
| **Project** | AegisAI — Enterprise AI Security & Governance Gateway |
| **Repository** | https://github.com/neha-nupur/AegisAi |
| **Group** | Group 7 — Neha Nupur · Aditi Garg · Shivam Kumar Soni |
| **Architecture** | Modular monolith: six logical services in one Node.js runtime (`apps/api`), with private repositories, isolated data ownership and shared TypeScript contracts (`packages/shared-types`) |

---

## What the system does

AegisAI is an enterprise **AI Security and Governance Gateway**. It sits between an
organisation's own applications — human-facing consoles, developer tools, backend services and
autonomous AI agents — and the external large-language-model providers they want to use
(currently Google Gemini, with OpenAI and mock adapters behind the same interface). Every AI
request is forced through a single, controlled pipeline:

1. verify the JWT (tenant and role),
2. validate the payload against a JSON Schema (AJV, draft-07),
3. check the idempotency key (Redis, 24 h cached response),
4. apply the per-organisation sliding-window rate limit,
5. scan the prompt for PII and secrets and classify its sensitivity,
6. evaluate the organisation's policies (first matching rule wins),
7. route to an eligible, healthy model,
8. call the provider under a 30 s timeout with up to 3 jittered retries and a circuit breaker,
9. sanitise the response,
10. write the request trace, audit event and any security event.

The policy outcome decides what happens next. `ALLOW` and `MASK` continue to routing (`MASK`
replaces sensitive text with placeholders such as `[REDACTED_PHONE]` first). `BLOCK` stops the
request with HTTP 403 and records a security event. `REQUIRE_APPROVAL` pauses it with HTTP 202
until an administrator approves or rejects it. A successful request returns HTTP 201 with the
governed answer and a trace ID.

The model is treated as an *external dependency*; the engineering value of AegisAI is
everything *surrounding* the model — security, privacy, policy, reliability, interoperability
and observability.

The problem it removes is duplication and drift. Without a gateway, every application invents
its own authentication, its own PII rules, its own provider client and its own audit log, and
no two agree. With AegisAI those decisions are made once, in one place, and enforced
uniformly.

## Who uses it

- **Organisation Admin** (`ORGANIZATION_ADMIN`) — manages users, service accounts, settings,
  policies, models and providers; resolves pending approvals; views security events.
- **Developer** (`DEVELOPER`) — submits AI requests over REST or GraphQL, creates service
  accounts for automated agents, and tests prompts in the Privacy Scanner sandbox.
- **Security Auditor** (`SECURITY_AUDITOR`) — read-only oversight of audit events, security
  events and request traces; cannot change policies or models.
- **AI Agent / Service Account** — a machine-to-machine client that authenticates with
  service-account credentials. Its secret is shown once at creation and stored hashed.

## How it is organised

| # | Service | Owner | Data it owns |
|---:|---|---|---|
| 1 | Identity & Access | Neha Nupur | PostgreSQL: `organizations`, `users`, `service_accounts`, `organization_settings` |
| 2 | AI Request Gateway | Aditi Garg | PostgreSQL: `ai_requests`; Redis: `idempotency:*`, `ratelimit:*` |
| 3 | Privacy Scanner | Shivam Kumar Soni | MongoDB: `scanner_results` |
| 4 | Policy & Approval | Aditi Garg | PostgreSQL: `policies`, `approvals` |
| 5 | Model & Provider | Shivam Kumar Soni | PostgreSQL: `providers`, `models` |
| 6 | Security, Audit & Observability | Neha Nupur | MongoDB: `audit_events`, `security_events`, `request_traces` |

No service queries another service's data. They talk only through the public contracts in
`packages/shared-types`.

---

## Nouns — the things and services the system stores state about

| # | Noun | What it is |
|---:|---|---|
| 1 | **Organisation** | The tenant that owns every user, policy, model and setting. Every query is filtered by `organization_id`. |
| 2 | **User** | A human identity with a bcrypt-hashed password and one of three roles. |
| 3 | **Role / Permission** | The RBAC unit that decides who may do what (for example `ai_requests:write`, `policies:read`). |
| 4 | **Service Account (Agent)** | A machine client with its own credentials. |
| 5 | **JWT / Credential** | The HS256 access token (`sub`, `organizationId`, `role`, `permissions`) presented on every call. |
| 6 | **AI Request** | One submission travelling through the pipeline — the central resource. |
| 7 | **Finding / Sensitivity Level** | A detected entity (`PHONE`, `EMAIL`, `CREDIT_CARD`, `API_KEY`, `PASSWORD`) and the resulting level: `LOW`, `MEDIUM`, `HIGH` or `CRITICAL`. |
| 8 | **Policy** | A declarative rule binding a condition to an action: `ALLOW`, `BLOCK`, `MASK` or `REQUIRE_APPROVAL`. First match wins; the default is `BLOCK`. |
| 9 | **Model** | A registered model with an approved sensitivity rank (for example `gemini-3.8-flash`). |
| 10 | **Provider** | An external model host behind an adapter: Gemini, OpenAI, or a mock. |
| 11 | **Approval** | A held request (status `PENDING`) awaiting a human `APPROVE` or `REJECT`. |
| 12 | **Rate-Limit Window** | The per-organisation sliding-window counter in Redis. |
| 13 | **Idempotency Key** | The `Idempotency-Key` header value that makes a retry safe rather than duplicative. |
| 14 | **Security Event** | A durable forensic record of a block or other violation. |
| 15 | **Audit Event** | A record of an administrative change: login, policy update, approval decision. |
| 16 | **Request Trace** | The end-to-end span tree of one request, stored in MongoDB. |
| 17 | **Correlation ID** | The identifier (`x-correlation-id`) that joins every stage and log line of one request. |
| 18 | **Circuit State** | A provider's `CLOSED` / `OPEN` / `HALF-OPEN` availability. |
| 19 | **Legacy Employee** | An HR-directory record reached through SOAP/WSDL instead of REST. |

## Verbs — the actions and contracts the system performs

| # | Verb (operation family) | The contract it exposes |
|---:|---|---|
| 1 | **register / authenticate / authorize** | `POST /v1/auth/signup`, `POST /v1/auth/login`; JWT verification and role checks. |
| 2 | **submit** | `POST /v1/ai-requests` — put one AI request into the pipeline. |
| 3 | **validate** | Reject malformed payloads with HTTP 400 and the exact failing paths. |
| 4 | **deduplicate (idempotency)** | Recognise a replayed `Idempotency-Key` and return the cached original result. |
| 5 | **limit (rate-limit)** | Enforce the per-organisation window; return HTTP 429 with `Retry-After`. |
| 6 | **scan / classify** | Find PII and secrets in the prompt and assign a sensitivity level (`POST /v1/privacy/scan` for the sandbox). |
| 7 | **evaluate / decide** | Apply policy and return `ALLOW`, `BLOCK`, `MASK` or `REQUIRE_APPROVAL`. |
| 8 | **mask / block** | Act on the decision before the provider is contacted. |
| 9 | **approve / reject / resume** | `POST /v1/approvals/:id/approve` or `/reject`; an approval resumes the paused request without re-submission. |
| 10 | **route / select** | Choose an active, healthy model whose approved rank is at least the prompt's sensitivity. |
| 11 | **invoke** | Call the provider under a 30 s timeout, with the key held server-side and sent in a header. |
| 12 | **retry / trip** | Retry transient 429/5xx failures with jittered backoff; open the circuit after 5 consecutive failures and fail fast with HTTP 503. |
| 13 | **sanitise** | Normalise and clean the provider output before it returns to the caller. |
| 14 | **trace / audit / correlate** | Persist every stage under one Correlation ID (`GET /v1/traces`, `/v1/audit-events`, `/v1/security-events`). |
| 15 | **report / query** | Read requests, traces and events over REST (cursor pagination, ETag/304, JSON or XML) and GraphQL (`/v1/graphql`). |
| 16 | **bind / describe / call** | Read the WSDL and invoke SOAP `CheckLegacyEmployee` (`GET /v1/legacy-employees/:employeeId`) with a 5 s timeout, retry and circuit breaker. |

---

## One sentence

**AegisAI takes a single noun — the *AI Request* — and wraps it in sixteen verbs so that an
organisation can say *yes* to using large language models without giving up control of who may
call them, what may leave, and what can be proved afterwards.**

---
