"""HTTP API for null.

Endpoints:
  GET  /                      -> service metadata
  GET  /search                -> aggregate search
  GET  /knowledge-panel       -> entity knowledge panel (or null)
  GET  /instant               -> instant answer (math, units, weather, …)
  GET  /autocomplete          -> suggestions (no logging)
  GET  /favicon?domain=…      -> privacy-preserving site icon proxy
  GET  /r?url=...             -> privacy redirect proxy
  GET  /compare-privacy       -> comparison data (drives the /compare-privacy UI)
  GET  /analytics/snapshot    -> aggregate counters only
  GET  /healthz               -> health + engine status
  GET  /engines               -> list available engines
"""

from __future__ import annotations

import re

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, Response

from ..core.config import get_settings
from ..core.rate_limit import client_key
from ..core.urls import strip_tracking
from ..knowledge.models import InstantAnswer, KnowledgePanel
from ..models import (
    AnalyticsSnapshot,
    ComparisonData,
    EngineStatus,
    HealthResponse,
    SearchResponse,
    SuggestionsResponse,
)

api_router = APIRouter()


def _state(request: Request):
    return request.app.state


@api_router.get("/", tags=["meta"])
async def root(request: Request):
    s = request.app.state.settings
    return {
        "name": s.app_name,
        "tagline": s.app_tagline,
        "privacy": "No query or IP logging. Self-hosted and auditable.",
        "search": "/search?q=<query>",
        "autocomplete": "/autocomplete?q=<prefix>",
        "compare-privacy": "/compare-privacy",
        "docs": "/docs",
    }


@api_router.get("/engines", response_model=list[dict], tags=["meta"])
async def engines(request: Request):
    return _state(request).registry.status()


@api_router.get("/engines/catalog", response_model=list[dict], tags=["meta"])
async def engines_catalog(request: Request):
    """Every supported engine with tier + enablement notes (drives logos)."""

    from ..engines.registry import EngineRegistry

    return EngineRegistry.catalog(_state(request).settings)


@api_router.get("/search", response_model=SearchResponse, tags=["search"])
async def search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=300, description="Search query"),
    category: str = Query("general"),
    language: str = Query("auto"),
    limit: int = Query(20, ge=1, le=100),
    engines: str | None = Query(None, description="Comma-separated engine filter"),
):
    st = _state(request)
    key = client_key(request.headers, st.settings)
    if not st.rate_limiter.allow(key):
        raise HTTPException(429, detail="Rate limit exceeded. Please slow down.")
    engine_filter = [e.strip() for e in engines.split(",") if e.strip()] if engines else None
    resp = await st.search_service.search(
        q, language=language, category=category, limit=limit, engines=engine_filter
    )
    st.analytics.record_query(
        query_time_ms=resp.query_time_ms,
        category=resp.category,
        dedupe_hits=resp.dedupe_hits,
        dedupe_total=resp.total + resp.dedupe_hits,
    )
    for engine in resp.engines:
        st.analytics.record_engine(engine.name, engine.ok)
    return resp


@api_router.get("/knowledge-panel", response_model=KnowledgePanel | None, tags=["search"])
async def knowledge_panel(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, description="Query or entity name"),
):
    """Detect a searchable entity and return its knowledge panel.

    Returns ``null`` when the query doesn't confidently match a single entity
    or when no panel data could be built. Panels are cached for 30 days and
    keyed only by a hash of the entity title.
    """
    st = _state(request)
    key = client_key(request.headers, st.settings)
    if not st.rate_limiter.allow(key):
        raise HTTPException(429, detail="Rate limit exceeded. Please slow down.")
    return await st.knowledge_service.panel(q)


@api_router.get("/instant", response_model=InstantAnswer | None, tags=["search"])
async def instant_answer(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, description="Query"),
):
    """Resolve an instant answer (math, units, currency, weather, define, time)."""
    from ..services.instant import instant

    return await instant(q)


@api_router.get("/autocomplete", response_model=SuggestionsResponse, tags=["search"])
async def autocomplete(request: Request, q: str = Query(..., min_length=1, max_length=100)):
    st = _state(request)
    return await st.search_service.suggestions(q)


@api_router.get("/r", tags=["privacy"])
async def redirect_proxy(url: str = Query(..., description="Destination URL")):
    """Intermediate redirect that never leaks the query as a referrer.

    Results link to /r?url=<destination> so the upstream site never sees what
    you searched for. The browser is then navigated to the result.
    """

    cleaned = strip_tracking(url) if get_settings().strip_tracking_params else url
    return RedirectResponse(url=cleaned, status_code=302)


# ---------------------------------------------------------------------------
# Privacy-preserving favicon proxy
#
# Why a proxy? If the browser fetched favicons directly from every result
# site, each site would see your IP paired with "someone is viewing a search
# result from my domain" — a tracking vector. Instead the request goes
# through this endpoint: the browser only ever talks to this instance.
#
# Privacy model:
#   * receives only a bare domain name — never the query that produced it;
#   * cached in memory keyed by the domain (never logged, never persisted);
#   * fixed ttlCache (1h) with a small cap; failures cached briefly to
#     avoid hammering origins;
#   * upstream requests carry our static UA and no referer.
# ---------------------------------------------------------------------------

import time as _time

_FAVICON_TTL = 3600.0        # 1 hour
_FAVICON_FAIL_TTL = 300.0    # 5 minutes for failures
_FAVICON_MAX_ITEMS = 512
_FAVICON_CACHE: dict[str, tuple[float, bytes, str]] = {}

_DOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$", re.IGNORECASE)


def _favicon_cache_get(key: str) -> tuple[bytes, str] | None:
    entry = _FAVICON_CACHE.get(key)
    if entry is None:
        return None
    at, body, ctype = entry
    ttl = _FAVICON_FAIL_TTL if body == b"" else _FAVICON_TTL
    if _time.monotonic() - at > ttl:
        _FAVICON_CACHE.pop(key, None)
        return None
    return body, ctype


def _favicon_cache_set(key: str, body: bytes, ctype: str) -> None:
    if len(_FAVICON_CACHE) >= _FAVICON_MAX_ITEMS:
        # Drop the oldest quarter — cheap and deterministic enough.
        for k, _ in sorted(_FAVICON_CACHE.items(), key=lambda kv: kv[1][0])[: _FAVICON_MAX_ITEMS // 4]:
            _FAVICON_CACHE.pop(k, None)
    _FAVICON_CACHE[key] = (_time.monotonic(), body, ctype)


@api_router.get("/favicon", tags=["privacy"])
async def favicon(request: Request, domain: str = Query(..., description="Bare domain, e.g. example.com")):
    """Proxy a site's favicon without telling the site who is asking.

    The response is cacheable by the browser (1h) and the icon is fetched
    with our own crawler identity — result pages stay anonymous.
    """
    domain = (domain or "").strip().lower().rstrip(".")
    if not domain or len(domain) > 253 or not _DOMAIN_RE.match(domain):
        raise HTTPException(400, "invalid domain")

    cached = _favicon_cache_get(domain)
    if cached is not None:
        body, ctype = cached
        if body == b"":
            return Response(status_code=204)
        return Response(content=body, media_type=ctype, headers={"Cache-Control": "public, max-age=3600"})

    headers = {
        "User-Agent": "null-metasearch/1.0 (favicon proxy; privacy-first)",
        "Accept": "image/*,*/*;q=0.8",
    }
    candidates = [
        f"https://{domain}/favicon.ico",
        f"https://www.{domain}/favicon.ico" if not domain.startswith("www.") else None,
        f"https://icons.duckduckgo.com/ip3/{domain}.ico",
    ]
    body = b""
    ctype = "image/x-icon"
    try:
        async with httpx.AsyncClient(timeout=5, follow_redirects=True, headers=headers) as client:
            for url in filter(None, candidates):
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200 and resp.content:
                        body = resp.content
                        ctype = resp.headers.get("content-type", "image/x-icon").split(";")[0]
                        if len(body) > 300_000:  # 300 KB sanity cap
                            body = b""
                        break
                except Exception:  # noqa: BLE001
                    continue
    except Exception:  # noqa: BLE001
        pass

    _favicon_cache_set(domain, body, ctype)  # empty body = negative cache entry
    if not body:
        return Response(status_code=204)
    return Response(content=body, media_type=ctype, headers={"Cache-Control": "public, max-age=3600"})


@api_router.get("/compare-privacy", response_model=ComparisonData, tags=["comparison"])
async def compare_privacy(request: Request):
    from ..comparison.data_model import load_comparison

    return load_comparison()


@api_router.get("/analytics/snapshot", response_model=AnalyticsSnapshot, tags=["meta"])
async def analytics_snapshot(request: Request):
    return _state(request).analytics.snapshot()


@api_router.get("/healthz", response_model=HealthResponse, tags=["meta"])
async def health(request: Request):
    st = _state(request)
    engines_out = [
        EngineStatus(
            name=name,
            ok=st.registry.get(name) is not None,
            result_count=0,
            fetch_time_ms=0,
        )
        for name in st.registry.names()
    ]
    return HealthResponse(
        status="ok",
        version=st.settings.app_name + "/1.0",
        engines=engines_out,
        cache=st.search_service.cache.stats(),
        uptime_seconds=st.analytics.uptime_seconds(),
    )