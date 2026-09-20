"""Entity detection, linking, and type classification.

This is a deliberately lightweight, dependency-free "NER" layer: queries are
matched against Wikipedia's opensearch index and scored for how strongly the
top article title agrees with the user's intent. High scores (> 75%) promote
an entity panel; everything below simply falls through to normal results.

Nothing here stores queries — the candidate is returned to the service which
hashes the *entity title* for its cache key.
"""

from __future__ import annotations

import re

import httpx

from ..core.config import get_settings
from .models import EntityCandidate

# Queries that never produce an entity panel.
EXCLUDED_RE = re.compile(
    r"^(site|filetype|intitle|inurl|allintitle|allinurl|define|weather|whats the weather|"
    r"convert|how many|time in|current time|currency|exchange rate|spell|meaning of|"
    r"what is the capital|what is|what are|what was|what does|what did|who is|who was)\b",
    re.IGNORECASE,
)
OPERATOR_RE = re.compile(r"\b(and|or|not)\b", re.IGNORECASE)
STOPWORDS = {
    "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "is",
    "are", "was", "were", "what", "who", "where", "when", "why", "how",
}

_KNOWN_SOCIAL = {
    "company": ["founded", "founder", "headquarters", "area served", "website"],
    "person": ["born", "nationality", "occupation", "known for"],
    "place": ["population", "area", "established", "capital", "government"],
    "product": ["manufacturer", "released", "category", "official website"],
}

TYPE_LABELS = {
    "company": "Company",
    "person": "Person",
    "place": "Place",
    "product": "Product",
    "concept": "Concept",
    "organization": "Organization",
    "event": "Event",
    "film": "Film · Television",
    "music": "Music",
    "animal": "Animal",
    "other": "Entity",
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s'-]", " ", text.lower())).strip()


def _token_tokens(text: str) -> list[str]:
    low = text.lower()
    return [t for t in re.findall(r"[a-z0-9'-]+", low) if len(t) > 1]


def _jaccard(a: list[str], b: list[str]) -> float:
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


def _confidence(query: str, title: str) -> float:
    """Heuristic score in [0, 1] for how closely `title` answers `query`."""
    q_toks, t_toks = _token_tokens(query), _token_tokens(title)
    if not t_toks:
        return 0.0

    jac = _jaccard(q_toks, t_toks)
    score = 0.40 + 0.30 * jac
    ql = " ".join(q_toks)
    tl = " ".join(t_toks)
    if ql == tl:
        score += 0.25
    elif tl in ql:
        score += 0.18
    elif ql in tl:
        score += 0.15
    # Order matters: same leading tokens in sequence.
    if len(t_toks) >= 1 and q_toks and t_toks[: len(q_toks)] == q_toks[: len(t_toks)]:
        score += 0.10
    return max(0.0, min(1.0, score))


def _looks_like_entity_query(query: str) -> bool:
    q = query.strip()
    if not q:
        return False
    low = q.lower().strip()
    if EXCLUDED_RE.search(low):
        return False
    if OPERATOR_RE.search(low):
        return False
    # Explicit minus-terms ("tesla -bands") mean refinement, not an entity.
    if re.search(r"(^|\s)-\S", q):
        return False
    toks = _token_tokens(q)
    if len(toks) > 8:
        return False
    if len(toks) == 1 and toks[0] in STOPWORDS:
        return False
    if len(toks) == 1 and re.fullmatch(r"\d+[.,]?\d*", toks[0]):
        return False
    return True


async def detect_entity(
    query: str,
    client: httpx.AsyncClient,
    *,
    min_confidence: float = 0.75,
) -> EntityCandidate | None:
    """Link `query` to the strongest Wikipedia entity, if any."""
    if not _looks_like_entity_query(query):
        return None

    # opensearch: ordered title / suggestion list with thumbnails+descriptions.
    resp = await client.get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "opensearch",
            "search": query,
            "limit": 5,
            "namespace": 0,
            "format": "json",
        },
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    titles = data[1] or []
    if not titles:
        return None

    # Respect Wikipedia's own relevance ordering; skip disambiguation pages
    # and drop any candidate that doesn't clear the confidence bar.
    candidate = None
    summ: dict | None = None
    for title in titles:
        score = _confidence(query, title)
        if score < min_confidence:
            continue
        try:
            summ = await _summary(client, title)
        except Exception:  # noqa: BLE001 - best effort
            summ = None
        if summ and summ.get("type") == "disambiguation":
            continue
        candidate = EntityCandidate(
            title=title,
            matched_text=query,
            confidence=score,
            reason="wikipedia-opensearch",
        )
        break

    if candidate is None:
        return None

    # Enrich with the summary block for description/thumbnail/qid.
    if summ:
        candidate.description = summ.get("description") or ""
        if not candidate.title and summ.get("title"):
            candidate.title = summ["title"]
        candidate.thumbnail = (summ.get("thumbnail") or {}).get("source") or None
        candidate.url = (summ.get("content_urls") or {}).get("desktop", {}).get("page") or ""
        candidate.wikidata_id = summ.get("wikibase_item")
        if candidate.title:
            candidate.wikipedia_title = candidate.title
    return candidate


async def _summary(client: httpx.AsyncClient, title: str) -> dict | None:
    resp = await client.get(
        f"https://en.wikipedia.org/api/rest_v1/page/summary/{_slug(title)}",
        headers={"Accept": "application/json"},
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def _slug(title: str) -> str:
    import urllib.parse

    return urllib.parse.quote(title.replace(" ", "_"), safe="/_.,:-")


_MEDIA_FILM_RE = re.compile(
    r"\b(film directed|film written|film starring|animated feature film|documentary film|"
    r"short film|silent film|television series|television program|television show|miniseries|"
    r"soap opera|episode|film series|is a \d{1,4} film|drama film|crime film|comedy film|"
    r"action film|thriller film|horror film|romantic film|fantasy film|scifi film|superhero film)\b",
    re.IGNORECASE,
)
_MEDIA_MUSIC_RE = re.compile(
    r"\b(studio album|debut album|album by|song by|single by|soundtrack album|debut single|"
    r"extended play|greatest hits|mixtape|live album|compilation album)\b",
    re.IGNORECASE,
)


def classify_type(description: str = "", categories: list[str] | None = None) -> tuple[str, str]:
    """Map Wikipedia description/categories to a stable panel type."""
    text = " ".join(categories or []) + " " + description
    low = text.lower()

    def has(*words: str) -> bool:
        return any(re.search(rf"\b{re.escape(w)}\b", low) for w in words)

    if _MEDIA_FILM_RE.search(text):
        return "film", TYPE_LABELS["film"]
    if _MEDIA_MUSIC_RE.search(text):
        return "music", TYPE_LABELS["music"]
    if has("person", "politician", "president", "actor", "actress", "singer", "scientist",
            "mathematician", "writer", "author", "founder", "athlete", "player", "artist",
            "director", "journalist", "philosopher", "engineer", "historian", "economist",
            "lawyer", "physician", "professor", "researcher", "footballer", "cricketer",
            "basketball player", "baseball player", "runner", "swimmer", "tennis player",
            "racer", "coach", "person born", "human", "businessman", "businesswoman",
            "entrepreneur", "royalty", "monarch", "composer", "queen", "king", "duchess",
            "duke", "magnate", "billionaire", "industrialist", "tycoon", "singer-songwriter",
            "rapper", "drummer", "guitarist", "bassist", "pianist", "model", "influencer",
            "commentator", "presenter", "comedian", "chef", "priest", "cardinal", "cleric",
            "noble", "diplomat", "admiral", "military officer", "officer", "explorer", "inventor", "architect",
            "designer", "voice actor", "film producer", "screenwriter"):
        return "person", TYPE_LABELS["person"]
    if has("album", "song", "single", "record label", "recording artist", "music group",
            "band", "record producer", "soundtrack", "concert tour"):
        return "music", TYPE_LABELS["music"]
    if has("company", "corporation", "brand", "manufacturer", "business enterprise", "airline",
            "automaker", "car manufacturer", "record label", "conglomerate", "chain", "bank",
            "studio", "label", "publicly traded", "subsidiary"):
        return "company", TYPE_LABELS["company"]
    if has("product", "smartphone", "smartphones", "aircraft", "software", "operating system",
            "application software", "video game", "games", "car model", "motorcycle", "console",
            "operating system family", "device", "websites", "service", "line of smartphones",
            "software suite", "video game console", "game console", "pickup truck", "truck",
            "automobile", "electric vehicle", "sedan", "hatchback", "crossover", "suv"):
        return "product", TYPE_LABELS["product"]
    if has("city", "town", "island", "country", "state", "mountain", "river", "lake", "region",
            "province", "village", "capital", "borough", "district", "archipelago", "peninsula",
            "desert", "continent", "volcano", "national park", "metropolitan", "municipality",
            "settlement", "census-designated place", "capital of", "planet", "moon",
            "dwarf planet", "exoplanet"):
        return "place", TYPE_LABELS["place"]
    if has("concept", "theory", "ideology", "religion", "philosophy", "language", "algorithm",
            "field of", "book", "novel", "manifesto", "mathematics", "physics", "chemical element",
            "branch of", "discipline", "school of thought", "mathematical", "educational institution",
            "writing system"):
        return "concept", TYPE_LABELS["concept"]
    if has("organization", "university", "foundation", "government", "agency", "institute", "club",
            "union", "team", "department", "ministry", "party", "museum", "library", "hospital",
            "association", "movement"):
        return "organization", TYPE_LABELS["organization"]
    if has("species", "breed", "animal", "bird", "mammal", "fish", "reptile", "insect"):
        return "animal", TYPE_LABELS["animal"]
    return "other", TYPE_LABELS["other"]