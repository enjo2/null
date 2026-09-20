# null — API reference

All endpoints are served under `/api` and return JSON. Everything is `GET`;
there is no state to write. OpenAPI docs are generated automatically at
`/docs` (Swagger UI) and `/openapi.json`.

Base URL (prod): `https://your.instance/api` · (dev): `http://localhost:5173/api`

## Search — `GET /api/search`

Aggregates all enabled engines, dedupes, and ranks.

| Param      | Type   | Default   | Notes |
| ---------- | ------ | --------- | ----- |
| `q`        | string | (required)| Query. Truncated at 300 chars. |
| `category` | string | `general` | `general`, `web`, `images`, `news`, `knowledge`, … (engine-dependent) |
| `language` | string | `auto`    | `auto`, or a language code passed through to engines |
| `limit`    | int    | `20`      | Results returned, 1–100 |

Example:

```bash
curl "https://instance/api/search?q=privacy+metasearch&limit=5"
```

```jsonc
{
  "query": "privacy metasearch",
  "results": [
    {
      "title": "Metasearch engine - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Metasearch_engine",
      "snippet": "...",
      "engine": "duckduckgo+mwmbl",   // "+" = corroborated by many engines
      "engines_note": ["duckduckgo", "mwmbl"],
      "category": "web",
      "score": 2.4135,
      "position": 0
    }
  ],
  "engines": [                            // per-engine health status
    { "name": "duckduckgo", "ok": true,  "result_count": 15, "fetch_time_ms": 410 },
    { "name": "googleapi", "ok": false, "error": "GOOGLE_CSE_KEY and GOOGLE_CSE_ID are not configured", ... }
  ],
  "total": 25,
  "query_time_ms": 1123,
  "dedupe_hits": 7,                       // merged duplicates
  "category": "general",
  "language": "auto",
  "from_cache": false,                    // true when served from the shared cache
  "search_id": "a1b2c3..."
}
```

### DNS-level privacy

No endpoint except `/search` touches query text. `search_id` is random and
uncorrelated. The cache key is a SHA-256 of the query; we store only the hash.

## Suggestions — `GET /api/autocomplete`

| Param | Type   | Notes |
| ----- | ------ | ----- |
| `q`   | string | Prefix, truncated at 100 chars. 422 if empty. |

Returns up to 10 `{ query, engine }` items. Used by the search bar. Response
caching and rate limits are the same as search.

## Knowledge panel — `GET /api/knowledge-panel`

Detects the entity behind a query and returns a rich panel (Wikipedia summary
+ Wikidata facts), or `null` when nothing matches confidently (> 75%).

| Param | Type   | Notes |
| ----- | ------ | ---- |
| `q`   | string | Query or entity name, truncated at 200 chars. |

```jsonc
{
  "name": "Tesla, Inc.",
  "entity_type": "company",        // company|person|place|product|concept|organization|event|film|music|animal|other
  "type_label": "Company",
  "tagline": "American automotive and clean energy company",
  "description": "Tesla, Inc. is an American multinational automotive and clean energy company…",
  "wiki_url": "https://en.wikipedia.org/wiki/Tesla,_Inc.",
  "wikidata_id": "Q478095",
  "image": "https://commons.wikimedia.org/…",
  "thumbnail": "https://upload.wikimedia.org/…",
  "attributes": [
    { "key": "Founder(s)", "value": "Elon Musk…", "kind": "text",
      "href": "https://www.wikidata.org/wiki/Q317521", "tooltip": null },
    { "key": "Website", "value": "tesla.com", "kind": "link", "href": "https://www.tesla.com", "tooltip": null }
  ],
  "links": [
    { "key": "wikipedia", "label": "Wikipedia", "icon": "wikipedia", "url": "…" },
    { "key": "twitter",   "label": "Twitter",   "icon": "twitter",   "url": "…" }
  ],
  "related": [ { "title": "SpaceX", "url": "…", "thumbnail": null, "description": "…" } ],
  "sources": ["wikipedia", "wikidata"],
  "confidence": 0.93,
  "from_cache": false,
  "fetched_at": "2026-09-15T12:00:00+00:00",
  "ttl_days": 30
}
```

Privacy: panels are cached server-side for 30 days keyed by a **hash of the
detected entity title** — never the query — and the browser keeps its own
hash-keyed localStorage mirror. No query or entity history is stored.

## Instant answers — `GET /api/instant`

Deterministic answers shown above the results: math (`2+2`, `sqrt(16)`), unit
and temperature conversion (`100 km to miles`, `32f to c`), currency (`50 usd
to eur`), weather (`weather in berlin`), dictionary (`define serendipity`),
and time (`time in tokyo`). Returns `null` when the query isn't an
instant-answer shape.

```jsonc
{
  "kind": "unit-conversion",       // math|unit-conversion|currency|weather|dictionary|time
  "title": "Unit conversion",
  "subtitle": "100 kilometres to miles",
  "value": "62.14 miles",
  "detail": "",
  "icon": "ruler",
  "extra": ["length conversion computed locally"],
  "source": "offline"
}
```

## Redirect proxy — `GET /api/r?url=<url>`

Issues a 302 to the (cleaned) destination. Strips `utm_*`, `gclid`, `fbclid`,
`mc_*`, and friends from the target URL. The referrer the destination sees is
your instance's `/api/r` — never your query.

## Privacy comparison — `GET /api/compare-privacy`

The machine-readable data behind the web page at `/compare-privacy`.

```jsonc
{
  "generated_at": "2026-09-15T…",
  "meta": { "value_scale": "0=no, 1=partial, 2=yes" },
  "engines": [
    {
      "id": "google", "name": "Google", "url": "…", "jurisdiction": "USA",
      "open_source": 0,
      "features": [{ "id": "no_logging", "label": "…", "value": 0, "note": null }]
    }
  ],
  "feature_definitions": [/* ids + labels live here */]
}
```

Consumers can compute each engine's score as
`sum(feature.value) / (len(feature_definitions) * 2)`.

## Analytics — `GET /api/analytics/snapshot`

Aggregate, non-identifying counters. Contains no queries, IPs, or user agents.

## Health — `GET /api/healthz`

Engine roster, cache stats, uptime. Used by Docker healthchecks and nginx.

## Engines — `GET /api/engines`

Static roster of configured engines with tier and supported categories.

---

## Error handling

- `422` — query string validation (`q` missing/empty for `/search`).
- `429` — rate limit exceeded. Bucket is per-IP, in-memory.
- `5xx` — upstream engine failures are contained per-engine and surfaced in
  the `engines[]` status array, not as HTTP errors.

## Client example

```bash
Q="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "privacy+metasearch")"
curl -s "https://instance/api/search?q=$Q&limit=20"
```

The frontend (React) consumes exactly this API via `frontend/src/lib/api.ts`.