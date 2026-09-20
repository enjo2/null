"""Wikimedia Commons image search.

Keyless, well-behaved JSON API, CC-licensed / public-domain media. Results
link to the Commons file page (attribution preserved); the grid renders the
served thumbnail directly. One of two image engines — they fan out in
parallel and the ranker merges.
"""

from __future__ import annotations

from ..models import SearchResult
from .base import BaseEngine


class WikimediaImagesEngine(BaseEngine):
    name = "wikimedia_images"
    display_name = "Wikimedia Commons"
    tier = "api"
    max_results = 20
    cats = ["images"]

    API = "https://commons.wikimedia.org/w/api.php"

    async def search(self, query, *, language="auto", category="general", limit=None):
        if category not in self.cats:
            return []
        want = limit or self.max_results
        resp = await self.client.get(
            self.API,
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": query,
                "gsrnamespace": "6",  # File:
                "gsrlimit": min(want, 50),
                "prop": "imageinfo",
                "iiprop": "url|size|extmetadata",
                "iiurlwidth": "400",  # thumbnail width
                "format": "json",
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        pages = (resp.json().get("query") or {}).get("pages") or {}
        out: list[SearchResult] = []
        for page in pages.values():
            info = (page.get("imageinfo") or [{}])[0]
            thumb = info.get("thumburl") or info.get("url") or ""
            if not thumb:
                continue
            meta = info.get("extmetadata") or {}
            artist = (meta.get("Artist") or {}).get("value", "")
            license_name = (meta.get("LicenseShortName") or {}).get("value", "")
            # Strip the minimal HTML the API leaves in artist fields.
            artist = artist.replace("<", "&lt;").split(">")[-1].strip() if artist else ""
            snippet = " · ".join(x for x in (artist, license_name) if x)
            out.append(
                SearchResult(
                    title=page.get("title", "Image").removeprefix("File:"),
                    url=info.get("descriptionurl") or thumb,
                    snippet=snippet,
                    category="images",
                    thumbnail=thumb,
                    width=info.get("width"),
                    height=info.get("height"),
                    publisher="Wikimedia Commons",
                )
            )
        return out[:want]
