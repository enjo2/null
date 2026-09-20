"""DuckDuckGo HTML (lite) engine.

Uses the html.duckduckgo.com lite endpoint which serves minimal HTML and does
not require JavaScript. Queries are issued from the null instance's IP, so the
same privacy posture as any server-side aggregation applies.
"""

from __future__ import annotations

import asyncio
import re
import urllib.parse

from bs4 import BeautifulSoup

from ..core.urls import normalize_for_dedupe
from ..models import SearchResult
from .base import BaseEngine

try:
    from bs4 import BeautifulSoup as _BS
except ImportError:  # pragma: no cover
    _BS = None


class DuckDuckGoEngine(BaseEngine):
    name = "duckduckgo"
    display_name = "DuckDuckGo"
    tier = "direct"
    max_results = 30
    cats = ["general", "web", "news"]
    # Supports offset paging via the `s` parameter (used to deepen thin pools).
    paged = True

    LITE = "https://html.duckduckgo.com/html/"
    VERIFY = "https://duckduckgo.com"

    # DDG lite serves ~10-15 organic results per page regardless of ask.
    PAGE_SIZE = 15
    # Offset pages fetched per query (parallel, so latency stays ~1 request).
    MAX_PAGES = 3

    async def search(self, query, *, language="auto", category="general", limit=None):
        if category not in self.cats:
            return []
        want = limit or self.max_results
        if want <= self.PAGE_SIZE:
            return (await self._page(query, language, 0))[:want]

        # Deep fetch: pull several offset pages concurrently and merge,
        # de-duplicating repeats (DDG overlaps results across offsets).
        offsets = range(0, self.PAGE_SIZE * self.MAX_PAGES, self.PAGE_SIZE)
        pages = await asyncio.gather(
            *(self._page(query, language, off) for off in offsets),
            return_exceptions=True,
        )
        seen: set[str] = set()
        merged: list[SearchResult] = []
        for page in pages:
            if isinstance(page, BaseException):
                continue
            for r in page:
                key = normalize_for_dedupe(r.url)
                if key in seen:
                    continue
                seen.add(key)
                merged.append(r)
        return merged[:want]

    async def _page(self, query: str, language: str, offset: int) -> list[SearchResult]:
        params = {"q": query, "kl": _ddg_lang(language)}
        if offset:
            params["s"] = str(offset)
        resp = await self.client.get(self.LITE, params=params)
        resp.raise_for_status()
        # DDG lite serves Windows-1252; httpx decodes via content-type, but
        # be defensive and decode explicitly.
        soup = BeautifulSoup(resp.content, "html.parser")

        results: list[SearchResult] = []
        for result in soup.select(".result"):
            a = result.select_one(".result__a")
            if not a or not a.get("href"):
                continue
            url = _clean_ddg_url(a["href"])
            title = a.get_text(" ", strip=True)
            snippet_el = result.select_one(".result__snippet")
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
            results.append(
                SearchResult(
                    title=title,
                    url=url,
                    snippet=snippet,
                    category="web",
                    language="en",
                )
            )
        return results

    async def suggest(self, prefix: str) -> list[str]:
        params = {"q": prefix, "type": "list"}
        resp = await self.client.get(
            "https://duckduckgo.com/ac/", params=params
        )
        resp.raise_for_status()
        data = resp.json()
        return [item.get("phrase", "") for item in data if isinstance(item, dict)]


def _clean_ddg_url(raw: str) -> str:
    """DDG wraps links in an UDGS redirect; extract the destination."""

    if "uddg=" in raw:
        qs = urllib.parse.parse_qs(
            urllib.parse.urlsplit(raw).query, keep_blank_values=True
        )
        if qs.get("uddg"):
            return urllib.parse.unquote(qs["uddg"][0])
    return raw


def _ddg_lang(language: str) -> str:
    if language in ("auto", "all"):
        return "wt-wt"
    return f"{language}-{language.upper()}" if "-" not in language else language