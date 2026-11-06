"""Process-local TTL cache. Enough for repeat searches and a reused reference asset."""

from __future__ import annotations

import time
from threading import Lock


class TtlCache:
    def __init__(self, max_items: int = 64) -> None:
        self.max_items = max_items
        self._items: dict[str, tuple[float, object]] = {}
        self._lock = Lock()

    def get(self, key: str) -> object | None:
        now = time.monotonic()
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            expires, value = item
            if expires < now:
                del self._items[key]
                return None
            return value

    def set(self, key: str, value: object, ttl_seconds: float) -> None:
        with self._lock:
            if key not in self._items and len(self._items) >= self.max_items:
                self._items.pop(next(iter(self._items)))
            self._items[key] = (time.monotonic() + ttl_seconds, value)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


response_cache = TtlCache()
asset_cache = TtlCache()


def clear_caches() -> None:
    response_cache.clear()
    asset_cache.clear()
