"""Engine abstraction. Every search engine plugs into this interface."""

from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod

import httpx

from ..core.config import Settings, get_settings
from ..models import EngineStatus, SearchResult


class BaseEngine(ABC):
    """Base class for all search engines.

    Engines are resolved as async generators emitting SearchResult objects.
    A hard timeout is enforced at the orchestrator level so slow/broken
    engines never stall a search.
    """

    name: str = "base"
    display_name: str = "base"
    tier: str = "native"  # native | api | scrape
    max_results: int = 15
    supports_language: bool = True
    supports_categories: list[str] = ["general"]
    cats: list[str] = ["general"]

    def __init__(self, config: Settings | None = None, client: httpx.AsyncClient | None = None):
        self.config = config or get_settings()
        self.client = client or httpx.AsyncClient(
            timeout=self.config.timeout_ms / 1000,
            follow_redirects=True,
            headers=self._default_headers(),
        )

    def _default_headers(self) -> dict[str, str]:
        return {
            "User-Agent": "null-metasearch/1.0 (+https://example.invalid/null; privacy-first)",
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    @abstractmethod
    async def search(
        self,
        query: str,
        *,
        language: str = "auto",
        category: str = "general",
        limit: int | None = None,
    ) -> list[SearchResult]:
        raise NotImplementedError

    async def suggest(self, prefix: str) -> list[str]:
        return []

    def request_timeout(self) -> float:
        """Hard per-engine deadline in seconds. Tor-routed engines get extra
        room — a round trip over the proxy routinely costs far more than the
        normal socket timeout (which is also per-hop, not total)."""
        base = self.config.timeout_ms / 1000
        if getattr(self, "use_tor", False) and self.config.tor_proxy:
            return max(base, 20.0)
        return base

    async def search_with_status(
        self,
        query: str,
        *,
        language: str = "auto",
        category: str = "general",
        limit: int | None = None,
    ) -> tuple[list[SearchResult], EngineStatus]:
        started = time.perf_counter()
        try:
            results = await asyncio.wait_for(
                self.search(
                    query, language=language, category=category,
                    limit=limit or self.max_results,
                ),
                timeout=self.request_timeout(),
            )
            elapsed = int((time.perf_counter() - started) * 1000)
            status = EngineStatus(
                name=self.name,
                ok=True,
                result_count=len(results),
                fetch_time_ms=elapsed,
            )
            for r in results:
                r.fetch_time_ms = elapsed
                r.engine = self.name
            return results, status
        except asyncio.TimeoutError:
            elapsed = int((time.perf_counter() - started) * 1000)
            status = EngineStatus(
                name=self.name,
                ok=False,
                error=f"{self.name} timed out after {self.request_timeout():.0f}s",
                fetch_time_ms=elapsed,
            )
            return [], status
        except Exception as exc:  # noqa: BLE001 - engines are isolated
            elapsed = int((time.perf_counter() - started) * 1000)
            status = EngineStatus(
                name=self.name,
                ok=False,
                error=str(exc)[:400],
                fetch_time_ms=elapsed,
            )
            return [], status

    async def aclose(self) -> None:
        await self.client.aclose()

    def filter_by_category(self, results: list[SearchResult], category: str) -> list[SearchResult]:
        if category not in self.cats:
            return []
        return results

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "display_name": self.display_name,
            "tier": self.tier,
            "categories": self.supports_categories,
        }