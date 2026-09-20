"""Knowledge panel orchestration.

Pipeline: detect entity -> fetch Wikipedia summary -> fetch Wikidata claims ->
build panel -> cache (30 days, keyed on entity-title hash only). Falls back to
a summary-only panel when a source errors out. All network calls are parallel
where possible and always best-effort.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import hashlib
from urllib.parse import quote

import httpx

from ..core.cache import TTLCache
from ..core.config import Settings
from ..core.http import HTTP_HEADERS
from .entities import _summary, classify_type, detect_entity
from .models import (
    EntityCandidate,
    KnowledgeAttribute,
    KnowledgeLink,
    KnowledgePanel,
    RelatedEntity,
)
from .wikidata import fetch_wikidata

PANEL_TTL_SECONDS = 60 * 60 * 24 * 30  # 30-day cache
MAX_RELATED = 5


def _panel_key(title: str) -> str:
    return "kp:" + hashlib.sha256(title.strip().lower().encode()).hexdigest()


class KnowledgeService:
    def __init__(self, config: Settings):
        self.config = config
        self.cache = TTLCache(ttl_seconds=PANEL_TTL_SECONDS, max_items=1024)

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=self.config.timeout_ms / 1000,
            follow_redirects=True,
            headers={**HTTP_HEADERS, "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8"},
        )

    async def panel(self, query: str, *, force: bool = False) -> KnowledgePanel | None:
        query = query.strip()[:200]
        if not query:
            return None
        async with self._client() as client:
            try:
                candidate = await detect_entity(query, client)
            except Exception:  # noqa: BLE001 - upstream hiccups mean no panel
                return None
            if candidate is None:
                return None
            return await self.panel_for(candidate, client, force=force)

    async def panel_for(
        self,
        candidate: EntityCandidate,
        client: httpx.AsyncClient | None = None,
        *,
        force: bool = False,
    ) -> KnowledgePanel | None:
        title = candidate.title or candidate.wikipedia_title
        if not title:
            return None
        if candidate.confidence < 0.75 and not force:
            return None

        key = _panel_key(candidate.wikipedia_title or title)
        if not force:
            cached = self.cache.get(key)
            if cached is not None:
                cached.from_cache = True
                return cached

        own_client = client is None
        if own_client:
            client = self._client()
        try:
            if own_client:
                await client.__aenter__()
            summary = dispatch = None
            try:
                summary = await _summary(client, candidate.wikipedia_title or candidate.title)
            except Exception:  # noqa: BLE001
                summary = None
            if summary is None:
                # Fall back to the lightweight candidate data.
                panel = self._summary_only(candidate)
                self.cache.set(key, panel)
                return panel

            name = (
                summary.get("title")
                or candidate.wikipedia_title
                or candidate.title
            )
            qid = candidate.wikidata_id or summary.get("wikibase_item")

            wiki_url = (
                (summary.get("content_urls") or {}).get("desktop", {}).get("page")
                or candidate.url
                or f"https://en.wikipedia.org/wiki/{name}"
            )
            description = (
                summary.get("extract")
                or (" ".join(((summary.get("extract_html") or "").split()))[:1000])
            )
            tagline = (summary.get("description") or "").strip()

            categories: list[str] = []
            try:
                categories = await self._categories(client, name)
            except Exception:  # noqa: BLE001
                categories = []

            entity_type, label = classify_type(tagline, categories)

            attributes: list[KnowledgeAttribute] = []
            links: list[KnowledgeLink] = []
            image: str | None = candidate.thumbnail

            if qid:
                try:
                    attributes, links, wd_image = await asyncio.wait_for(
                        fetch_wikidata(client, qid, entity_type=entity_type),
                        timeout=self.config.timeout_ms / 1000,
                    )
                    image = image or wd_image
                except Exception:  # noqa: BLE001
                    attributes, links = [], []

            thumbnail = candidate.thumbnail or (summary.get("thumbnail") or {}).get("source")
            if not image:
                image = (summary.get("originalimage") or {}).get("source")

            # Always surface the official Wikipedia article as a link.
            wiki_link = KnowledgeLink(
                key="wikipedia",
                label="Wikipedia",
                icon="wikipedia",
                url=wiki_url,
            )
            if wiki_link not in links:
                links.insert(0, wiki_link)

            panel = KnowledgePanel(
                name=name,
                entity_type=entity_type,
                type_label=label,
                tagline=tagline,
                description=description,
                wiki_url=wiki_url,
                wikidata_id=qid,
                image=image,
                thumbnail=thumbnail,
                attributes=attributes,
                links=links,
                related=[],
                sources=["wikipedia", "wikidata"],
                confidence=round(candidate.confidence, 3),
                from_cache=False,
                fetched_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                ttl_days=PANEL_TTL_SECONDS // 86400,
            )

            try:
                panel.related = await self._related(client, name)
            except Exception:  # noqa: BLE001
                panel.related = []

            if not force and self.cache:
                self.cache.set(key, panel)
            return panel
        finally:
            if own_client:
                try:
                    await client.__aexit__(None, None, None)
                except Exception:  # noqa: BLE001
                    pass

    def _summary_only(self, candidate: EntityCandidate) -> KnowledgePanel:
        """Minimal panel when Wikipedia service is unavailable."""
        name = candidate.title or candidate.wikipedia_title
        wiki_url = candidate.url or f"https://en.wikipedia.org/wiki/{name.split() and name.replace(' ', '_')}"
        return KnowledgePanel(
            name=name,
            entity_type="other",
            type_label="Entity",
            tagline=candidate.description or "",
            description="",
            wiki_url=wiki_url,
            wikidata_id=candidate.wikidata_id,
            image=candidate.thumbnail,
            thumbnail=candidate.thumbnail,
            sources=["wikipedia"],
            confidence=round(candidate.confidence, 3),
            fetched_at=dt.datetime.now(dt.timezone.utc).isoformat(),
            ttl_days=30,
        )

    async def _categories(self, client: httpx.AsyncClient, title: str) -> list[str]:
        resp = await client.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "prop": "categories",
                "titles": title,
                "cllimit": 12,
                "format": "json",
            },
        )
        resp.raise_for_status()
        pages = resp.json().get("query", {}).get("pages", {})
        for page in pages.values():
            return [c["title"].removeprefix("Category:") for c in page.get("categories", [])]
        return []

    async def _related(self, client: httpx.AsyncClient, title: str) -> list[RelatedEntity]:
        resp = await client.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": title,
                "srnamespace": 0,
                "srlimit": MAX_RELATED + 2,
                "format": "json",
            },
        )
        resp.raise_for_status()
        hits = resp.json().get("query", {}).get("search", [])
        related: list[RelatedEntity] = []
        for hit in hits:
            hit_title = hit.get("title", "")
            if hit_title.lower() == title.lower():
                continue
            related.append(
                RelatedEntity(
                    title=hit_title,
                    url=f"https://en.wikipedia.org/wiki/{quote(hit_title.replace(' ', '_'))}",
                    description=(hit.get("snippet") or "")
                    .replace("<span class=\"searchmatch\">", "").replace("</span>", "")[:220],
                )
            )
            if len(related) >= MAX_RELATED:
                break
        return related


_knowledge_service: KnowledgeService | None = None


def get_knowledge_service(config: Settings) -> KnowledgeService:
    global _knowledge_service
    if _knowledge_service is None:
        _knowledge_service = KnowledgeService(config)
    return _knowledge_service