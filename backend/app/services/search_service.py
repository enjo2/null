"""Search orchestration: async fan-out to engines, dedupe + rank, cache."""

from __future__ import annotations

import asyncio
import hashlib
import uuid

from ..core.config import Settings
from ..core.cache import get_cache
from ..core.ranking import dedupe_and_rank
from ..core.urls import strip_tracking
from ..engines.registry import ENGINE_CLASSES, MEDIA_ENGINES, EngineRegistry
from ..models import (
    EngineStatus,
    SearchResponse,
    SearchResult,
    Suggestion,
    SuggestionsResponse,
)


# Query categories served exclusively by media engines.
MEDIA_ENGINES_CATEGORIES = {"images", "videos"}


class SearchService:
    def __init__(self, config: Settings, registry: EngineRegistry):
        self.config = config
        self.registry = registry
        self.cache = get_cache(config)

    def _cache_key(self, query: str, language: str, category: str, limit: int) -> str:
        material = f"{query}\x00{language}\x00{category}\x00{limit}"
        return "q:" + hashlib.sha256(material.encode()).hexdigest()

    async def search(
        self,
        query: str,
        *,
        language: str = "auto",
        category: str = "general",
        limit: int | None = None,
        use_cache: bool | None = None,
        engines: list[str] | None = None,
    ) -> SearchResponse:
        started = asyncio.get_event_loop().time()
        query = query.strip()[:300]
        limit = min(int(limit or self.config.max_results_total), 100)
        cfg_cache = self.config.cache_enabled if use_cache is None else use_cache

        selected = engines or None
        key = self._cache_key(query, language, category, limit) + (
            "|" + ",".join(selected) if selected else ""
        )
        if cfg_cache:
            cached = self.cache.get(key)
            if cached is not None:
                cached.from_cache = True
                return cached

        pool = [e for e in self.registry.all() if e.name in selected] if selected else None
        if pool is None and category in MEDIA_ENGINES_CATEGORIES:
            # Media searches: only engines serving that category (images/videos).
            pool = [e for e in self.registry.all() if category in e.cats]
        engines_pool = pool or [e for e in self.registry.all() if category in e.cats or "general" in e.cats]
        # Ask each engine for the full requested pool. Engines cap internally
        # to what a single page gives them; paged engines (DDG) fetch a second
        # page when the ask exceeds one page, deepening the result pool so
        # client-side pagination has real pages to show.
        ask = max(limit, self.config.max_results_per_engine)
        jobs = [
            e.search_with_status(query, language=language, category=category, limit=ask)
            for e in engines_pool
        ]
        done = await asyncio.gather(*jobs, return_exceptions=True)

        all_results: list[SearchResult] = []
        statuses: list[EngineStatus] = []
        for result in done:
            if isinstance(result, BaseException):
                statuses.append(
                    EngineStatus(name="unknown", ok=False, error=str(result)[:400])
                )
                continue
            results, status = result
            statuses.append(status)
            for r in results:
                if self.config.strip_tracking_params:
                    r.url = strip_tracking(r.url)
                all_results.append(r)

        ranked, dedupe_hits = dedupe_and_rank(all_results, query=query, limit=limit, category=category)

        response = SearchResponse(
            query=query,
            results=ranked,
            engines=statuses,
            total=len(ranked),
            query_time_ms=int((asyncio.get_event_loop().time() - started) * 1000),
            dedupe_hits=dedupe_hits,
            category=category,
            language=language,
            from_cache=False,
            search_id=uuid.uuid4().hex,
        )
        if cfg_cache:
            self.cache.set(key, response)
        return response

    async def suggestions(self, query: str) -> SuggestionsResponse:
        query = query.strip()[:100]
        jobs = [e.suggest(query) for e in self.registry.all()]
        done = await asyncio.gather(*jobs, return_exceptions=True)

        items: list[Suggestion] = []
        for idx, result in enumerate(done):
            if isinstance(result, BaseException) or not result:
                continue
            engines = list(self.registry.names())
            engine_name = engines[idx] if idx < len(engines) else "unknown"
            for phrase in result[:6]:
                if phrase and phrase.lower() != query.lower() and phrase not in {
                    s.query for s in items
                }:
                    items.append(Suggestion(query=phrase, engine=engine_name))
        return SuggestionsResponse(query=query, suggestions=items[:10])