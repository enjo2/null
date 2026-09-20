"""DuckDuckGo video search.

Hits DDG's public JSON endpoint (v.js), which requires a `vqd` token scoped
to the query; the token is scraped from the HTML page — no JS, no cookies,
same server-side privacy posture as the web engine. Results carry embeddable
player URLs (YouTube, Vimeo…) plus thumbnails and durations.
"""

from __future__ import annotations

import re
import urllib.parse

from ..models import SearchResult
from .base import BaseEngine

_VQD_PATTERNS = (
    re.compile(r'vqd="([\d-]+)"'),
    re.compile(r"vqd=([\d-]+)&"),
    re.compile(r"vqd='([\d-]+)'"),
)


def _extract_vqd(html: str) -> str:
    for pat in _VQD_PATTERNS:
        m = pat.search(html)
        if m:
            return m.group(1)
    return ""


def _clean_url(raw: str) -> str:
    """Unwrap DDG redirect links and protocol-relative URLs."""
    if "uddg=" in (raw or ""):
        try:
            qs = urllib.parse.parse_qs(urllib.parse.urlsplit(raw).query)
            if qs.get("uddg"):
                return urllib.parse.unquote(qs["uddg"][0])
        except Exception:  # noqa: BLE001
            pass
    if (raw or "").startswith("//"):
        return "https:" + raw
    return raw or ""


class DDGVideosEngine(BaseEngine):
    name = "duckduckgo_videos"
    display_name = "DuckDuckGo Videos"
    tier = "api"
    max_results = 30
    cats = ["videos"]

    ENDPOINT = "https://duckduckgo.com/v.js"
    TOKEN_PATH = "https://duckduckgo.com/?q=videos&iax=videos&ia=videos"

    def _json_headers(self) -> dict[str, str]:
        # The JSON endpoint expects a browser-class UA and a same-site referer.
        return {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": "https://duckduckgo.com/",
        }

    async def search(self, query, *, language="auto", category="general", limit=None):
        if category not in self.cats:
            return []
        want = limit or self.max_results

        token_resp = await self.client.get(
            self.TOKEN_PATH, params={"q": query}
        )
        token_resp.raise_for_status()
        vqd = _extract_vqd(token_resp.text)
        if not vqd:
            return []

        resp = await self.client.get(
            self.ENDPOINT,
            params={"l": "us-en", "o": "json", "q": query, "vqd": vqd, "f": ",,,"},
            headers=self._json_headers(),
        )
        resp.raise_for_status()
        data = resp.json()

        out: list[SearchResult] = []
        for item in data.get("results", []):
            embed = item.get("embed_url") or ""
            page = _clean_url(item.get("content") or "")
            url = embed or page
            if not url or not url.startswith("http"):
                continue
            images = item.get("images") or {}
            thumb = (
                images.get("large") or images.get("medium") or images.get("small") or ""
            )
            out.append(
                SearchResult(
                    title=item.get("title") or "Video result",
                    url=url,
                    snippet=item.get("description") or "",
                    category="videos",
                    thumbnail=thumb,
                    publisher=item.get("publisher") or None,
                    duration=item.get("duration") or None,
                )
            )
        return out[:want]
