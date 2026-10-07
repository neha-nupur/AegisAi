"""
AegisAI Model & Provider Service — REST implementation for Assignment 4.

Rebuilds the Model & Provider Service (Provider, Model — owned by Shivam
Kumar Soni in Assignment 2) as REST, matching the resource table in
NOTES.md Part A4 and the contract in openapi.yaml.
"""

import os
import sys

from flask import Flask, request, jsonify

from models import Provider, Model, now_iso
from store import store
from errors import (
    DomainError,
    NotFound,
    Conflict,
    error_response,
    validate_provider_create,
    validate_model_create,
    validate_model_status_update,
)

# provider_client.py lives in the sibling "Part D - Survive the Network"
# folder (this project is organised by assignment part, not by Python
# package). Resolved relative to this file's own location, so it works no
# matter which directory you launch app.py or pytest from — same pattern
# already verified working in the CampusEats Assignment 4 by-part layout.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_PART_D_DIR = os.path.join(_THIS_DIR, "..", "Part D - Survive the Network")
sys.path.insert(0, _PART_D_DIR)

from provider_client import check_provider_health  # noqa: E402

app = Flask(__name__)


@app.errorhandler(DomainError)
def handle_domain_error(exc: DomainError):
    body, status = error_response(exc)
    return jsonify(body), status


# -------------------------------------------------------------- /providers

@app.post("/providers")
def register_provider():
    body = request.get_json(silent=True)
    fields = validate_provider_create(body)

    provider_id = store.next_provider_id()
    provider = Provider(
        provider_id=provider_id,
        name=fields["name"],
        base_url=fields["base_url"],
        status="healthy",
        circuit_state="closed",
        config_reference=fields["config_reference"],
        created_at=now_iso(),
    )
    store.providers[provider_id] = provider

    response = jsonify(provider.as_json())
    response.status_code = 201
    response.headers["Location"] = f"/providers/{provider_id}"
    return response


@app.get("/providers/<int:provider_id>")
def get_provider(provider_id: int):
    provider = store.get_provider(provider_id)
    if provider is None:
        raise NotFound(f"No provider with id {provider_id}.")
    return jsonify(provider.as_json()), 200


# ------------------------------------------------- /providers/{id}/models

@app.post("/providers/<int:provider_id>/models")
def register_model(provider_id: int):
    provider = store.get_provider(provider_id)
    if provider is None:
        raise NotFound(f"No provider with id {provider_id}.")

    idempotency_key = request.headers.get("Idempotency-Key")
    if idempotency_key:
        cached = store.get_idempotent_result(idempotency_key)
        if cached is not None:
            response = jsonify(cached["body"])
            response.status_code = cached["status_code"]
            response.headers["Location"] = cached["location"]
            return response

    body = request.get_json(silent=True)
    fields = validate_model_create(body)

    model_id = store.next_model_id()
    model = Model(
        model_id=model_id,
        provider_id=provider_id,
        name=fields["name"],
        type=fields["type"],
        sensitivity_level=fields["sensitivity_level"],
        cost_metadata=fields["cost_metadata"],
        is_active=True,
        created_at=now_iso(),
        idempotency_key=idempotency_key,
    )
    store.models[model_id] = model

    body_json = model.as_json()
    location = f"/models/{model_id}"

    if idempotency_key:
        store.save_idempotent_result(
            idempotency_key,
            {"status_code": 201, "body": body_json, "location": location},
        )

    response = jsonify(body_json)
    response.status_code = 201
    response.headers["Location"] = location
    return response


@app.get("/providers/<int:provider_id>/models")
def list_models(provider_id: int):
    provider = store.get_provider(provider_id)
    if provider is None:
        raise NotFound(f"No provider with id {provider_id}.")

    models = store.models_for_provider(provider_id)

    active_param = request.args.get("active")
    if active_param is not None:
        want_active = active_param.lower() == "true"
        models = [m for m in models if m.is_active == want_active]

    return jsonify([m.as_json() for m in models]), 200


# --------------------------------------------------- /models/{id}/status

@app.patch("/models/<int:model_id>/status")
def set_model_status(model_id: int):
    model = store.get_model(model_id)
    if model is None:
        raise NotFound(f"No model with id {model_id}.")

    body = request.get_json(silent=True)
    fields = validate_model_status_update(body)
    requested = fields["is_active"]

    if model.is_active == requested:
        raise Conflict(
            f"Model {model_id} is already {'active' if requested else 'inactive'}."
        )

    model.is_active = requested
    return jsonify(model.as_json()), 200


# ------------------------------------------- /providers/{id}/health-check

@app.post("/providers/<int:provider_id>/health-check")
def check_provider(provider_id: int):
    provider = store.get_provider(provider_id)
    if provider is None:
        raise NotFound(f"No provider with id {provider_id}.")

    # Real, hardened outbound call — see provider_client.py (Part D).
    # This can never raise, so it can never fail this endpoint's own write.
    result = check_provider_health(provider.base_url)

    provider.status = "healthy" if result["healthy"] else "unhealthy"
    provider.circuit_state = "closed" if result["healthy"] else "open"

    body = provider.as_json()
    body["health_check"] = {
        "checked": result["checked"],
        "latency_ms": result["latency_ms"],
        "note": result["note"],
    }
    return jsonify(body), 200


if __name__ == "__main__":
    app.run(port=6000, debug=True)
