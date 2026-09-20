"""Engine registry — builds enabled engines from configuration."""

from __future__ import annotations

import httpx

from ..core.config import Settings
from .base import BaseEngine
from .duckduckgo import DuckDuckGoEngine
from .duckduckgo_videos import DDGVideosEngine
from .google_api import GoogleCseEngine
from .html_engines import MarginaliaEngine
from .met_museum_images import MetMuseumImagesEngine
from .mwmbl import MwmblEngine
from .openverse_images import OpenverseImagesEngine
from .pexels_images import PexelsImagesEngine
from .wikimedia_images import WikimediaImagesEngine

ENGINE_CLASSES: dict[str, type[BaseEngine]] = {
    "duckduckgo": DuckDuckGoEngine,
    "duckduckgo_videos": DDGVideosEngine,
    "wikimedia_images": WikimediaImagesEngine,
    "openverse_images": OpenverseImagesEngine,
    "met_images": MetMuseumImagesEngine,
    "pexels_images": PexelsImagesEngine,
    "googleapi": GoogleCseEngine,
    "marginalia": MarginaliaEngine,
    "mwmbl": MwmblEngine,
}

# Media engines are picked per-category by the search service; they are not
# part of the default general-web pool.
MEDIA_ENGINES = {
    "wikimedia_images",
    "openverse_images",
    "met_images",
    "pexels_images",
    "duckduckgo_videos",
}

# Engines that rely on HTML scraping and are therefore opt-in only.
SCRAPE_TIER_ENGINES = {"marginalia"}


class EngineRegistry:
    def __init__(self, config: Settings):
        self.config = config
        self._engines: dict[str, BaseEngine] = {}

    def build(self) -> None:
        """Instantiate configured engines. Per-engine critical config is
        handled at request time, so missing API keys fail softly. Media
        engines (images/videos) always build — they are selected only when
        the query category asks for them."""

        timeout = self.config.timeout_ms / 1000
        shared = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "null-metasearch/1.0 (https://github.com/null-search/null; privacy-first)",
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            },
        )

        names = set(self.config.enabled_engines) | MEDIA_ENGINES
        for name in names:
            cls = ENGINE_CLASSES.get(name)
            if cls is None:
                continue
            try:
                engine = cls(config=self.config, client=shared)
                self._engines[name] = engine
            except Exception:  # noqa: BLE001 - never let one bad engine break startup
                continue

    def get(self, name: str) -> BaseEngine | None:
        return self._engines.get(name)

    def all(self) -> list[BaseEngine]:
        return list(self._engines.values())

    def names(self) -> list[str]:
        return list(self._engines.keys())

    async def aclose(self) -> None:
        for engine in self._engines.values():
            await engine.aclose()

    def status(self) -> list[dict]:
        return [e.to_dict() for e in self._engines.values()]

    @staticmethod
    def catalog(config: Settings) -> list[dict]:
        """Every engine null knows how to run, with enablement metadata.

        This drives the engine-logo showcase on the homepage and the settings
        page without leaking per-instance config beyond booleans.
        """

        out = []
        for name, cls in ENGINE_CLASSES.items():
            tier = cls.tier
            intents = []
            if name == "googleapi" and not (config.google_cse_key and config.google_cse_id):
                intents.append("needs GOOGLE_CSE_KEY + GOOGLE_CSE_ID")
            if name in SCRAPE_TIER_ENGINES and not config.allow_html_scrape_engines:
                intents.append("opt-in")
            out.append(
                {
                    "name": name,
                    "display_name": cls.display_name,
                    "tier": tier,
                    "enabled": name in config.enabled_engines,
                    "kind": "media" if name in MEDIA_ENGINES else "web",
                    "notes": intents,
                }
            )
        return out