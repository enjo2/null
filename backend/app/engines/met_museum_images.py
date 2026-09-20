"""The Metropolitan Museum of Art — open access image search.

Keyless public API over ~470k open-access artworks (CC0). Results link to
the Met's object page; thumbnails come from the Met's own image CDN.
"""

from __future__ import annotations

import asyncio

from ..models import SearchResult
from .base import BaseEngine


class MetMuseumImagesEngine(BaseEngine):
    name = "met_images"
    display_name = "Met Museum"
    tier = "api"
    max_results = 15
    cats = ["images"]

    API = "https://collectionapi.metmuseum.org/public/collection/v1"

    async def search(self, query, *, language="auto", category="general", limit=None):
        if category not in self.cats:
            return []
        resp = await self.client.get(
            f"{self.API}/search",
            params={"q": query, "hasImages": "true"},
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        # Polite fan-out: resolve at most a dozen object records per query.
        ids = (resp.json().get("objectIDs") or [])[:12]
        objects = await asyncio.gather(
            *(self._object(oid) for oid in ids), return_exceptions=True
        )

        want = limit or self.max_results
        out: list[SearchResult] = []
        for obj in objects:
            if isinstance(obj, BaseException) or not isinstance(obj, dict):
                continue
            thumb = obj.get("primaryImageSmall") or ""
            page = obj.get("objectURL") or ""
            if not thumb or not page:
                continue
            bits = [b for b in (obj.get("artistDisplayName"), obj.get("objectDate")) if b]
            out.append(
                SearchResult(
                    title=obj.get("title") or "Artwork",
                    url=page,
                    snippet=" · ".join(bits),
                    category="images",
                    thumbnail=thumb,
                    publisher="Met Museum",
                )
            )
            if len(out) >= want:
                break
        return out

    async def _object(self, object_id: int) -> dict:
        resp = await self.client.get(
            f"{self.API}/objects/{object_id}",
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()
