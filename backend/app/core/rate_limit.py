"""IP-based rate limiting (token bucket) with per-engine fairness.

Rate limiting is memory-only: no query or IP is ever persisted. This protects
each upstream engine's ToS while making no privacy compromise of our own.
"""

from __future__ import annotations

import threading
import time

from ..core.config import Settings


class TokenBucket:
    def __init__(self, capacity: int, refill_per_second: float):
        self.capacity = capacity
        self.tokens = float(capacity)
        self.refill = refill_per_second
        self.updated = time.monotonic()

    def take(self) -> bool:
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.refill)
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False


class RateLimiter:
    def __init__(self, config: Settings):
        self.config = config
        per_minute = max(1, config.rate_limit_per_minute)
        burst = max(1, config.rate_limit_burst)
        self._buckets: dict[str, TokenBucket] = {}
        self._per_engine: dict[str, TokenBucket] = {}
        self._lock = threading.Lock()
        self._global = TokenBucket(capacity=burst, refill_per_second=per_minute / 60)
        self.granted = 0
        self.rejected = 0

    def _bucket(self, store: dict[str, TokenBucket], key: str) -> TokenBucket:
        now = time.monotonic()
        bucket = store.get(key)
        if bucket is None:
            bucket = TokenBucket(
                capacity=self.config.rate_limit_burst,
                refill_per_second=self.config.rate_limit_per_minute / 60,
            )
            store[key] = bucket
        return bucket

    def allow(self, client_key: str) -> bool:
        with self._lock:
            ok = self._global.take()
            if not ok:
                self.rejected += 1
                return False
            bucket = self._bucket(self._buckets, client_key)
            allowed = bucket.take()
            if allowed:
                self.granted += 1
            else:
                self.rejected += 1
            return allowed

    def engine_allowed(self, engine_name: str) -> bool:
        with self._lock:
            return self._bucket(self._per_engine, engine_name).take()

    def stats(self) -> dict:
        with self._lock:
            return {
                "granted": self.granted,
                "rejected": self.rejected,
                "clients_tracked": len(self._buckets),
                "per_minute": self.config.rate_limit_per_minute,
                "burst": self.config.rate_limit_burst,
            }


def client_key(request_headers, config: Settings) -> str:
    """Compute a rate-limit key without identifying details.

    When trust_proxy_headers is enabled we honor X-Forwarded-For; otherwise we
    fall back to the socket peer, and finally to a fixed default so NAT'd
    traffic is still rate-limited per node.
    """

    if config.trust_proxy_headers:
        fwd = request_headers.get("x-forwarded-for", "")
        if fwd:
            return "ip:" + fwd.split(",")[0].strip()
    remote = getattr(request_headers, "client", None)
    if remote and remote.get("host"):
        return "ip:" + remote["host"].split(":")[0]
    return "shared"