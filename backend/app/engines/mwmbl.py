"""Mwmbl adapter — independent, open-source community search engine.

Mwmbl (AGPL-3.0, mwmbl.org) is a non-profit engine with its own crawler. Its
public JSON API needs no key, tolerates server requests, and there is no ToS
friction — the good kind of engine for a metasearch. Results come back as a
list where titles/snippets are arrays of {value, is_bold} fragments.
"""

from __future__ import annotations

import re
import urllib.parse

from ..models import SearchResult
from .base import BaseEngine


def _text(fragments: list | None) -> str:
    if not fragments:
        return ""
    return re.sub(r"\s+", " ", "".join(f.get("value", "") for f in fragments)).strip()


class MwmblEngine(BaseEngine):
    name = "mwmbl"
    display_name = "Mwmbl"
    tier = "api"
    max_results = 40
    cats = ["general", "web"]
    # Mwmbl explicitly welcomes programmatic use of its public API.
    api_url = "https://api.mwmbl.org/search/?s={query}&max_results={limit}"

    async def search(self, query, *, language="auto", category="general", limit=None):
        if category not in self.cats:
            return []
        max_results = min(limit or self.max_results, 50)
        url = self.api_url.format(
            query=urllib.parse.quote_plus(query), limit=max_results
        )
        resp = await self.client.get(
            url, headers={"Accept": "application/json"}
        )
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list):
            return []

        out = []
        for item in data:
            target = item.get("url")
            if not target or not target.startswith("http"):
                continue
            out.append(
                SearchResult(
                    title=_text(item.get("title")),
                    url=target,
                    snippet=_text(item.get("extract")),
                    score=1.0,
                    position=len(out),
                )
            )
        return out