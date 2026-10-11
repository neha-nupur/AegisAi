# NOTES.md — Assignment 6: Honest responses, errors & validation

Student: Shivam Kumar Soni · Roll No.: 20251651084
Built on Assignment 5 (`Assignment5/`), which was built on Assignment 4.
Service: Model & Provider · Port 8002 · `transcript.txt` holds the curl evidence.

## 1. Status map (endpoint → success + each failure, one line why)

| Endpoint | Success | Failures (why) |
|---|---|---|
| POST /v1/providers | 201 + Location (a provider was created) | 422 malformed body (shape wrong); 409 duplicate name (state conflict); 401 no bearer; 429 budget spent (retry later); 400 malformed JSON (unparseable) |
| POST .../models | 201 + Location (a model was created) | 422 bad model fields; 404 provider missing; 401; 429 |
| GET /v1/models | 200 (a read) | 400 bad filter/page/sort params (client query wrong); 401; 406 cannot produce asked format; 429 |
| GET single model/provider | 200, or 304 when ETag matches (nothing new to send) | 404 id unknown; 401; 406 |
| PATCH provider | 200 (resource modified) | 422 bad patch fields; 404 unknown; 409 rename clash; 412 stale If-Match (lost race — re-read); 401 |
| DELETE provider | 204 (removed, no body to return) | 404 already gone; 401 |
| POST /v1/route-and-invoke | 200 (provider answered) | 422 bad request shape; 503 no model/provider/circuit (transient, Retry-After → retry); 504 provider timed out (transient); 401 |
| GET .../health | 200 (live reading) | 404 unknown; 401 |
| OPTIONS * | 204 (headers only) | — |

A2 note: no failure ever returns 200 — every error above carries its real
status; the `problem()` helper makes a 200-with-`{ok:false}` impossible.

## 2. Type catalogue (stable strings)

| type | triggers |
|---|---|
| `/errors/invalid-request` | malformed body/query/patch (422), malformed JSON (400), unknown route (404), bad filter (400) |
| `/errors/unauthenticated` | missing/empty Bearer (401) |
| `/errors/not-authorised` | reserved for future RBAC (403) |
| `/errors/provider-not-found`, `/errors/model-not-found` | unknown ids (404) |
| `/errors/provider-conflict` | duplicate provider name (409) |
| `/errors/precondition-failed` | stale If-Match (412) |
| `/errors/no-model-available` | nothing registered / all disabled / no constraint match (503) |
| `/errors/provider-unavailable`, `/errors/circuit-open` | provider down or circuit open (503 + Retry-After) |
| `/errors/provider-timeout` | provider exceeded timeout (504) |
| `/errors/rate-limit-exceeded` | per-client budget spent (429 + Retry-After) |
| `/errors/not-acceptable` | Accept neither JSON nor XML (406) |
| `/errors/internal-error` | mapped catch-all (500, never leaks) |

## 3. One Problem Details body, labelled

```json
{
  "type": "/errors/invalid-request",   // stable machine code (catalogue §2)
  "title": "Invalid request",          // short human summary
  "status": 422,                       // mirrors the HTTP status
  "detail": "Provider configuration is invalid", // what went wrong here
  "errors": [["name","required non-empty string"]], // field-level list (B3)
  "traceId": "20158b0a-..."            // correlation id for the logs
}
```
Served with `Content-Type: application/problem+json; charset=utf-8` (B1/C4).

## 4. Field-level 422 reporting two bad fields at once (C1/C2)

Request: `POST /v1/providers {"name":"","type":"bogus"}` → `422` with
`"errors":[["name","required non-empty string"],["type","must be one of
openai, gemini, local, custom"]]` — validators collect ALL errors before
acting, so one round-trip fixes every field (see `transcript.txt` §B3,
which reports three fields at once).

## 5. Retry-safety (A4)

Safe to retry: every GET (safe+idempotent), DELETE (idempotent),
PATCH-with-same-body + fresh ETag, POST-creates with the SAME
Idempotency-Key, and any request that got 429/503/504 — these carry
`Retry-After` telling the client when to come back. Never retry unchanged:
400/401/404/406/409/412/422 — resending the same bytes returns the same
refusal (fix the request first).

## 6. Internal → clean mapping (B4)

`routeInvoke.js` catch block: the real failure (axios message, stack,
provider URL, latency internals) is `console.error`-logged server-side with
the traceId and NEVER sent out; the client gets `503
provider-unavailable` ("Provider invocation failed") or `504
provider-timeout` ("Provider did not answer in time"). Central handler:
malformed JSON → clean 400; any other throw → logged stack + `500
internal-error` ("Unexpected failure"). No stack trace, DB message, file
path, or credential ever reaches the wire (verify in `transcript.txt`:
every 5xx body is the catalogue shape only).

## 7. JSON vs XML (C3)

Same model, `Accept: application/json` →
`{"modelId":"model-1","name":"gpt-model","providerId":"prov-1",
"providerName":"OpenAI","capabilities":["text-generation"],
"sensitivityLevel":"internal","enabled":true}` with
`Content-Type: application/json; charset=utf-8`;
`Accept: application/xml` →
`<?xml version="1.0" encoding="UTF-8"?><response><modelId>model-1</modelId>
<name>gpt-model</name>...<capabilities><item>text-generation</item>
</capabilities>...</response>` with `Content-Type: application/xml;
charset=utf-8`. `Accept: text/csv` → `406 not-acceptable`
(`transcript.txt` §D3). Default (no Accept) is JSON.

## D4: No regressions

A5 checks re-run inside the jest suite and all hold: idempotent repeat
(201→200 same id), conditional GET 304, conditional write 412, timeout
mapping intact (mocked provider leg), rate-limit + ETag + CORS headers
present. `npx jest` → 6/6 pass.

## Run

```bash
npm install
npm test            # 6 jest tests pass
node transcript.js  # writes transcript.txt (D1+D2+D3+D4 evidence)
```
