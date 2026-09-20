"""In-memory / optional async cache.

A small TTL cache is sufficient for a self-hosted instance. Statistics are
exposed globally so we can report cache hit rates without logging queries.
"""

from __future__ import annotations

import threading
import time
from typing import Any

from ..core.config import Settings


class TTLCache:
    def __init__(self, ttl_seconds: int = 600, max_items: int = 2048, enabled: bool = True):
        self.ttl = ttl_seconds
        self.max_items = max_items
        self.enabled = enabled
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = threading.RLock()
        self.hits = 0
        self.misses = 0

    def _evict(self) -> None:
        now = time.monotonic()
        expired = [k for k, (ts, _) in self._data.items() if now - ts > self.ttl]
        for k in expired:
            del self._data[k]
        over = len(self._data) - self.max_items
        if over > 0:
            for k in list(self._data)[:over]:
                del self._data[k]

    def get(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        with self._lock:
            self._evict()
            hit = self._data.get(key)
            if hit is None:
                self.misses += 1
                return None
            ts, value = hit
            if time.monotonic() - ts > self.ttl:
                del self._data[key]
                self.misses += 1
                return None
            self.hits += 1
            return value

    def set(self, key: str, value: Any) -> None:
        if not self.enabled:
            return
        with self._lock:
            self._evict()
            self._data[key] = (time.monotonic(), value)

    def stats(self) -> dict:
        with self._lock:
            total = self.hits + self.misses
            return {
                "enabled": self.enabled,
                "items": len(self._data),
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": round(self.hits / total, 4) if total else 0.0,
                "ttl_seconds": self.ttl,
            }


_cache: TTLCache | None = None


def get_cache(config: Settings | None = None) -> TTLCache:
    global _cache
    if _cache is None:
        cfg = config or Settings()
        _cache = TTLCache(
            ttl_seconds=cfg.cache_ttl_seconds,
            enabled=cfg.cache_enabled,
        )
    return _cache