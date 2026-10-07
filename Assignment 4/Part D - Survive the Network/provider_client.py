"""
Outbound call from Model & Provider Service to an actual AI provider.

This is a thin, real slice of capability C18 ("Invoke an AI Provider...
using timeout, retry and circuit-breaker protection") and directly targets
the gap Task 6 flagged: "Independent — Partial. The service ultimately
depends on external AI providers... Retries, timeouts, circuit breakers and
fallback providers reduce, but do not eliminate, this dependency."

Scope note: this implements timeout + retry-with-backoff-and-jitter, and
reflects the outcome into the provider's own `status` and `circuit_state`
fields (a simple two-state closed/open reflection). It deliberately does
NOT implement the full CLOSED/OPEN/HALF-OPEN circuit breaker state machine
promised for AegisAI's Phase 7 — that needs persistent failure-count
tracking across calls, which is out of scope for this REST slice. See
NOTES.md Part D3.

Unlike CampusEats' call to a sibling internal service (resolved from a
single ORDER_SERVICE_URL env var), a provider's address is business data,
not infrastructure config — AegisAI can have many providers, each with its
own base_url already stored in the Provider record itself (schema.sql).
Reading it from the record, not an env var, is the correct choice here.
"""

import random
import time

import requests

DEFAULT_TIMEOUT_SECONDS = 2.0
MAX_ATTEMPTS = 3
BASE_BACKOFF_SECONDS = 0.2


def check_provider_health(base_url: str) -> dict:
    """
    Best-effort GET {base_url}/health. Read-only and idempotent, so every
    attempt is safe to retry. A 4xx is not retried (our own request being
    wrong won't change on a retry); everything else (timeout, connection
    error, 5xx) is retried with exponential backoff and jitter.

    Always returns a dict — never raises — so the caller (app.py) can never
    have this call fail its own write. See NOTES.md Part D3 for why
    degrading, not failing, is correct here too.
    """
    url = f"{base_url.rstrip('/')}/health"

    last_error = None
    for attempt in range(MAX_ATTEMPTS):
        start = time.monotonic()
        try:
            response = requests.get(url, timeout=DEFAULT_TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            last_error = str(exc)
        else:
            latency_ms = int((time.monotonic() - start) * 1000)
            if response.status_code < 400:
                return {
                    "checked": True,
                    "healthy": True,
                    "latency_ms": latency_ms,
                    "note": "Provider responded healthy.",
                }
            if response.status_code < 500:
                last_error = f"Provider returned {response.status_code}"
                break
            last_error = f"Provider returned {response.status_code}"

        if attempt < MAX_ATTEMPTS - 1:
            backoff = BASE_BACKOFF_SECONDS * (2 ** attempt)
            jitter = random.uniform(0, backoff * 0.5)
            time.sleep(backoff + jitter)

    return {
        "checked": True,
        "healthy": False,
        "latency_ms": None,
        "note": f"Provider unreachable or unhealthy ({last_error}).",
    }
