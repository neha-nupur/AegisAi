"""
Record classes for the Model & Provider Service.

as_json() is the one place that decides what a caller may see. It
deliberately drops internal bookkeeping fields — and, per AegisAI's own
security design ("Sensitive credentials such as API keys... should never
be committed"; "avoids exposing... provider API credentials"), a Provider
record never stores a raw API key or secret at all, only config_reference
(a pointer into a secrets manager), so there is nothing sensitive here to
even risk leaking.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Provider:
    provider_id: int
    name: str
    base_url: str
    status: str        # 'healthy' | 'unhealthy' — schema default 'healthy'
    circuit_state: str  # 'closed' | 'open' — schema default 'closed'
    config_reference: Optional[str]
    created_at: str
    # Internal only: which admin registered this provider. Not part of the
    # public representation.
    registered_by: Optional[str] = None

    def as_json(self) -> dict:
        return {
            "provider_id": self.provider_id,
            "name": self.name,
            "base_url": self.base_url,
            "status": self.status,
            "circuit_state": self.circuit_state,
            "config_reference": self.config_reference,
            "created_at": self.created_at,
        }


@dataclass
class Model:
    model_id: int
    provider_id: int
    name: str
    type: str
    sensitivity_level: Optional[str]
    cost_metadata: Optional[dict]
    is_active: bool
    created_at: str
    # Internal only, same reasoning as CampusEats' MenuItem.
    created_by: Optional[str] = None
    idempotency_key: Optional[str] = None

    def as_json(self) -> dict:
        return {
            "model_id": self.model_id,
            "provider_id": self.provider_id,
            "name": self.name,
            "type": self.type,
            "sensitivity_level": self.sensitivity_level,
            "cost_metadata": self.cost_metadata,
            "is_active": self.is_active,
            "created_at": self.created_at,
        }
