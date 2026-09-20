"""Pexels image search (optional, key-activated).

Pexels offers a generous free API key (photos cleared for use). Until a key
is configured this engine reports "not configured" and fails softly — the
same pattern as the Google CSE engine. Get a key at pexels.com/api and set
NULL_PEXELS_API_KEY.
"""

from __future__ import annotations

from ..core.config import get_settings
from ..models import SearchResult
from .base import BaseEngine


class PexelsImagesEngine(BaseEngine):
    name = "pexels_images"
    display_name = "Pexels"
    tier = "api"
    max_results = 15
    cats = ["images"]

    API = "https://api.pexels.com/v1/search"

    async def search(self, query, *, language="auto", category="general", limit=None):
        if category not in self.cats:
            return []
        key = self.config.pexels_api_key
        if not key:
            raise RuntimeError("not configured — set NULL_PEXELS_API_KEY (free at pexels.com/api)")
        want = limit or self.max_results
        resp = await self.client.get(
            self.API,
            params={"query": query, "per_page": min(want, 30)},
            headers={
                "Authorization": key,
                "Accept": "application/json",
            },
        )
        resp.raise_for_status()
        out: list[SearchResult] = []
        for photo in resp.json().get("photos", []):
            src = (photo.get("src") or {})
            thumb = src.get("medium") or src.get("small") or photo.get("url") or ""
            page = photo.get("url") or ""
            if not thumb or not page.startswith("http"):
                continue
            bits = [b for b in (photo.get("photographer"), f"{photo.get('width')}×{photo.get('height')}") if b]
            out.append(
                SearchResult(
                    title=photo.get("alt") or "Photo",
                    url=page,
                    snippet=" · ".join(bits),
                    category="images",
                    thumbnail=thumb,
                    width=photo.get("width"),
                    height=photo.get("height"),
                    publisher="Pexels",
                )
            )
        return out[:want]
