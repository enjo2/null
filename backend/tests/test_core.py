"""Tests for URL hygiene, ranking, dedup, and engine selection."""

from app.core.urls import normalize_for_dedupe, strip_tracking
from app.models import SearchResult


def test_strip_tracking_removes_utm_and_params():
    url = "https://example.com/a?utm_source=x&utm_medium=email&q=keep&gclid=abc#section"
    cleaned = strip_tracking(url)
    assert "utm_source" not in cleaned
    assert "gclid" not in cleaned
    assert "q=keep" in cleaned
    assert "#section" in cleaned


def test_strip_tracking_keeps_non_tracking():
    url = "https://example.com/?q=privacy&lang=en"
    assert strip_tracking(url) == url


def test_normalize_folds_www_and_scheme():
    a = normalize_for_dedupe("https://WWW.Example.com/Path/")
    b = normalize_for_dedupe("https://example.com/path")
    assert a == b


def test_normalize_folds_query_params_for_dedupe():
    """Different engines return the same page with different tracking params;
    the dedupe key intentionally ignores the query string."""
    a = normalize_for_dedupe("https://example.com/article?view=1&utm_source=x")
    b = normalize_for_dedupe("https://example.com/article")
    assert a == b


def test_normalize_folds_host_and_amp_variants():
    """www./m./mobile. mirrors, case and AMP variants are the same page."""
    variants = [
        "https://www.Example.com/Page/",
        "https://example.com/page",
        "https://m.example.com/amp/page",
        "https://mobile.example.com/Page",
    ]
    keys = {normalize_for_dedupe(v) for v in variants}
    assert len(keys) == 1


class TestDedupeAndRank:
    def _make(self, title, url, engine, score=1.0, position=1):
        return SearchResult(
            title=title,
            url=url,
            snippet="snippet",
            engine=engine,
            score=score,
            position=position,
        )

    def test_dedupes_same_canonical_url(self):
        from app.core.ranking import dedupe_and_rank

        results = [
            self._make("Same", "https://example.com/", "duckduckgo"),
            self._make("Same", "https://www.example.com/", "google"),
        ]
        ranked, hits = dedupe_and_rank(results)
        assert len(ranked) == 1
        assert hits == 1
        assert "duckduckgo" in ranked[0].engine
        assert "google" in ranked[0].engine

    def test_multi_engine_ranks_higher(self):
        from app.core.ranking import dedupe_and_rank

        confirmed = [
            self._make("A", "https://a.example/", "duckduckgo", position=1),
            self._make("A", "https://a.example/", "mojeek", position=5),
        ]
        single = [
            self._make("B", "https://b.example/", "duckduckgo", position=1),
        ]
        ranked, _ = dedupe_and_rank(confirmed + single)
        assert ranked[0].url == "https://a.example/"

    def test_site_appears_at_most_once(self):
        """A website must never occupy more than one slot: its strongest
        result survives, the rest count as duplicates."""
        from app.core.ranking import dedupe_and_rank

        results = [
            self._make(f"p{i}", f"https://github.com/page{i}", "duckduckgo", position=i + 1)
            for i in range(4)
        ] + [self._make("other", "https://python.org/", "mwmbl", position=1)]
        ranked, hits = dedupe_and_rank(results, query="github")
        domains = [r.domain for r in ranked]
        assert domains.count("github.com") == 1
        assert "python.org" in domains
        assert hits == 3

    def test_distinct_pages_of_distinct_sites_all_survive(self):
        from app.core.ranking import dedupe_and_rank

        results = [
            self._make("a", "https://aa.com/", "mwmbl"),
            self._make("b", "https://bb.org/", "mwmbl"),
            self._make("c", "https://cc.net/", "mwmbl"),
        ]
        ranked, hits = dedupe_and_rank(results, query="x")
        assert len(ranked) == 3
        assert hits == 0


def test_registry_only_builds_configured():
    from app.core.config import Settings
    from app.engines.registry import EngineRegistry

    cfg = Settings(enabled_engines=["duckduckgo"])
    reg = EngineRegistry(cfg)
    reg.build()
    # Configured web engines build; unconfigured ones don't.
    assert "duckduckgo" in reg.names()
    assert "googleapi" not in reg.names()
    assert reg.get("mojeek") is None
    # Media engines always build — they serve their category only.
    assert "duckduckgo_videos" in reg.names()
    assert "wikimedia_images" in reg.names()
    assert "openverse_images" in reg.names()


def test_settings_read_null_prefixed_csv_env(monkeypatch):
    """Env vars use the NULL_ prefix; list fields accept comma-separated CSV."""
    from app.core.config import Settings

    monkeypatch.setenv("NULL_ENABLED_ENGINES", "duckduckgo,mojeek,marginalia")
    monkeypatch.setenv("NULL_ALLOW_HTML_SCRAPE_ENGINES", "True")
    s = Settings(_env_file=None)
    assert s.enabled_engines == ["duckduckgo", "mojeek", "marginalia"]
    assert s.allow_html_scrape_engines is True


def test_comparison_data_validates():
    from app.comparison.data_model import build_data

    data = build_data()
    assert len(data.engines) == 7
    assert data.engines[0].id == "null"
    for engine in data.engines:
        assert len(engine.features) == len(data.feature_definitions)
        for f in engine.features:
            assert 0 <= f.value <= 2