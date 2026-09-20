"""API smoke tests using FastAPI TestClient (offline: engines not contacted)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_root_metadata(client):
    r = client.get("/api/")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "null"
    assert "/search" in body["search"]


def test_healthz(client):
    r = client.get("/api/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "cache" in body


def test_engines_list(client):
    r = client.get("/api/engines")
    assert r.status_code == 200
    for engine in r.json():
        assert engine["tier"] in {"native", "direct", "api", "scrape"}


def test_compare_privacy(client):
    r = client.get("/api/compare-privacy")
    assert r.status_code == 200
    body = r.json()
    assert len(body["engines"]) >= 6


def test_search_requires_q(client):
    r = client.get("/api/search")
    assert r.status_code == 422


def test_redirect_strips_tracking_and_302s(client):
    r = client.get(
        "/api/r",
        params={"url": "https://example.com/?utm_source=x&q=keep"},
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert "utm_source" not in r.headers["location"]
    assert "q=keep" in r.headers["location"]


def test_autocomplete_empty_input(client):
    r = client.get("/api/autocomplete", params={"q": ""})
    assert r.status_code == 422