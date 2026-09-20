"""Google Custom Search JSON API adapter (officially sanctioned).

The only stable, ToS-clean route to Google results: a Google Cloud API key plus
a Programmable Search Engine ID. Free tier = 100 queries/day, max 10 results
per query. Runs on the normal direct connection — never routed through Tor.
"""

from __future__ import annotations

import urllib.parse

from ..models import SearchResult
from .base import BaseEngine


class GoogleCseEngine(BaseEngine):
    name = "googleapi"
    display_name = "Google"
    tier = "api"
    max_results = 10
    cats = ["general", "web"]

    def __init__(self, config, client):
        super().__init__(config=config, client=client)
        self._key = config.google_cse_key
        self._cx = config.google_cse_id

    async def search(self, query, *, language="auto", category="general", limit=None):
        if not self._key or not self._cx:
            raise RuntimeError("GOOGLE_CSE_KEY and GOOGLE_CSE_ID are not configured")
        if category not in self.cats:
            return []
        params = {
            "key": self._key,
            "cx": self._cx,
            "q": query,
            "num": str(min(limit or self.max_results, 10)),
        }
        if language and language != "auto":
            params["lr"] = f"lang_{language.split('-')[0]}"
        url = "https://www.googleapis.com/customsearch/v1?" + urllib.parse.urlencode(params)
        resp = await self.client.get(url, headers={"Accept": "application/json"})
        resp.raise_for_status()
        data = resp.json()

        out = []
        for item in data.get("items", []):
            out.append(
                SearchResult(
                    title=item.get("title", ""),
                    url=item.get("link", ""),
                    snippet=(item.get("snippet") or "").replace("\n", " "),
                    score=1.0,
                    position=len(out),
                )
            )
        return out