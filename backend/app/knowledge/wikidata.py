"""Wikidata source: structured attributes, social links, official website.

We fetch the entity JSON (`Special:EntityData`) once, map the claims we care
about per entity type, and batch-resolve referenced entity ids to English
labels in a single `wbgetentities` call. No user data ever leaves the process.
"""

from __future__ import annotations

import urllib.parse

import httpx

from .models import KnowledgeAttribute, KnowledgeLink

# property id -> attribute key + optional value kind
_ATTRS = {
    "P571": ("Inception", "date"),             # foundation / established date
    "P112": ("Founder(s)", "text"),            # founded by
    "P159": ("Headquarters", "text"),          # headquarters location
    "P856": ("Website", "link"),               # official website
    "P1454": ("Type", "text"),                 # legal form
    "P414": ("Stock ticker", "text"),          # stock exchange ticker symbol
    "P2541": ("Area served", "text"),
    "P1082": ("Population", "number"),
    "P2046": ("Area", "text"),
    "P36": ("Capital", "text"),
    "P569": ("Born", "date"),
    "P570": ("Died", "date"),
    "P27": ("Nationality", "text"),
    "P106": ("Occupation", "text"),
    "P800": ("Known for", "text"),
    "P17": ("Country", "text"),
    "P131": ("Located in", "text"),
    "P178": ("Developer", "text"),
    "P577": ("Released", "date"),
    "P175": ("Performer", "text"),
    "P136": ("Genre", "text"),
    "P407": ("Language", "text"),
    "P1104": ("Pages", "number"),
    "P184": ("Founding", "text"),
}

# social / external link properties -> (icon key, label, url template)
_LINKS = {
    "P856": ("official", "Official website", "{v}"),
    "P2002": ("twitter", "Twitter", "https://twitter.com/{v}"),
    "P2013": ("facebook", "Facebook", "https://www.facebook.com/{v}"),
    "P4033": ("instagram", "Instagram", "https://www.instagram.com/{v}"),
    "P2003": ("linkedin", "LinkedIn", "https://www.linkedin.com/{v}"),
    "P2397": ("youtube", "YouTube", "https://www.youtube.com/{v}"),
    "P968": ("email", "Contact", "mailto:{v}"),
}

# IMDb id (P345): prefix decides the URL kind — tt=title, nm=person.
_IMDB_PROP = "P345"

# claims whose raw value is an entity id (resolve to a label)
_ENTITY_VAL_PROPS = {"P112", "P159", "P2541", "P36", "P27", "P106", "P17", "P131", "P178", "P175", "P184"}
# claims whose raw value is a URL
_URL_PROPS = {"P856"}


def _fmt_date(value: str) -> str:
    """Format a Wikidata ISO date (1976-02-04T00:00:00Z -> 4 Feb 1976)."""
    import datetime as dt

    try:
        text = (value or "").split("T")[0]
        d = dt.date.fromisoformat(text)
        return d.strftime("%d %b %Y")
    except Exception:  # noqa: BLE001
        return (value or "").split("T")[0]


async def _raw_claims(client: httpx.AsyncClient, qid: str) -> dict | None:
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    resp = await client.get(url, headers={"Accept": "application/json"}, follow_redirects=True)
    if resp.status_code != 200:
        return None
    try:
        body = resp.json()
    except Exception:  # noqa: BLE001
        return None
    entity = (body.get("entities") or {}).get(qid)
    if not entity:
        return None
    return (entity.get("claims") or {})


def _claim_values(claims: dict, prop: str) -> list[dict]:
    """Return the datavalue dicts for all value-snaks of a property."""
    out = []
    for claim in claims.get(prop, []):
        snak = claim.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        dv = snak.get("datavalue") or {}
        if dv:
            out.append(dv)
    return out


def _entity_id(claim: dict) -> str | None:
    dv = (claim.get("mainsnak") or {}).get("datavalue") or {}
    val = dv.get("value")
    if isinstance(val, dict):
        return val.get("id")
    return None


async def _resolve_entities(client: httpx.AsyncClient, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    uniq = list(dict.fromkeys(ids))
    resp = await client.get(
        "https://www.wikidata.org/w/api.php",
        params={
            "action": "wbgetentities",
            "ids": "|".join(uniq),
            "props": "labels",
            "languages": "en",
            "languagefallback": "1",
            "format": "json",
        },
    )
    if resp.status_code != 200:
        return {}
    try:
        ents = resp.json().get("entities", {})
    except Exception:  # noqa: BLE001
        return {}
    out: dict[str, str] = {}
    for qid, ent in ents.items():
        labels = ent.get("labels", {})
        if labels:
            out[qid] = labels.get("en", {}).get("value", qid)
        else:
            out[qid] = qid
    return out


async def _wikimedia_logo(client: httpx.AsyncClient, qid: str) -> str | None:
    """Best-effort image: whatever the entity's Wikipedia article uses."""
    resp = await client.get(
        "https://www.wikidata.org/w/api.php",
        params={
            "action": "wbgetentities",
            "ids": qid,
            "props": "claims",
            "languages": "en",
            "format": "json",
        },
    )
    if resp.status_code != 200:
        return None
    try:
        claims = (resp.json().get("entities", {}).get(qid, {}).get("claims", {}))
    except Exception:  # noqa: BLE001
        return None
    img = (claims or {}).get("P18", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    if not img:
        return None
    name = urllib.parse.quote(img.replace(" ", "_"))
    return f"https://commons.wikimedia.org/wiki/Special:Redirect/file/{name}?width=400"


async def fetch_wikidata(
    client: httpx.AsyncClient,
    qid: str,
    *,
    entity_type: str,
) -> tuple[list[KnowledgeAttribute], list[KnowledgeLink], str | None]:
    """Return (attributes, links, image_url) built from Wikidata claims."""
    claims = await _raw_claims(client, qid)
    if not claims:
        return [], [], None

    resolve_ids: list[str] = []
    for prop in _ENTITY_VAL_PROPS:
        for claim in claims.get(prop, []):
            eid = _entity_id(claim)
            if eid:
                resolve_ids.append(eid)

    labels = await _resolve_entities(client, resolve_ids)
    for eid in list(labels):
        if "." not in eid:
            labels.setdefault(eid, eid)

    attributes: list[KnowledgeAttribute] = []
    links: list[KnowledgeLink] = []
    seen_attrs: set[str] = set()
    seen_urls: set[str] = set()
    seen_keys: set[str] = set()

    for prop, (key, kind) in _ATTRS.items():
        values = _claim_values(claims, prop)
        for v in values:
            if key in seen_attrs:
                break
            seen_attrs.add(key)
            dv = v if isinstance(v, dict) else {}
            val = dv.get("value")
            if prop in _ENTITY_VAL_PROPS and isinstance(val, dict) and val.get("id"):
                label = labels.get(val["id"])
                if not label:
                    continue
                attributes.append(
                    KnowledgeAttribute(
                        key=key,
                        value=label,
                        kind=kind,
                        href=f"https://www.wikidata.org/wiki/{val['id']}",
                    )
                )
                break
            elif prop in _URL_PROPS and isinstance(val, str):
                attributes.append(KnowledgeAttribute(key=key, value=val, kind="link", href=val))
                break
            elif isinstance(val, str):
                if key in ("Born", "Died", "Released", "Inception") and kind == "date":
                    val = _fmt_date(val)
                attributes.append(KnowledgeAttribute(key=key, value=str(val)[:120], kind=kind))
                break

    # Preferred-rank first; avoid duplicates.
    for prop, (icon, label, tmpl) in _LINKS.items():
        for claim in claims.get(prop, []):
            snak = claim.get("mainsnak", {})
            if snak.get("snaktype") != "value":
                continue
            dv = snak.get("datavalue", {}).get("value")
            value = dv if isinstance(dv, str) else ((dv or {}).get("id") if isinstance(dv, dict) else None)
            if not value or not str(value).strip():
                continue
            text = str(value).strip()
            key = icon
            if icon == "official":
                key = "website"
                text = _pretty_host(text)
            elif icon == "email":
                text = text.removeprefix("mailto:")
                if not text:
                    continue
            link = KnowledgeLink(key=key, label=label, icon=key, url=_safe_link(tmpl, text))
            # One link per service: multiple claims (channel + handle) would
            # otherwise render twice in the quick-links row.
            if link.url and link.url not in seen_urls and key not in seen_keys:
                seen_urls.add(link.url)
                seen_keys.add(key)
                links.append(link)

    # IMDb (P345): 'tt…' ids are works/films, 'nm…' ids are people.
    for claim in claims.get(_IMDB_PROP, []):
        snak = claim.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        value = snak.get("datavalue", {}).get("value")
        imdb_id = str(value or "").strip()
        if not imdb_id:
            continue
        kind = "name" if imdb_id.startswith("nm") else "title"
        url = f"https://www.imdb.com/{kind}/{urllib.parse.quote(imdb_id, safe=':')}/"
        if url not in seen_urls:
            seen_urls.add(url)
            links.append(
                KnowledgeLink(key="imdb", label="IMDb", icon="imdb", url=url)
            )
            break

    image = await _wikimedia_logo(client, qid)
    return attributes, links, image


def _pretty_host(url: str) -> str:
    try:
        return urllib.parse.urlsplit(url).netloc.removeprefix("www.")
    except Exception:  # noqa: BLE001
        return url


def _safe_link(template: str, value: str) -> str:
    if template.startswith("{v}"):
        return value
    safe = ":/@.-_~"
    return template.replace("{v}", urllib.parse.quote(value, safe=safe))