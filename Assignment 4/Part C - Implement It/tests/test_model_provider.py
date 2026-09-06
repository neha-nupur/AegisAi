import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app as flask_app  # noqa: E402
from store import store  # noqa: E402


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    store.providers.clear()
    store.models.clear()
    store.idempotency.clear()
    store._next_provider_id = 1
    store._next_model_id = 1
    with flask_app.test_client() as c:
        yield c


def _make_provider(client, name="OpenAI", base_url="http://localhost:6001"):
    resp = client.post("/providers", json={"name": name, "base_url": base_url})
    assert resp.status_code == 201
    return resp.get_json()["provider_id"]


def test_create_succeeds_with_right_code_and_location_header(client):
    resp = client.post(
        "/providers/{}/models".format(_make_provider(client)),
        json={"name": "gpt-4o", "type": "chat"},
        headers={"Idempotency-Key": "test-key-1"},
    )
    assert resp.status_code == 201
    assert resp.headers["Location"] == "/models/1"
    body = resp.get_json()
    assert body["name"] == "gpt-4o"
    assert body["type"] == "chat"
    assert body["is_active"] is True
    assert "created_by" not in body
    assert "idempotency_key" not in body


def test_idempotent_repeat_returns_original_result(client):
    provider_id = _make_provider(client)
    payload = {"name": "gpt-4o", "type": "chat"}
    headers = {"Idempotency-Key": "same-key"}

    first = client.post(f"/providers/{provider_id}/models", json=payload, headers=headers)
    second = client.post(
        f"/providers/{provider_id}/models",
        json={"name": "totally-different-model", "type": "embedding"},
        headers=headers,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.get_json() == second.get_json()
    assert second.get_json()["name"] == "gpt-4o"
    assert len(store.models) == 1


def test_malformed_body_returns_422(client):
    provider_id = _make_provider(client)
    resp = client.post(
        f"/providers/{provider_id}/models",
        json={"name": "", "type": "chat"},
    )
    assert resp.status_code == 422
    body = resp.get_json()
    assert body["status"] == 422
    assert body["code"] == "validation_failed"
    assert "type" in body and "title" in body and "detail" in body


def test_unknown_id_returns_404(client):
    resp = client.get("/providers/999")
    assert resp.status_code == 404
    body = resp.get_json()
    assert body["status"] == 404
    assert body["code"] == "not_found"


def test_state_conflict_returns_409(client):
    provider_id = _make_provider(client)
    model_resp = client.post(
        f"/providers/{provider_id}/models", json={"name": "gpt-4o-mini", "type": "chat"}
    )
    model_id = model_resp.get_json()["model_id"]

    resp = client.patch(f"/models/{model_id}/status", json={"is_active": True})
    assert resp.status_code == 409
    assert resp.get_json()["code"] == "conflict"


def test_filtered_list_by_query_string(client):
    provider_id = _make_provider(client)
    client.post(f"/providers/{provider_id}/models", json={"name": "Model A", "type": "chat"})
    b = client.post(f"/providers/{provider_id}/models", json={"name": "Model B", "type": "chat"})
    model_b_id = b.get_json()["model_id"]

    client.patch(f"/models/{model_b_id}/status", json={"is_active": False})

    resp = client.get(f"/providers/{provider_id}/models?active=true")
    names = [m["name"] for m in resp.get_json()]
    assert names == ["Model A"]


def test_health_check_degrades_when_provider_unreachable(client):
    """Part D3: an unreachable provider must not block the response."""
    provider_id = _make_provider(client)

    with patch(
        "app.check_provider_health",
        return_value={"checked": True, "healthy": False, "latency_ms": None, "note": "unreachable"},
    ):
        resp = client.post(f"/providers/{provider_id}/health-check")

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status"] == "unhealthy"
    assert body["circuit_state"] == "open"
    assert body["health_check"]["checked"] is True


def test_health_check_marks_provider_healthy_on_success(client):
    provider_id = _make_provider(client)

    with patch(
        "app.check_provider_health",
        return_value={"checked": True, "healthy": True, "latency_ms": 12, "note": "ok"},
    ):
        resp = client.post(f"/providers/{provider_id}/health-check")

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status"] == "healthy"
    assert body["circuit_state"] == "closed"
