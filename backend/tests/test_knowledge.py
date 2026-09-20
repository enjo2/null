"""Tests for the knowledge panel detection/classification and instant answers.

These cover only the offline, deterministic parts: confidence heuristics,
entity-type classification, and locally-computed instant answers (math, unit
and temperature conversion). No live upstream API is contacted here.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.instant import instant


# ---------------------------------------------------------------------------
# Instant answers (all computed locally, safe for offline tests)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_instant_math_basic():
    r = await instant("2+2")
    assert r is not None
    assert r.kind == "math"
    assert r.value == "4"


@pytest.mark.asyncio
async def test_instant_math_caret_means_power():
    r = await instant("2^3")
    assert r is not None
    assert r.kind == "math"
    assert r.value == "8"


@pytest.mark.asyncio
async def test_instant_math_with_functions():
    r = await instant("sqrt(16)")
    assert r is not None
    assert r.value == "4"


@pytest.mark.asyncio
async def test_instant_math_rejects_attrs():
    r = await instant("__import__('os')")
    assert r is None


@pytest.mark.asyncio
async def test_instant_unit_conversion():
    r = await instant("100 km to miles")
    assert r is not None
    assert r.kind == "unit-conversion"
    assert "miles" in r.value


@pytest.mark.asyncio
async def test_instant_temperature_conversion():
    r = await instant("32f to c")
    assert r is not None
    assert r.kind == "unit-conversion"
    assert "0" in r.value and "C" in r.value


# ---------------------------------------------------------------------------
# Entity-type classification
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("description", "expected"),
    [
        ("Capital city of the United Kingdom", "place"),
        ("American business magnate and industrial designer", "person"),
        ("British singer-songwriter and actress", "person"),
        ("American film director, producer, and screenwriter", "person"),
        ("1994 American crime film directed by Quentin Tarantino", "film"),
        ("debut studio album by an American singer", "music"),
        ("American electric vehicle and clean energy company", "company"),
        ("line of smartphones designed and marketed by Apple Inc.", "product"),
        ("country in western Europe", "place"),
    ],
)
def test_classify_type(description, expected):
    from app.knowledge.entities import classify_type

    kind, _ = classify_type(description, [])
    assert kind == expected


# ---------------------------------------------------------------------------
# Confidence heuristics
# ---------------------------------------------------------------------------

def test_exact_title_confidence_is_high():
    from app.knowledge.entities import _confidence

    assert _confidence("elon musk", "Elon Musk") == 1.0
    assert _confidence("deep learning", "Deep learning") == 1.0


def test_prefix_title_scores_above_threshold():
    """Common case: query is a prefix of the page title (e.g. 'tesla limits'
    vs 'Tesla, Inc.' style titles should still be confidently matchable)."""
    from app.knowledge.entities import _confidence

    assert _confidence("tesla", "Tesla, Inc.") >= 0.75


def test_unrelated_title_scores_low():
    from app.knowledge.entities import _confidence

    assert _confidence("berlin wall", "Apple Pie Recipes") < 0.5


def test_entity_like_query_guardrail():
    from app.knowledge.entities import _looks_like_entity_query

    assert _looks_like_entity_query("elon musk") is True
    assert _looks_like_entity_query("what is 2+2") is False


# ---------------------------------------------------------------------------
# API wiring (offline: knowledge service stubbed, math is local)
# ---------------------------------------------------------------------------

class _StubKnowledge:
    async def panel(self, q: str):
        return None


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(app.state, "knowledge_service", _StubKnowledge())
    with TestClient(app) as c:
        yield c


def test_knowledge_panel_endpoint_offline(client):
    r = client.get("/api/knowledge-panel", params={"q": "anything at all"})
    assert r.status_code == 200
    assert r.json() is None


def test_instant_endpoint_math_offline(client):
    r = client.get("/api/instant", params={"q": "2+2"})
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "math"
    assert body["value"] == "4"


def test_instant_endpoint_null_for_non_answer(client):
    r = client.get("/api/instant", params={"q": "why is the sky blue"})
    assert r.status_code == 200
    assert r.json() is None