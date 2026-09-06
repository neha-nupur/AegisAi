"""
In-process storage for the Model & Provider Service.

Per Task 6's "Self-contained — Pass" finding for this service, no other
AegisAI service may import this module; anything else reaches this data
only through app.py's HTTP contract.
"""

from threading import Lock
from typing import Dict, Optional

from models import Provider, Model


class Store:
    def __init__(self) -> None:
        self._lock = Lock()
        self.providers: Dict[int, Provider] = {}
        self.models: Dict[int, Model] = {}
        self._next_provider_id = 1
        self._next_model_id = 1
        self.idempotency: Dict[str, dict] = {}

    def next_provider_id(self) -> int:
        with self._lock:
            pid = self._next_provider_id
            self._next_provider_id += 1
            return pid

    def next_model_id(self) -> int:
        with self._lock:
            mid = self._next_model_id
            self._next_model_id += 1
            return mid

    def get_provider(self, provider_id: int) -> Optional[Provider]:
        return self.providers.get(provider_id)

    def get_model(self, model_id: int) -> Optional[Model]:
        return self.models.get(model_id)

    def models_for_provider(self, provider_id: int):
        return [m for m in self.models.values() if m.provider_id == provider_id]

    def get_idempotent_result(self, key: str) -> Optional[dict]:
        return self.idempotency.get(key)

    def save_idempotent_result(self, key: str, result: dict) -> None:
        self.idempotency[key] = result


store = Store()
