"""Openverse image search (WordPress / CC).

Keyless public API over half a billion CC-licensed images. Results link to
the source page; thumbnails come from Openverse's own proxy so hotlinked
origin images rarely break.
"""

from __future__ import annotations

from ..models import SearchResult
from .base import BaseEngine


class OpenverseImagesEngine(BaseEngine):
    name = "openverse_images"
    display_name = "Openverse"
    tier = "api"
    max_results = 20
    cats = ["images"]

    API = "https://api.openverse.org/v1/images/"

    async def search(self, query, *, language="auto", category="general", limit=None):
        if category not in self.cats:
            return []
        want = limit or self.max_results
        resp = await self.client.get(
            self.API,
            params={
                "q": query,
                "page_size": min(want, 20),
                "mature": "false",
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        out: list[SearchResult] = []
        for item in data.get("results", []):
            thumb = item.get("thumbnail") or item.get("url") or ""
            source = item.get("foreign_landing_url") or item.get("url") or ""
            if not thumb or not source.startswith("http"):
                continue
            bits = [b for b in (item.get("creator"), item.get("license")) if b]
            out.append(
                SearchResult(
                    title=item.get("title") or "Image",
                    url=source,
                    snippet=" · ".join(bits),
                    category="images",
                    thumbnail=thumb,
                    width=item.get("width"),
                    height=item.get("height"),
                    publisher=(item.get("source") or "Openverse").capitalize(),
                )
            )
        return out[:want]
