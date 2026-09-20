"""null - privacy-first metasearch engine configuration."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from pydantic import BeforeValidator, Field
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
# Load the repo-root .env whether uvicorn runs from / or /backend.
_ENV_FILES = [p for p in (Path.cwd() / ".env", _PROJECT_ROOT / ".env") if p.is_file()]


def _csv_or_json(value: Any) -> Any:
    """Accept either a JSON array or a plain comma-separated string."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("["):
            return value
        return [item.strip() for item in stripped.split(",") if item.strip()]
    return value


# Comma-separated lists are friendlier in .env files than JSON arrays.
CSV = Annotated[list[str], NoDecode, BeforeValidator(_csv_or_json)]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES or None,
        env_file_encoding="utf-8",
        env_prefix="NULL_",
        extra="ignore",
    )

    app_name: str = "null"
    app_tagline: str = "A privacy-first metasearch engine."
    environment: str = "production"  # dev | production

    # --- Server -----------------------------------------------------------
    host: str = "0.0.0.0"
    port: int = 8000
    allowed_origins: CSV = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"]
    )

    # --- Privacy guarantees ------------------------------------------------
    # If enabled, query terms are kept in memory only and never persisted.
    # Aggregated (non-identifying) counters are stored if analytics_db is set.
    log_queries: bool = False
    analytics_enabled: bool = True
    store_suggestions: bool = False

    # --- Engine configuration ----------------------------------------------
    # Which engines are enabled by default (order matters for ranking tie-break).
    enabled_engines: CSV = Field(
        default_factory=lambda: ["duckduckgo", "googleapi", "marginalia", "mwmbl"]
    )
    timeout_ms: int = 6000
    max_results_per_engine: int = 30
    max_results_total: int = 100

    # Optional official Google Custom Search JSON API (100 free queries/day).
    # Requires a Google Cloud API key + a Programmable Search Engine ID.
    google_cse_key: str | None = None
    google_cse_id: str | None = None

    # Optional Pexels photo search (free key at pexels.com/api).
    pexels_api_key: str | None = None

    # Optional Tor SOCKS5 proxy for engines that are bot-gated from datacenter
    # IPs (currently Startpage + Mojeek). Requires a local Tor daemon:
    #   sockstat -l | grep 9050   (and NULL_TOR_PROXY=socks5://127.0.0.1:9050)
    tor_proxy: str | None = None

    # Engines that scrape HTML are disabled by default to respect each
    # provider's Terms of Service. Enable only where legally permissible.
    allow_html_scrape_engines: bool = False

    # --- Cache / rate limiting ----------------------------------------------
    cache_ttl_seconds: int = 600
    cache_enabled: bool = True
    rate_limit_per_minute: int = 30
    rate_limit_burst: int = 8

    # --- Database -------------------------------------------------------------
    analytics_db_url: str | None = None

    # --- Redirect / privacy proxy ----------------------------------------------
    use_redirect: bool = True
    strip_tracking_params: bool = True

    # --- Defaults for the "null" preset ------------------------------------------
    default_language: str = "auto"
    default_safe_search: int = 0
    default_results_per_page: int = 20

    # --- Paths --------------------------------------------------------------------
    comparison_data_path: Path = Path(__file__).parent / "comparison" / "data.json"

    # --- Tooling -------------------------------------------------------------------
    trust_proxy_headers: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()