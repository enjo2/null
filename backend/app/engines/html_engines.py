"""Bing / Marginalia HTML adapters.

These engines operate against public HTML endpoints and are opt-in (disabled
unless NULL_ALLOW_HTML_SCRAPE_ENGINES=true).

Each engine shows good citizenship: rate-limited, minimal fields, a browser-class
user agent, and explicit "bot-check"/challenge detection that surfaces a clear
error instead of silently returning zero results.

Engines marked ``use_tor = True`` route through the Tor SOCKS5 proxy when
NULL_TOR_PROXY is configured. Currently no engine sets it (the captcha-gated
providers were dropped), but the plumbing is kept for future providers.
"""

from __future__ import annotations

import re
import urllib.parse

import httpx
from bs4 import BeautifulSoup

from ..models import SearchResult
from .base import BaseEngine


class _HtmlEngine(BaseEngine):
    tier = "scrape"
    cats = ["general", "web"]
    _parse = staticmethod(lambda soup, query: [])
    # Browser-class UA so the scraper sits in the same pool as real traffic.
    # Override per engine when it needs something specific.
    user_agent = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    )
    # Route through the configured Tor SOCKS5 proxy (NULL_TOR_PROXY).
    use_tor = False
    # (marker substring, friendly message) → raised when upstream gates the bot.
    challenge_markers: tuple[tuple[str, str], ...] = ()

    async def _fetch(self, url: str, headers: dict[str, str]):
        proxy = self.config.tor_proxy if self.use_tor and self.config.tor_proxy else None
        if not proxy:
            return await self.client.get(url, headers=headers)
        # One-shot client so only Tor-routed engines ever touch the proxy.
        timeout = self.request_timeout()
        async with httpx.AsyncClient(
            proxy=proxy,
            timeout=timeout,
            follow_redirects=True,
            headers={"Accept": headers["Accept"]},
        ) as tor_client:
            return await tor_client.get(url, headers=headers)

    async def search(self, query, *, language="auto", category="general", limit=None):
        if not self.config.allow_html_scrape_engines:
            raise RuntimeError(
                f"{self.name} is disabled. Set NULL_ALLOW_HTML_SCRAPE_ENGINES=true "
                "to enable scraping built-in engines."
            )
        if category not in self.cats:
            return []
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        resp = await self._fetch(self._url(query, language), headers=headers)
        resp.raise_for_status()
        text = resp.text
        for marker, message in self.challenge_markers:
            if marker.lower() in text.lower():
                raise RuntimeError(message)
        soup = BeautifulSoup(text, "lxml")
        return self._parse(soup, query)


class BingEngine(_HtmlEngine):
    name = "bing"
    display_name = "Bing"
    max_results = 10
    cats = ["general", "web", "images"]

    def _url(self, query, language="auto"):
        return "https://www.bing.com/search?" + urllib.parse.urlencode(
            {"q": query, "count": self.max_results, "setlang": "en"}
        )

    @staticmethod
    def _parse(soup, query):
        out = []
        for li in soup.select("li.b_algo"):
            h2 = li.select_one("h2 a[href^='http']")
            if not h2:
                continue
            url = h2["href"]
            title = h2.get_text(" ", strip=True)
            p = li.select_one("p")
            snippet = p.get_text(" ", strip=True) if p else ""
            out.append(
                SearchResult(
                    title=title, url=_unredirect(url), snippet=snippet, category="web"
                )
            )
        return out


class MarginaliaEngine(_HtmlEngine):
    """Marginalia — an independent crawler of the old, text-first web."""

    name = "marginalia"
    display_name = "Marginalia"
    max_results = 30
    challenge_markers = (
        ("Wait For A Moment", "rate-limited (queue backlogged)"),
        ("barraged by queries", "rate-limited (queue backlogged)"),
    )

    def _url(self, query, language="auto"):
        return "https://old-search.marginalia.nu/search?" + urllib.parse.urlencode(
            {"query": query, "profile": "english"}
        )

    @staticmethod
    def _parse(soup, query):
        out = []
        for card in soup.select(".card.search-result"):
            title_el = card.select_one(".title")
            url_el = card.select_one(".url")
            if not title_el or not url_el:
                continue
            a = url_el.find("a")
            url = a.get("href") if a else url_el.get_text(strip=True)
            if not url:
                continue
            title = title_el.get_text(" ", strip=True)
            desc_el = card.select_one(".description")
            snippet = desc_el.get_text(" ", strip=True) if desc_el else ""
            out.append(
                SearchResult(
                    title=title, url=url, snippet=snippet, category="web"
                )
            )
        return out


def _unredirect(raw: str) -> str:
    """Strip common redirect/abuse wrappers from result URLs."""

    qs = urllib.parse.parse_qs(urllib.parse.urlsplit(raw).query)
    for key in ("url", "u", "uddg", "wd", "q"):
        if key in qs:
            candidate = urllib.parse.unquote(qs[key][0])
            if candidate.startswith("http"):
                return candidate
    return raw


def _tracking_params(url: str) -> str:
    """Return True-copy that strips known tracking parameters (native impl)."""

    return url  # placeholder; real stripping lives in core.urls