"""null — FastAPI application entry point.

Works on both async servers (uvicorn) and Vercel serverless functions:

* All long-lived services are created at import time as module-level
  singletons, so the same warm instance is reused across invocations and
  the ASGI lifespan is never a hard dependency.
* The analytics background thread only runs under uvicorn (via lifespan);
  Vercel instances simply accumulate in-memory counters per warm instance.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .api.routes import api_router
from .core.config import Settings, get_settings
from .core.rate_limit import RateLimiter
from .engines.registry import EngineRegistry
from .knowledge.service import get_knowledge_service
from .services.analytics import Analytics
from .services.instant import instant
from .services.search_service import SearchService

VERSION = "1.0.0"

settings: Settings = get_settings()

# --- Module-level singletons (safe on serverless warm instances) ----------
registry: EngineRegistry = EngineRegistry(settings)
registry.build()

analytics: Analytics = Analytics(settings)
analytics_background = False  # flips to True when the uvicorn thread starts

search_service: SearchService = SearchService(settings, registry)
rate_limiter: RateLimiter = RateLimiter(settings)
knowledge_service = get_knowledge_service(settings)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Fully optional: only used to run the aggregate-ticker on long-lived servers.
    global analytics_background
    if not analytics_background:
        analytics.start()
        analytics_background = True
    yield
    analytics.stop()
    await registry.aclose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.app_name} API",
        description=(
            "Privacy-first metasearch engine API. No query or IP logging. "
            "Self-hosted, auditable, AGPL-3.0."
        ),
        version=VERSION,
        lifespan=lifespan,
        openapi_tags=[
            {"name": "search", "description": "Aggregated search and suggestions"},
            {"name": "comparison", "description": "Privacy comparison data"},
            {"name": "privacy", "description": "Privacy-focused helpers"},
            {"name": "meta", "description": "Service metadata and health"},
        ],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=512)

    app.state.settings = settings
    app.state.registry = registry
    app.state.analytics = analytics
    app.state.search_service = search_service
    app.state.rate_limiter = rate_limiter
    app.state.knowledge_service = knowledge_service

    app.include_router(api_router, prefix="/api")
    return app


app = create_app()