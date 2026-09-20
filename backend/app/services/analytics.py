"""Privacy-respecting analytics.

We never store queries, IPs, or user agents. Only aggregate counters (per
minute) and engine health are kept — with no way to reconstruct what any
individual searched for.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from datetime import datetime, timezone

from ..core.config import Settings
from ..models import AnalyticsSnapshot, CategoryCount

BUCKET_SECONDS = 60


class Analytics:
    def __init__(self, config: Settings):
        self.config = config
        self.total_queries = 0
        self._query_times: deque[float] = deque(maxlen=256)
        self._categories: dict[str, int] = {}
        self._dedupe = {"hits": 0, "total": 0}
        self._engine_fail = {}  # engine -> consecutive failures
        self._engine_ok: dict[str, bool] = {}
        self._buckets: deque[tuple[str, int]] = deque(maxlen=1440)
        self._lock = threading.Lock()
        self._started = time.monotonic()
        self._stop = False
        self._thread = None

    def start(self) -> None:
        import threading as _t

        self._thread = _t.Thread(target=self._tick, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        if self._thread:
            self._thread.join(timeout=2)

    def _tick(self) -> None:
        while not self._stop:
            time.sleep(BUCKET_SECONDS)
            self.record_minute()

    def record_minute(self) -> None:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
        with self._lock:
            for cat, count in self._categories.items():
                self._buckets.append((f"{now}:{cat}", count))
            self._categories.clear()

    def record_query(self, *, query_time_ms: int, category: str, dedupe_hits: int, dedupe_total: int) -> None:
        if not self.config.analytics_enabled:
            return
        with self._lock:
            self.total_queries += 1
            self._query_times.append(query_time_ms)
            self._categories[category] = self._categories.get(category, 0) + 1
            self._dedupe["hits"] += dedupe_hits
            self._dedupe["total"] += dedupe_total

    def record_engine(self, name: str, ok: bool) -> None:
        if not self.config.analytics_enabled:
            return
        with self._lock:
            self._engine_ok[name] = ok
            if ok:
                self._engine_fail[name] = 0
            else:
                self._engine_fail[name] = self._engine_fail.get(name, 0) + 1

    def snapshot(self) -> AnalyticsSnapshot:
        with self._lock:
            recent = sum(c for _, c in self._buckets) + sum(self._categories.values())
            top = sorted(self._categories.items(), key=lambda kv: kv[1], reverse=True)[:6]
            times = list(self._query_times)
            dedupe_rate = (
                self._dedupe["hits"] / self._dedupe["total"]
                if self._dedupe["total"]
                else 0.0
            )
            health = dict(self._engine_ok)
            return AnalyticsSnapshot(
                total_queries=self.total_queries,
                queries_last_24h=recent,
                avg_query_time_ms=round(sum(times) / len(times), 2) if times else 0.0,
                top_categories=[CategoryCount(category=c, count=n) for c, n in top],
                dedupe_rate=round(dedupe_rate, 4),
                engine_health=health,
            )

    def uptime_seconds(self) -> float:
        return time.monotonic() - self._started