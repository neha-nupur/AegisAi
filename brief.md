# brief.md

**Assignment 1, Task 4 — The AegisAI System Brief**

| | |
|---|---|
| **Course** | CS 543 — Web Services |
| **Project** | AegisAI — Enterprise AI Security & Governance Gateway |
| **Repository** | https://github.com/neha-nupur/AegisAi |
| **Group** | Group 7 |

---

## What the system does

AegisAI is an enterprise **AI Security and Governance Gateway**. It sits between an
organisation's own applications — human-facing consoles and autonomous AI agents — and the
external large-language-model providers those applications want to use. Every AI request is
forced through a single, controlled pipeline: authenticate the caller, validate the payload,
check idempotency and rate limits, scan the message for sensitive data, evaluate the
organisation's policy, choose a model and provider, call it under an explicit timeout with
retry and circuit-breaking, filter the response, and write an audit record. The model is
treated as an *external dependency*; the engineering value of AegisAI is everything
*surrounding* the model — security, privacy, policy, reliability, interoperability,
observability and cost control.

The problem it removes is duplication and drift. Without a gateway, every application invents
its own authentication, its own PII rules, its own provider client and its own audit log, and
no two agree. With AegisAI those decisions are made once, in one place, and enforced
uniformly.

## Who uses it

- **Organisation Administrator** — configures the organisation, users, policies, models,
  providers, usage limits and security settings.
- **Developer** — creates applications and agents, submits AI requests, and reads permitted
  request history, traces and usage.
- **Security Auditor** — inspects audit logs, security events, blocked requests, policy
  decisions and compliance evidence; has no ability to submit requests.
- **AI Agent / Service Account** — a machine-to-machine client that authenticates with
  service-account credentials and may reach only the models and tools its policy permits.

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
| 8 | **Privacy Rule / Pattern** | A detectable sensitive construct: email, phone, PAN, Aadhaar, secret, keyword. |
| 9 | **Policy** | A named rule binding a condition to an action: `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL`, `ROUTE`. |
| 10 | **Model** | A capability tier — classification, reasoning, generation. |
| 11 | **Provider** | An external model host: OpenAI, Gemini, a local LLM. |
| 12 | **Routing Decision** | The record of which model was chosen and why. |
| 13 | **Approval Request** | A held request awaiting a human `APPROVE` or `REJECT`. |
| 14 | **Rate Limit / Quota / Budget** | The ceiling on requests, tokens or spend. |
| 15 | **Idempotency Key** | The token that makes a retry safe rather than duplicative. |
| 16 | **Security Event** | A durable record of a block, mask, anomaly or violation. |
| 17 | **Audit Record / Trace** | The end-to-end history of one request, keyed by a Correlation ID. |
| 18 | **Correlation (Trace) ID** | The identifier that joins every stage of one request together. |
| 19 | **Health / Circuit State** | A provider's `CLOSED` / `OPEN` / `HALF-OPEN` availability. |
| 20 | **Usage Report / Dashboard** | Aggregated counts, cost and security score. |
| 21 | **Legacy Partner Service** | An enterprise system reached through SOAP/WSDL instead of REST. |

## Verbs — the actions and contracts the system performs

| # | Verb (operation family) | The contract it exposes |
|---:|---|---|
| 1 | **register / authenticate / authorize** | Prove identity (JWT, service account) and grant or deny access by role. |
| 2 | **submit / place** | `POST /v1/ai-requests` — put one AI request into the pipeline. |
| 3 | **validate** | Reject malformed payloads before any work is done. |
| 4 | **deduplicate (idempotency)** | Recognise a replayed key and return the original result. |
| 5 | **limit (rate-limit)** | Enforce per-caller, per-organisation and budget ceilings. |
| 6 | **scan / detect** | Find sensitive data in the request and response. |
| 7 | **evaluate / decide** | Apply policy and return `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL` or `ROUTE`. |
| 8 | **mask / redact / block** | Act on the decision before the provider is contacted. |
| 9 | **approve / reject** | Resolve a held request from an authorised human. |
| 10 | **route / select** | Choose model and provider by policy, capability, cost and health. |
| 11 | **invoke / forward** | Call the provider under an explicit timeout. |
| 12 | **retry / fall back / trip** | Recover from failure with backoff, fallback provider and circuit breaker. |
| 13 | **filter** | Sanitise the response before it returns to the caller. |
| 14 | **trace / audit / correlate** | Persist every stage under one Correlation ID. |
| 15 | **report / query** | Read usage, security events and dashboards (REST, and GraphQL for aggregation). |
| 16 | **bind / describe / discover** | Read a WSDL contract, form the SOAP call, and locate a partner endpoint. |

---

## One sentence

**AegisAI takes a single noun — the *AI Request* — and wraps it in fifteen verbs so that an
organisation can say *yes* to using large language models without giving up control of who may
call them, what may leave, what it costs, and what can be proved afterwards.**
