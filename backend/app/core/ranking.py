"""Result deduplication and privacy-respecting ranking.

Deduplication groups results by a normalized URL key; the merged entry keeps the
host, the best snippet/title, the union of engines, and a score accumulated from
each contributing engine. Ranking then blends:

  * diversity bonus  — results confirmed by several independent engines win
  * positional score — where the result ranked inside each engine
  * trust weight     — per-engine weight from configuration/privacy posture
  * freshness        — published_date decays older items slightly
"""

from __future__ import annotations

import re
from collections import defaultdict

from ..models import SearchResult

ENGINE_TRUST_WEIGHTS: dict[str, float] = {
    "duckduckgo": 1.0,
    "googleapi": 1.0,
    "marginalia": 1.0,
    "mwmbl": 1.0,
}

DIVERSITY_BOOST = 0.35
FRESHNESS_HALF_LIFE_DAYS = 365
DOMAIN_MATCH_BOOST = 4.0

# How many results one website may occupy at most in the final page. 1 means
# a site appears exactly once — its strongest result, never a near-duplicate.
MAX_RESULTS_PER_SITE = 1


def _sld(host: str) -> str:
    """Second-level domain: 'en.wikipedia.org' -> 'wikipedia' ( registrable part )."""
    host = (host or "").lower().strip().strip(".").removeprefix("www.")
    parts = host.split(".")
    return parts[-2] if len(parts) >= 2 else parts[0] if parts and parts[0] else ""


def _host(url: str) -> str:
    from urllib.parse import urlsplit

    try:
        return (urlsplit(url).netloc or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def _query_host_boost(query: str, url: str) -> float:
    """Large boost when the query names the site's own domain.

    'tesla' -> tesla.com, 'wikipedia' -> wikipedia.org, 'firefox' -> mozilla.org
    (brand vs product domains count via the registrable-part comparison).
    Returns 1.0 for an exact registrable-domain match, 0.6 for a prefix match
    ('teslamotors' vs 'tesla'), else 0.
    """
    tokens = re.findall(r"[a-z0-9]+", query.lower())
    if not tokens:
        return 0.0
    host = _host(url)
    if not host:
        return 0.0
    site = _sld(host)
    if not site:
        return 0.0
    for tok in tokens:
        if tok == site:
            return 1.0
        # Prefix match, both directions, only for reasonably distinctive names.
        if len(tok) >= 4 and len(site) >= 4 and (site.startswith(tok) or tok.startswith(site)):
            return 0.6
    return 0.0


def _registrable(host: str) -> str:
    """Registrable domain: last two labels ('en.wikipedia.org' -> 'wikipedia.org').

    Good enough for dedup purposes; multi-label public suffixes (co.uk) are
    approximated by also folding a penultimate 'co|com|org|gov|ac' label.
    """
    labels = [p for p in (host or "").lower().strip().strip(".").split(".") if p]
    if len(labels) >= 3 and labels[-2] in {"co", "com", "org", "gov", "ac"}:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:]) if len(labels) >= 2 else ".".join(labels)


def _positional_score(position: int | None) -> float:
    if position is None:
        return 0.4
    return max(0.0, 1.0 - position / 30.0)


def _freshness_gain(published_date: str | None) -> float:
    if not published_date:
        return 0.0
    try:
        from datetime import datetime, timezone

        dt = datetime.fromisoformat(published_date.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 86400)
        return 0.15 * (0.5 ** (age_days / FRESHNESS_HALF_LIFE_DAYS))
    except ValueError:
        return 0.0


def dedupe_and_rank(
    results: list[SearchResult],
    *,
    query: str = "",
    engine_weights: float = 1.0, 
    limit: int = 50,
    category: str = "general",
) -> tuple[list[SearchResult], int]:
    """Return (ranked_results, dedupe_hits)."""

    merged: dict[str, dict] = defaultdict(
        lambda: {
            "title": "",
            "url": "",
            "snippets": [],
            "engines": set(),
            "score": 0.0,
            "category": "general",
            "published_date": None,
            "language": None,
            "thumbnail": None,
            "position": None,
            "width": None,
            "height": None,
            "publisher": None,
            "duration": None,
        }
    )

    for res in results:
        key = _key(res.url)
        group = merged[key]
        weight = ENGINE_TRUST_WEIGHTS.get(res.engine, 1.0)
        group["score"] += (
            weight * _positional_score(res.position) + float(res.score) * 0.1
        )
        group["engines"].add(res.engine)
        title = res.title.removeprefix("File:")
        if not group["title"] or len(title) > len(group["title"]):
            group["title"] = title
        if res.snippet and res.snippet not in group["snippets"]:
            group["snippets"].append(res.snippet)
            group["snippets"] = group["snippets"][:2]
        if not group["url"]:
            group["url"] = res.url
        if not group["category"] or group["category"] == "general":
            group["category"] = res.category
        if res.published_date and not group["published_date"]:
            group["published_date"] = res.published_date
        if not group.get("thumbnail") and res.thumbnail:
            group["thumbnail"] = res.thumbnail
        if res.language and not group["language"]:
            group["language"] = res.language
        # Media metadata (images/videos) — first engine to supply it wins.
        for field in ("width", "height", "publisher", "duration"):
            if group[field] is None:
                group[field] = getattr(res, field, None)

    index = 0
    ranked_out: list[SearchResult] = []
    for group in merged.values():
        engines = sorted(group["engines"])
        diversity = DIVERSITY_BOOST * max(0, len(engines) - 1)
        freshness = _freshness_gain(group["published_date"])
        host_boost = _query_host_boost(query, group["url"])
        total = group["score"] + diversity + freshness + (
            DOMAIN_MATCH_BOOST if host_boost >= 1.0 else (0.75 * DOMAIN_MATCH_BOOST if host_boost > 0 else 0.0)
        )

        ranked_out.append(
            SearchResult(
                title=group["title"],
                url=group["url"],
                snippet="\n".join(group["snippets"]),
                engine="+".join(engines),
                engines_note=engines,
                category=group["category"],
                published_date=group["published_date"],
                score=round(total, 4),
                position=index,
                thumbnail=group["thumbnail"],
                language=group["language"],
                domain=_host(group["url"]),
                domain_match=host_boost >= 1.0,
                width=group["width"],
                height=group["height"],
                publisher=group["publisher"],
                duration=group["duration"],
            )
        )
        index += 1

    ranked_out.sort(key=lambda r: r.score, reverse=True)

    # Per-site cap: keep only the strongest result of each website. Two URLs
    # of the same host are usually the same page re-listed or a near-
    # duplicate listing; users asking for "no site more than once" get exactly that.
    # Media searches are exempt: an images grid from Wikimedia Commons or a
    # videos grid from YouTube legitimately contains many results per host.
    apply_site_cap = category not in ("images", "videos")
    per_site: dict[str, int] = {}
    visible: list[SearchResult] = []
    suppressed = 0
    for res in ranked_out:
        if apply_site_cap:
            site = _registrable(res.domain or _host(res.url))
            if not site:
                site = res.domain or _host(res.url) or res.url
            count = per_site.get(site, 0)
            if count >= MAX_RESULTS_PER_SITE:
                suppressed += 1
                continue
            per_site[site] = count + 1
        visible.append(res)

    dedupe_hits = len(results) - len(ranked_out) + suppressed
    return visible[:limit], dedupe_hits


def _key(url: str) -> str:
    from .urls import normalize_for_dedupe

    return normalize_for_dedupe(url)