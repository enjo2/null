"""Shared data models for the null engine."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

EngineTier = Literal["native", "api", "scrape"]

SAFE_SEARCH = {0: "moderate", 1: "strict"}


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str = ""
    engine: str = Field(default="", description="engine that returned this result")
    engines_note: list[str] | None = None
    category: str = "general"
    published_date: str | None = None
    score: float = 1.0
    position: int | None = None
    thumbnail: str | None = None
    language: str | None = None
    fetch_time_ms: int = 0
    domain: str | None = Field(default=None, description="bare host of the result URL")
    domain_match: bool = Field(default=False, description="host registrable domain matches the query")
    # Media results (images/videos)
    width: int | None = None
    height: int | None = None
    publisher: str | None = None
    duration: str | None = None


class EngineStatus(BaseModel):
    name: str
    ok: bool
    error: str | None = None
    result_count: int = 0
    fetch_time_ms: int = 0


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    engines: list[EngineStatus]
    total: int = 0
    query_time_ms: int
    dedupe_hits: int = 0
    category: str = "general"
    language: str = "auto"
    from_cache: bool = False
    search_id: str


class Suggestion(BaseModel):
    query: str
    engine: str


class SuggestionsResponse(BaseModel):
    query: str
    suggestions: list[Suggestion]


class HealthResponse(BaseModel):
    status: str
    version: str
    engines: list[EngineStatus]
    cache: dict
    uptime_seconds: float


class PrivacyFeature(BaseModel):
    id: str
    label: str
    value: int = Field(default=0, ge=0, le=2, description="0 = no, 1 = partial, 2 = yes")
    note: str | None = None

    def points(self) -> int:
        return self.value


class ComparisonEngine(BaseModel):
    id: str
    name: str
    url: str
    logo: str | None = None
    open_source: int = 0
    jurisdiction: str
    features: list[PrivacyFeature] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)


class ComparisonData(BaseModel):
    generated_at: str
    meta: dict = Field(default_factory=dict)
    engines: list[ComparisonEngine]
    feature_definitions: list[PrivacyFeature]


class CategoryCount(BaseModel):
    category: str
    count: int


class AnalyticsSnapshot(BaseModel):
    total_queries: int
    queries_last_24h: int
    avg_query_time_ms: float
    top_categories: list[CategoryCount]
    dedupe_rate: float
    engine_health: dict[str, float]