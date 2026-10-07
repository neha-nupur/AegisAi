# AegisAI — Assignment 4: Model & Provider Service in REST

This rebuilds the Model & Provider Service (`Provider`, `Model` — owned by
Shivam Kumar Soni in Assignment 2) as a REST API, following the exact same
Part A → B → C → D structure used for CampusEats' Catalogue Service
exercise. If you've already read that project's README, everything below
will look very familiar on purpose.

---

## 1. Folder-by-folder

```
Assignment 4/
├── Part A - Model the Service/
│   └── NOTES.md              ← design: resource table, the routeAndInvoke
│                                hard-choice justification, D3 fallback
│                                reasoning, and the 5 closing Q&A (adapted —
│                                see the note at the top of NOTES.md about
│                                there being no Assignment 3/WSDL yet)
├── Part B - Publish the Contract/
│   ├── openapi.yaml          ← the API contract (written BEFORE any code)
│   └── openapi-validation.txt← proof it validates with zero errors
├── Part C - Implement It/
│   ├── app.py                ← the Flask app
│   ├── models.py              ← Provider / Model record classes
│   ├── store.py                ← in-memory storage (only app.py imports this)
│   ├── errors.py              ← validation functions + the one error shape
│   ├── tests/test_model_provider.py ← 8 automated tests
│   └── pytest-output.txt     ← proof all 8 pass
├── Part D - Survive the Network/
│   ├── provider_client.py    ← hardened outbound call — a real, thin slice
│   │                            of capability C18
│   └── stub_provider.py      ← stand-in for a real AI provider's /health
│                                endpoint
├── Evidence/
│   └── curl-transcript.txt   ← a real curl -i session against the live
│                                service, including the real outbound call
├── requirements.txt
├── setup.bat, run_provider_stub.bat,
│   run_service.bat, run_tests.bat     ← Windows one-click scripts
└── RUNME.md
```

---

## 2. How the files talk to each other

```
tests/test_model_provider.py
        │
        ▼
      app.py  ───imports───►  errors.py   (validate_*() functions, problem())
        │
        ├──imports───►  models.py   (Provider, Model — as_json() strips
        │                            internal-only fields)
        │
        ├──imports───►  store.py    (in-memory dict; the ONLY place data
        │                            lives)
        │
        └──imports───►  provider_client.py   (Part D — lives in a
                          │                    *different* folder; app.py
                          │                    adds that folder to sys.path
                          │                    before importing it)
                          ▼
                    stub_provider.py   (a SEPARATE running process, reached
                                        only over real HTTP, never imported)
```

**What happens on `POST /providers/1/health-check`**, step by step:
1. `app.py` looks up the provider in `store.py`. Not found → `404` via
   `errors.py`'s shared `problem()` shape.
2. It calls `provider_client.check_provider_health(provider.base_url)` —
   Part D's hardened call: a real `GET {base_url}/health`, with a timeout,
   up to 3 attempts, exponential backoff and jitter. This function can
   never raise — it always returns a result dict, healthy or not.
3. `app.py` writes the outcome into the Provider record's own `status` and
   `circuit_state` fields (real columns from `AegisAiSchema.sql`) and
   returns `200` either way — an unreachable provider is *reported*, never
   allowed to fail this endpoint. That's Part D3.
4. The response is built by `provider.as_json()` in `models.py`, never by
   hand — same record/representation split as CampusEats.

---

## 3. How to run it

Identical pattern to CampusEats, just on ports 6000/6001 instead of
5000/5001 (so you can run both projects side by side without a clash).

### One-time setup
Double-click `setup.bat`.

### Every time you want to run the service
- **Window 1:** `run_provider_stub.bat` → wait for
  `Running on http://127.0.0.1:6001`.
- **Window 2:** `run_service.bat` → wait for
  `Running on http://127.0.0.1:6000`.

### Try it (a third terminal)
```
curl -i -X POST http://localhost:6000/providers -H "Content-Type: application/json" -d "{\"name\": \"OpenAI\", \"base_url\": \"http://localhost:6001\"}"
```

### Run the automated tests
Double-click `run_tests.bat` — independent of the two service windows.

---

## 4. What you should see (expected output)

**Registering a provider** (`POST /providers`):
```
HTTP/1.1 201 CREATED
Location: /providers/1

{
  "provider_id": 1,
  "name": "OpenAI",
  "base_url": "http://localhost:6001",
  "status": "healthy",
  "circuit_state": "closed",
  "config_reference": null,
  "created_at": "..."
}
```

**Registering a model, then repeating with the same `Idempotency-Key`** —
both `201`, but the second response has the **identical `created_at`
timestamp** as the first. No duplicate was created.

**The real hardened call** (`POST /providers/1/health-check`, with
`run_provider_stub.bat` running) → `200`, with:
```json
"health_check": {
  "checked": true,
  "latency_ms": 7,
  "note": "Provider responded healthy."
}
```
`latency_ms` is a real measured round-trip — it'll vary run to run. If you
stop `run_provider_stub.bat` and try again, you'll instead get
`"status": "unhealthy"`, `"circuit_state": "open"`, and a note that the
provider was unreachable — **still a `200`**, not an error. That's the
proof Part D3's fallback works: a dead dependency is reported, not allowed
to break the endpoint.

**Setting a model's status to what it already is** (`PATCH
/models/1/status` with `{"is_active": true}` on an already-active model)
→ `409 Conflict`.

**Automated tests** (`run_tests.bat`) → `8 passed`, covering the 4 required
behaviors plus the filter, the 409, and both health-check outcomes
(healthy and unreachable).

---

## 5. Where to look for more detail

- **Why things are designed this way**, including why `routeAndInvoke` was
  deliberately *not* turned into an endpoint → `Part A - Model the
  Service/NOTES.md`
- **The exact API shape** → `Part B - Publish the Contract/openapi.yaml`
- **A full real transcript** → `Evidence/curl-transcript.txt`
