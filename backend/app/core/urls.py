"""URL hygiene: tracking-parameter stripping and redirect proxying."""

from __future__ import annotations

import re
import urllib.parse

# Known tracking / campaign parameters stripped before a result URL is shown.
# Kept conservative: legitimate fragment parameters are preserved.
TRACKING_PARAMS = frozenset(
    {
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "utm_id", "utm_source_platform", "utm_creative_format", "utm_marketing_tactic",
        "gclid", "gclsrc", "dclid", "fbclid", "msclkid", "igshid", "twclid",
        "mc_cid", "mc_eid", "_hsenc", "_hsmi", "hsCtaTracking", "vero_id",
        "wickedid", "ml_subscriber", "ml_subscriber_hash", "oly_anon_id",
        "oly_enc_id", "s_cid", "_ga", "_gl", "yclid", "ymclid", "rurl",
        "spm", "scm", "scc", "wt_mc", "mtm_source", "mtm_medium", "mtm_campaign",
        "matomo_source", "matomo_medium", "matomo_campaign", "pk_source",
        "pk_medium", "pk_campaign", "ref", "ref_src", "src", "site",
    }
)


def strip_tracking(url: str) -> str:
    """Remove tracking parameters from a URL, preserving path + fragments."""

    parsed = urllib.parse.urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        return url
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    cleaned = [(k, v) for k, v in query if k.lower() not in TRACKING_PARAMS]
    return urllib.parse.urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            urllib.parse.urlencode(cleaned, doseq=True),
            parsed.fragment,
        )
    )


def _dedupe_host(host: str) -> str:
    """Strip leading 'www.'/'m.'/'mobile.' and trailing dots from a netloc."""
    host = (host or "").strip().strip(".").lower()
    while True:
        for prefix in ("www.", "m.", "mobile."):
            if host.startswith(prefix):
                host = host[len(prefix):]
                break
        else:
            return host


def normalize_for_dedupe(url: str) -> str:
    """Canonical key used for cross-engine result deduplication.

    Engines return near-identical URLs for the same page — different schemes,
    ``www.`` prefixes, tracking/session params, AMP variants, trailing
    slashes. All of that is folded away so the same page from two engines
    merges into one result. The query string is ignored entirely; content
    paths (``/wiki/Elon_Musk``, ``/article-slug``) are kept so genuinely
    different pages on one site stay distinct.
    """

    raw = (url or "").strip()
    try:
        parsed = urllib.parse.urlsplit(raw)
        if not parsed.scheme and not parsed.netloc:
            return raw.lower()
        host = _dedupe_host(parsed.netloc.lower())
        path = parsed.path or "/"

        # AMP / lightweight variants point to the same content.
        if path.endswith(".amp"):
            path = path[: -len(".amp")]
        segments = [s for s in path.split("/") if s and s != "amp"]
        path = "/" + "/".join(segments)
        path = path.rstrip("/") or "/"

        # Content-addressed paths keep the key precise; short/empty paths
        # collapse to the host.
        if re.search(r"[a-z0-9\-_]{4,}", path.lower()):
            key = f"{host}{path.lower()}"
        else:
            key = host
        return key
    except ValueError:
        return raw.lower()


def absolute(base_origin: str, url: str) -> str:
    """Resolve a result URL that may be protocol-relative or relative."""

    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return base_origin + url
    return url