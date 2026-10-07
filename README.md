# AegisAI — Enterprise AI Security & Governance Gateway

## Overview

**AegisAI** is an enterprise-focused **AI Security and Governance Gateway** designed to provide a secure, controlled, reliable, and auditable layer between enterprise applications or AI agents and AI model providers.

Organizations increasingly use Large Language Models (LLMs) and AI agents for business operations, but directly integrating multiple AI models can create challenges related to **security, privacy, access control, policy enforcement, reliability, observability, and cost management**.

AegisAI addresses this problem by acting as a centralized **control plane for enterprise AI requests**.

Instead of allowing every application to implement its own authentication, privacy checks, policy enforcement, model selection, rate limiting, and auditing, these responsibilities are handled through the AegisAI gateway.

The core concept is:

```text
Enterprise Applications / AI Agents
              │
              ▼
        ┌─────────────┐
        │   AegisAI   │
        │   Gateway   │
        └─────────────┘
              │
     ┌────────┼─────────┐
     ▼        ▼         ▼
  Policy   Privacy   Model Router
  Engine   Scanner
     │        │         │
     └────────┼─────────┘
              ▼
       AI Model Providers
      ┌───────┼────────┐
      ▼       ▼        ▼
    OpenAI  Gemini   Local LLM
```

The AI model itself is treated as an external dependency. The primary engineering value of AegisAI is the **security, governance, reliability, interoperability, observability, and data management surrounding the AI model**.

---

# Project Objectives

AegisAI is designed to provide a centralized platform for governing enterprise AI usage.

The major objectives are:

* Secure authentication and authorization for users and AI agents.
* Protect sensitive information before it reaches external AI providers.
* Enforce organization-specific AI policies.
* Control which AI models and providers can be used.
* Support human approval for sensitive requests.
* Select models based on policy, capability, cost, and availability.
* Provide rate limiting and idempotency.
* Handle provider failures using timeout, retry, and circuit-breaker mechanisms.
* Maintain detailed request traces and audit records.
* Provide observability through structured logging and correlation IDs.
* Support multiple data-storage technologies for different types of information.
* Provide REST and GraphQL interfaces.
* Support integration with legacy enterprise systems through SOAP/WSDL.
* Provide a foundation that can be deployed using containerized infrastructure.

The project blueprint specifically positions AegisAI as a **"secure control plane for enterprise AI requests and agents."**

---

# The Problem AegisAI Solves

Organizations want to use AI models and AI agents, but allowing applications to directly communicate with external AI providers can introduce several risks.

For example:

* Sensitive customer information may accidentally be sent to an external model.
* Employees or applications may access models that are not approved by the organization.
* AI provider outages can affect application availability.
* Multiple applications may implement security and policy rules differently.
* Organizations may not have a complete record of AI requests and decisions.
* AI usage can become difficult to monitor and control.
* Repeated requests can unnecessarily increase costs.
* Legacy enterprise systems may not communicate using modern REST APIs.

AegisAI provides a centralized governance layer to address these concerns.

---

# Core Request Flow

One of the most important parts of AegisAI is the controlled AI request pipeline.

A typical request follows this flow:

```text
Client
  │
  ▼
POST /v1/ai-requests
  │
  ▼
JWT Authentication
  │
  ▼
Request Validation
  │
  ▼
Idempotency Check
  │
  ▼
Rate Limit Check
  │
  ▼
PII / Secret Scan
  │
  ▼
Policy Evaluation
  │
  ▼
Model Routing
  │
  ▼
AI Provider
  │
  ├── Timeout
  ├── Retry
  └── Circuit Breaker
  │
  ▼
Response Filtering
  │
  ▼
Audit / Trace Persistence
  │
  ▼
Controlled Response
```

This request flow ensures that an AI request is not simply forwarded directly to a model provider.

Instead, AegisAI evaluates and controls the request before, during, and after the provider interaction.

---

# Major Components

## 1. Identity & Access Management

The Identity Service manages authentication and authorization.

It supports:

* User management
* Organization management
* Service accounts
* JWT authentication
* Role-based access control (RBAC)
* Permission-based access to protected resources

AegisAI supports different types of users and clients, including:

### Organization Administrator

Can manage:

* Organization settings
* Users
* Policies
* Models
* Providers
* Usage limits
* Security settings

### Developer

Can:

* Create or use applications and agents
* Submit AI requests
* View permitted request history
* Inspect traces and usage

### Security Auditor

Can inspect:

* Audit logs
* Security events
* Blocked requests
* Policy decisions
* Compliance-related information

### AI Agent / Service Account

Machine-to-machine clients can authenticate using service-account credentials and access only the models or tools permitted by organizational policies.

---

# 2. AI Gateway

The **AI Gateway** is the central entry point for AI requests.

Its responsibilities include:

* Request validation
* Authentication
* Authorization
* Idempotency
* Rate limiting
* Privacy scanning
* Policy evaluation
* Model routing
* Provider communication
* Response handling
* Audit and trace generation

---

# 3. Privacy Scanner

The Privacy Scanner checks AI requests for potentially sensitive information before they are sent to an external model.

The scanner can detect patterns such as:

* Email addresses
* Phone numbers
* PAN-like identifiers
* Aadhaar-like identifiers
* API keys
* Credentials
* Password fields
* Organization-specific sensitive keywords

Depending on the organization's policy, detected information can result in different actions.

For example:

```text
Sensitive Data Detected
        │
        ├── ALLOW
        │
        ├── MASK
        │
        ├── BLOCK
        │
        └── REQUIRE APPROVAL
```

The project blueprint emphasizes that the privacy scanner is intended to provide **policy-driven handling**, rather than claiming perfect detection of every possible sensitive-data pattern.

---

# 4. Policy Engine

The Policy Engine determines what should happen to an AI request.

Supported policy actions include:

### ALLOW

The request proceeds normally.

### BLOCK

The request is rejected and a security event is generated.

### MASK

Sensitive information is replaced or redacted before the request reaches the AI provider.

### REQUIRE_APPROVAL

The request is held until an authorized person approves it.

### ROUTE

The request is sent to a different model or provider according to the organization's policy.

This allows organizations to create rules based on factors such as:

* User role
* Organization
* Requested model
* Data sensitivity
* Request type
* Provider availability
* Budget or cost limits

---

# 5. Model Router

AegisAI does not need every request to use the same AI model.

The Model Router can select an appropriate model based on:

* Policy
* Model capability
* Data sensitivity
* Cost
* Availability
* Provider health

Example routing:

```text
Simple classification
        ↓
Low-cost model

Complex reasoning
        ↓
Premium model

Sensitive information
        ↓
Approved private/local model

Provider unavailable
        ↓
Healthy fallback provider

Budget exceeded
        ↓
Block or downgrade
```

This allows the gateway to become a centralized decision point for AI model usage.

---

# 6. Reliability Layer

External AI providers can experience:

* Timeouts
* Temporary failures
* Network errors
* Service outages
* Increased latency

AegisAI therefore includes reliability mechanisms such as:

* Explicit outbound timeouts
* Retry with increasing/exponential backoff
* Circuit breakers
* Provider health monitoring
* Fallback providers

The circuit breaker prevents AegisAI from repeatedly sending requests to an unhealthy dependency.

A typical circuit state flow is:

```text
CLOSED
   │
   │ repeated failures
   ▼
 OPEN
   │
   │ recovery check
   ▼
HALF-OPEN
   │
   ├── success ──► CLOSED
   │
   └── failure ──► OPEN
```

---

# 7. Audit & Observability

AegisAI is designed to provide visibility into the complete lifecycle of an AI request.

Each request can be associated with a **correlation ID / trace ID**.

The request can therefore be followed through:

```text
Client
  ↓
Authentication
  ↓
Privacy Scanner
  ↓
Policy Engine
  ↓
Model Router
  ↓
AI Provider
  ↓
Response
  ↓
Database / Audit
```

Structured logs and request traces make it possible to investigate:

* What request was submitted?
* Who submitted it?
* Which policy was applied?
* Was sensitive information detected?
* Which model was selected?
* Which provider was contacted?
* How long did the provider take?
* Did retries occur?
* Was the request blocked?
* Was human approval required?
* What security events were generated?

---

# 8. Approval Workflow

Some AI requests may require human review before execution.

The approval workflow can be represented as:

```text
AI Request
    │
    ▼
Policy Evaluation
    │
    ▼
REQUIRE_APPROVAL
    │
    ▼
Pending Approval
    │
    ├──────────────┐
    ▼              ▼
 APPROVE         REJECT
    │              │
    ▼              ▼
Continue        Stop Request
```

This provides an additional control layer for sensitive or high-risk AI operations.

---

# 9. REST API

The REST API is designed around:

* Correct HTTP methods
* Resource-oriented URLs
* API versioning
* JSON Schema validation
* Consistent error responses
* Rate-limit headers
* Cursor-based pagination
* ETag / `304 Not Modified`
* Cache-Control policies
* JSON and XML content negotiation
* Idempotency keys

---

# 10. GraphQL

GraphQL complements the REST API and is intended primarily for dashboard aggregation.

Instead of requiring the dashboard to make multiple REST requests, GraphQL can retrieve related information in a single query.

For example, an organization overview can contain:

* Organization information
* Agents
* Request counts
* Blocked requests
* Estimated cost
* Security score
* Recent security events

REST remains the primary resource-oriented API, while GraphQL is used where aggregated dashboard information is beneficial.

---

# 11. SOAP / WSDL Integration

AegisAI also includes interoperability with legacy enterprise systems through **SOAP/WSDL**.

The SOAP component demonstrates that the platform can:

1. Read a WSDL contract.
2. Understand the legacy service interface.
3. Make a real SOAP request.
4. Process the response.
5. Apply timeout and resilience handling.
6. Record the interaction for observability.

This allows the project to demonstrate integration between modern web services and legacy enterprise technologies.

---

# 12. Database Architecture

AegisAI uses different types of databases for different types of information.

## PostgreSQL

PostgreSQL is used for structured data such as:

* Organizations
* Users
* Service accounts
* Models
* Providers
* Policies
* AI requests
* Approvals
* Security events

The main service-owned tables include:

| Service                   | Tables                                       |
| ------------------------- | -------------------------------------------- |
| Identity Service          | `organizations`, `users`, `service_accounts` |
| Privacy Scanner Service   | `scanner_results`                            |
| AI Gateway Service        | `ai_requests`                                |
| Policy & Approval Service | `policies`, `approvals`                      |
| Model & Provider Service  | `providers`, `models`                        |
| Security & Audit Service  | `security_events`, `request_traces`          |

## MongoDB

MongoDB is intended for high-volume or less-structured information such as:

* Request traces
* Provider interaction metadata
* Scanner results
* Audit events

## Redis

Redis can be used for:

* Rate-limit counters
* Idempotency records
* Short-lived cache
* Queue support
* Distributed coordination where required

The project blueprint specifically separates structured PostgreSQL data from high-volume/unstructured MongoDB data and short-lived Redis state.

---

# Security Design

Security is a core part of AegisAI.

The project follows principles such as:

* JWT authentication
* Role-based authorization
* Password hashing
* Input validation
* Parameterized SQL queries
* Deliberate CORS configuration
* Rate limiting
* HTTPS deployment
* Environment-based configuration
* Secret redaction
* Secure logging
* Protection of sensitive request information

Sensitive credentials such as API keys, database credentials, JWT secrets, and passwords should never be committed to the repository.

AegisAI also treats external AI provider responses as untrusted data and avoids logging raw passwords, API keys, or full sensitive prompts.

---

# Assignment 2 Repository Structure

The current repository contains the deliverables for **Assignment 2**.

```text
AegisAi/
│
└── Assignment 2/
    │
    ├── Task 1, 3, 4, 6/
    │   └── AegisAi.pdf
    │
    ├── Task 2/
    │   ├── AegisAIServices.drawio
    │   └── AegisAIServices.drawio.png
    │
    └── Task 5/
        ├── AegisAiSchema.sql
        ├── AegisAiSchema.png
        └── AegisAiSchema.drawio
```

### Task 1, 3, 4, 6

The `Task 1, 3, 4, 6` folder contains:

```text
AegisAi.pdf
```

This document contains the deliverables and documentation associated with Tasks 1, 3, 4, and 6.

---

## Task 2 — AegisAI Service Architecture

The `Task 2` folder contains the service architecture diagram:

```text
Task 2/
├── AegisAIServices.drawio
└── AegisAIServices.drawio.png
```

### `AegisAIServices.drawio`

Editable Draw.io source file for the AegisAI service architecture.

### `AegisAIServices.drawio.png`

PNG representation of the service architecture for easy viewing.

The architecture represents the major AegisAI services and their responsibilities.

---

## Task 5 — AegisAI Database Schema

The `Task 5` folder contains the database design:

```text
Task 5/
├── AegisAiSchema.sql
├── AegisAiSchema.png
└── AegisAiSchema.drawio
```

### `AegisAiSchema.sql`

SQL implementation of the AegisAI database schema.

### `AegisAiSchema.png`

Visual representation of the database schema.

### `AegisAiSchema.drawio`

Editable Draw.io source file for the database schema.

The database design follows the service ownership model used by the AegisAI architecture.

---

# Architecture Layers

AegisAI can be viewed as five major layers.

### 1. Client Layer

Contains:

* Web dashboard
* Example applications
* AI-agent clients

### 2. Web Service Layer

Contains:

* Express REST API
* GraphQL endpoint
* OpenAPI specification
* Swagger documentation

### 3. AI Control Layer

Contains:

* Authentication
* Policy engine
* Privacy scanner
* Secret detection
* Model router
* Rate limiter
* Approval workflow

### 4. Integration Layer

Connects AegisAI with:

* AI model providers
* Local models
* Legacy SOAP/WSDL systems
* Optional external integrations

### 5. Data & Operations Layer

Contains:

* PostgreSQL
* MongoDB
* Redis
* Background workers
* Logs
* Tests
* Docker
* Deployment infrastructure

This layered view is described in the project blueprint and helps separate the responsibilities of the AegisAI platform.

---

# Example Controlled AI Request

A typical request can look like:

```http
POST /v1/ai-requests
Authorization: Bearer <JWT>
Idempotency-Key: req_2026_0001
Content-Type: application/json
```

```json
{
  "modelPreference": "auto",
  "policyId": "policy_default",
  "input": "Summarize this customer support message..."
}
```

A successful request may return:

```http
HTTP/1.1 202 Accepted
X-Correlation-ID: 6b1c...
Cache-Control: no-store
```

```json
{
  "id": "air_12345",
  "status": "queued",
  "next": "/v1/ai-requests/air_12345"
}
```

If a policy violation occurs, AegisAI can return a controlled response such as:

```json
{
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "The selected model is not approved for sensitive data.",
    "details": {
      "policyId": "policy_12"
    },
    "traceId": "6b1c..."
  }
}
```

---

# Observability Example

AegisAI uses correlation IDs to connect events belonging to the same request.

```text
Request Received
      │
      ▼
Correlation ID Generated
      │
      ▼
Authentication
      │
      ▼
Privacy Scan
      │
      ▼
Policy Evaluation
      │
      ▼
Model Routing
      │
      ▼
Provider Request
      │
      ▼
Response
      │
      ▼
Audit / Trace Storage
```

This makes it possible to investigate the complete lifecycle of a request from a single identifier.

---

# Testing & Reliability

The project is designed to include automated tests for both successful and failure scenarios.

Important scenarios include:

* Valid AI request
* Missing required fields
* Invalid data types
* Missing JWT
* Incorrect role
* Unknown resource
* Duplicate idempotency key
* Conflicting idempotency key
* Rate-limit exceeded
* Conditional GET with `304`
* Provider temporary failure
* Provider repeated failure
* SOAP timeout
* Circuit-breaker activation

The project blueprint recommends **Jest and Supertest** for automated unit and API integration testing.

---

# Project Scope

AegisAI is designed as a **course and portfolio project demonstrating enterprise AI infrastructure concepts**.

It should not be presented as a certified enterprise security product or as providing perfect protection against all AI security threats.

For example, privacy detection in the initial implementation is best-effort and based on configured patterns and policies. More advanced detection can be introduced in future versions.

---

# Assignment 2 Deliverables

This repository currently focuses on the Assignment 2 design and documentation deliverables:

* Project documentation
* Service architecture
* Database schema
* Architecture diagrams
* Editable Draw.io diagrams
* SQL database schema

Additional implementation files and deliverables can be added as the AegisAI project progresses.

---

# Project Vision

The goal of AegisAI is not simply to build another application that calls an AI model.

The goal is to build a **governance and control layer around enterprise AI usage**.

The core idea can be summarized as:

```text
                    AEGISAI
       Enterprise AI Security & Governance
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   SECURITY         GOVERNANCE      RELIABILITY
       │               │                │
   JWT/RBAC       Policy Engine     Timeout
   Privacy        Approvals         Retry
   Secrets        Model Rules       Circuit Breaker
       │               │                │
       └───────────────┼────────────────┘
                       │
                 AI MODEL PROVIDERS
```

AegisAI therefore acts as the **secure control plane between enterprise AI consumers and the AI infrastructure they depend on**.

---

# Team Members

AegisAI is a collaborative project developed by the following three team members:

| S. No. | Team Member           | Student ID    |
| -----: | --------------------- | ------------- |
|      1 | **Aditi Garg**        | `20251651008` |
|      2 | **Neha Nupur**        | `20251651064` |
|      3 | **Shivam Kumar Soni** | `20251651084` |

All three members collaboratively contribute to the design, documentation, architecture, database design, and development of the AegisAI project.

---

## Project Information

**Project:** AegisAI
**Title:** Enterprise AI Security & Governance Gateway
**Course:** Web Services / Distributed Systems
**Assignment:** Assignment 2
**Architecture:** Service-oriented / Microservices-based
**Team Size:** 3 Members
**Primary Focus:** AI Security, Governance, Privacy, Reliability, Observability and Enterprise Integration
