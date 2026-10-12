# AegisAI — System Brief

**Enterprise AI Security & Governance Gateway**
CS 543 — Web Services • Group 7

---

## 1. Purpose

Organizations want to use LLMs and AI agents, but when every application talks to AI providers directly, each one ends up with its own authentication, privacy checks, model selection, retry logic, and logging. The rules become inconsistent, sensitive data can leak to external models, and nobody has a complete record of *why* a request was allowed, changed, or blocked.

**AegisAI** is a centralized **governance gateway** that sits between enterprise applications / AI agents and AI model providers. It does not simply forward prompts. It governs the request *around* the model: who is calling, what the request contains, what policy says about it, which model should serve it, what happened when the provider was called, and what evidence was kept.

The AI model itself is treated as an **external dependency**. The engineering value of AegisAI is the security, policy, routing, reliability, and audit layer around it.

> **Scope note.** This is a course project. The architecture describes six services; the assignments implement and demonstrate specific parts of it (most deeply the Model & Provider service). Privacy scanning is best-effort and pattern-based, not a guarantee of perfect detection.

---

## 2. Actors

| Actor | What they do |
|---|---|
| **Organization Administrator** | Manages organization settings, users, policies, providers, models, and limits. |
| **Developer** | Integrates an application or agent, submits AI requests, and views permitted request history. |
| **Security Auditor** | Reviews security events, policy outcomes, and request traces. |
| **AI Agent / Service Account** | Makes machine-to-machine requests and can access only the capabilities it has been permitted. |

---

## 3. Core Nouns (Resources)

AegisAI has **six core resources**, one owned by each service. Every other concept in the system is a *detail or child record* of one of these six, not a separate top-level resource.

| # | Noun (resource) | Owning service | What it represents |
|---|---|---|---|
| 1 | **Identity** | Identity & Access | A caller's identity within an organization — the organization, its users, and its service accounts, with their roles and credentials. |
| 2 | **AIRequest** | AI Gateway | One governed request submitted by a client or agent, with its status, correlation ID, and final outcome. |
| 3 | **ScanResult** | Privacy Scanner | The outcome of scanning a request for PII, secrets, or sensitive patterns (what was found, and whether it was masked). |
| 4 | **Policy** | Policy & Approval | An organization-defined rule that decides ALLOW / BLOCK / MASK / REQUIRE_APPROVAL / ROUTE, together with any approval decision it triggers. |
| 5 | **Provider** | Model & Provider | An external AI provider (e.g., OpenAI, Gemini, a local model) together with the models it offers and its health/circuit state. |
| 6 | **AuditEvent** | Security Audit | A recorded security event or decision, tied to the request trace through a correlation ID. |

### What is *not* a separate noun

To keep the model small and the ownership clear, these are folded into the six resources above:

| Concept | Lives inside | Why |
|---|---|---|
| Organization, User, Service Account | **Identity** | They are all parts of "who is calling and under which organization." |
| Approval | **Policy** | An approval is the human decision produced by a `REQUIRE_APPROVAL` policy outcome. |
| Model | **Provider** | A model is always registered under, and invoked through, one provider (`/v1/providers/{providerId}/models/{modelId}`). |
| Request Trace / Security Event | **AuditEvent** | Both are audit records of what happened to a request. |
| Provider Health / Circuit State | **Provider** | It describes the state of that provider (`/v1/providers/{providerId}/health`). |

### How the nouns relate

```
Identity ──submits──► AIRequest ──is scanned into──► ScanResult
                          │
                          ├──is evaluated by──► Policy (may produce an approval)
                          │
                          ├──is routed to──► Provider (and one of its models)
                          │
                          └──is recorded as──► AuditEvent
```

---

## 4. Operation Families (Verbs)

Operations are grouped by the service that owns them. There are **twelve** verbs, two per service.

| Service | Verbs | Meaning |
|---|---|---|
| **Identity & Access** | `authenticate`, `authorize` | Confirm who the caller is; decide whether they may perform the action. |
| **AI Gateway** | `submit`, `track` | Accept a governed AI request and coordinate its lifecycle; let the caller check its status and result. |
| **Privacy Scanner** | `scan`, `mask` | Detect sensitive content in a request; redact it when policy requires. |
| **Policy & Approval** | `evaluate`, `decide` | Apply policy to a request (ALLOW / BLOCK / MASK / REQUIRE_APPROVAL / ROUTE); record a human approve/reject decision. |
| **Model & Provider** | `register`, `route-and-invoke` | Register providers and models (plus read, update, remove, health); select an eligible model and call its provider with timeout, retry, and circuit-breaker control. |
| **Security Audit** | `record`, `inspect` | Store security events and traces; let auditors review them. |

Within the Model & Provider service, `register` covers the usual resource operations — create, read, list, update, delete, and discover (`OPTIONS`) — on providers and models. `route-and-invoke` is a processing operation, not ordinary CRUD.

---

## 5. Governed Request Flow

```
Client / AI Agent
      │
      ▼
Receive request, assign Correlation ID
      │
      ▼
Authenticate + authorize            (Identity & Access)
      │
      ▼
Validate request structure          (AI Gateway)
      │
      ▼
Idempotency check + rate limit      (AI Gateway)
      │
      ▼
Scan for PII / secrets              (Privacy Scanner)
      │
      ▼
Evaluate policy                     (Policy & Approval)
      │
      ├── BLOCK ────────────► return controlled error
      ├── REQUIRE_APPROVAL ─► hold for human approve / reject
      ├── MASK ─────────────► redact, then continue
      └── ALLOW / ROUTE
              │
              ▼
      Select eligible model + provider   (Model & Provider)
              │
              ▼
      Invoke provider with timeout / retry / circuit breaker
              │
              ▼
      Filter + validate provider response
              │
              ▼
      Record audit event and trace       (Security Audit)
              │
              ▼
      Return response
```

**Design principle:** a request is never passed to an AI provider before validation, privacy, and policy checks have run. A failure is reported with an honest HTTP status code, never disguised as a `200 OK`.

---

## 6. Services and Ownership

| Service | Owns (noun) | Responsibility |
|---|---|---|
| **Identity & Access** | Identity | Organizations, users, service accounts, authentication, authorization. |
| **AI Gateway** | AIRequest | Main entry point; coordinates validation, idempotency, limits, policy, routing, and the request lifecycle. |
| **Privacy Scanner** | ScanResult | Detects configured sensitive-data patterns; supports masking/redaction. |
| **Policy & Approval** | Policy | Evaluates governance rules; supports ALLOW, BLOCK, MASK, REQUIRE_APPROVAL, ROUTE and approval decisions. |
| **Model & Provider** | Provider | Registers providers and models, exposes capabilities, selects eligible models, invokes providers, reports health. |
| **Security Audit** | AuditEvent | Stores and exposes security events, decisions, and request traces. |

Cross-service communication uses published contracts; each service's storage stays behind its own boundary.

---

## 7. Where Each Noun Appears in the Assignments

| Assignment | Focus | Nouns used |
|---|---|---|
| 1 — HTTP & project setup | Observe HTTP, define the system | All six (defined here) |
| 2 — Services, contracts, schema | Capabilities, ownership, `submitAIRequest`, ER diagram, SQL | All six (one owner each) |
| 3 — SOAP partner | Notify an approver by SMS through a legacy partner | Policy (approval), AIRequest |
| 4 — REST model & implementation | Resource modelling, OpenAPI, Flask / Node implementation | Provider (with its models) |
| 5 — HTTP methods & headers | ETag, If-Match, Idempotency-Key, caching, pagination | Provider |
| 6 — Honest errors & validation | Problem Details errors, field validation, Retry-After | Provider |

Assignments 4–6 deliberately go deep on **one** resource (Provider and its models) instead of spreading across all six.

---

## 8. Technology Roles

| Area | Technology |
|---|---|
| REST implementation | JavaScript / Node.js (Express-style) and Python / Flask |
| Contracts | OpenAPI YAML; WSDL 1.1 / SOAP 1.1 for the partner boundary |
| Data modelling | SQL schema and ER diagram |
| Wider architecture roles | PostgreSQL (business data), MongoDB (traces / documents), Redis (rate limits, short-lived state) |

These are architectural roles; each assignment folder demonstrates only the parts it needs.

---

## 9. Team

| Role | Member | Roll number |
|---|---|---|
| Group Leader | Aditi Garg | 20251651008 |
| Group Member | Neha Nupur | 20251651064 |
| Group Member | Shivam Kumar Soni | 20251651084 |
