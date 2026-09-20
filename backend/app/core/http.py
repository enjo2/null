"""Shared HTTP helpers.

A descriptive User-Agent is required by several upstream APIs
(Wikimedia in particular rejects bare httpx requests with a 403).
"""

from __future__ import annotations

USER_AGENT = "null/1.0 (privacy-first metasearch engine; contact: not provided)"

HTTP_HEADERS = {"User-Agent": USER_AGENT}


def headers() -> dict[str, str]:
    return dict(HTTP_HEADERS)