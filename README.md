# null

A privacy-first metasearch engine — one query, many engines, zero logging.

`null` aggregates results across independent search engines (DuckDuckGo,
Marginalia, and Mwmbl), optionally Google through its official API,
merges
and ranks them, and forgets your query the moment you get your results.

- **No query logging** — queries and IPs are never persisted.
- **No tracking cookies** — an in-memory cache of shared results, never your identity.
- **Instant answers & knowledge panel** — math, unit/currency conversion, weather,
  dictionary and time answers, plus a Wikipedia/Wikidata-powered entity panel.
- **Web, images and videos** — image search fans out over Wikimedia Commons,
  Openverse and the Met Museum; video search over DuckDuckGo.
- **Transparent comparisons** — `/compare-privacy` puts our own privacy claims
  in the same table as Google, Bing, DuckDuckGo, Startpage, Brave, and SearXNG.
- **Auditable & open** — AGPL-3.0, buildable from source, self-hostable.

## Architecture

```
Browser ─▶ nginx (static SPA) ─▶ FastAPI /api ─▶ engines (async fan-out)
                       └───────────▶ /r?url=  redirect proxy (strips tracking)
```

| Layer     | Tech                                      | Responsibilities |
| --------- | ----------------------------------------- | ---------------- |
| Frontend  | React 18 + Vite + Tailwind CSS            | Home, results, /compare-privacy, settings, dark mode |
| Backend   | FastAPI (Python) + httpx (async)          | Aggregation, dedupe/rank, cache, rate limit, redirect proxy |
| Engines   | Pluggable adapters                        | Web: DuckDuckGo, Marginalia, Mwmbl, Google (official API) · Images: Wikimedia Commons, Openverse, Met Museum, Pexels (key) · Videos: DuckDuckGo |
| Infra     | Vercel, Docker Compose, nginx              | Zero-config Vercel deploy, one-command self-hosted, CI-ready Dockerfiles |

## Quick start

### Vercel (recommended)

```bash
# One-command deploy (assumes Vercel CLI is installed: npm i -g vercel)
vercel --prod

# Or: connect your Git repo at vercel.com/new — zero config.
# Set NULL_ENABLED_ENGINES in the Vercel dashboard → Settings → Environment Variables.
```

Vercel's FastAPI preset detects the `pyproject.toml` entrypoint automatically:
the React SPA is built into `public/` and served from the edge CDN, while the
FastAPI function handles all `/api/*` routes as a single serverless function.

| Vercel component | What it runs |
| ---------------- | ------------ |
| Edge CDN | `public/` (SPA shell, hashed JS/CSS) |
| Serverless function | `backend/app/main.py` — FastAPI on Python 3.12/3.13/3.14 |
| Rewrites (`vercel.json`) | Client routes (`/search`, `/compare-privacy`, …) → `index.html` |

> **Vercel serverless notes:** in-memory caching and token-bucket rate limiting
> reset on cold starts — this is a feature, not a bug: there's nothing to leak.

### Docker (self-hosted)

```bash
cp .env.example .env
docker compose up --build
# Open http://localhost:8080
```

### Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxies /api to :8000)
```

## Configuration

All knobs are environment variables with sensible, privacy-first defaults —
see [docs/CONFIG.md](docs/CONFIG.md) and `.env.example`.

Key ones:

| Variable | Purpose |
| -------- | ------- |
| `NULL_GOOGLE_CSE_KEY` / `NULL_GOOGLE_CSE_ID` | Official Google Custom Search JSON API (100 free queries/day) — set these to enable Google results |
| `NULL_TOR_PROXY` | SOCKS5 proxy (Tor) for captcha-gated engines (currently none) |
| `NULL_ENABLED_ENGINES` | Comma-separated engine list |
| `NULL_PEXELS_API_KEY` | Optional — activates the Pexels image engine (free key at pexels.com/api) |
| `NULL_ANALYTICS_ENABLED` | Aggregate counters only (never queries) |
| `NULL_ALLOW_HTML_SCRAPE_ENGINES` | Disabled by default; respects provider ToS |

## API

Summary (full details in [docs/API.md](docs/API.md)):

- `GET /api/search?q=…&category=…&language=` — aggregated results
- `GET /api/autocomplete?q=…` — suggestions, never logged
- `GET /api/compare-privacy` — JSON behind the comparison page
- `GET /api/analytics/snapshot` — aggregate counters only
- `GET /api/healthz`, `/api/engines` — health and engine roster

## Privacy model

- Queries are kept in memory for the duration of one request only.
- Rate limiting remembers buckets, not identities.
- Redirects (`/r?url=…`) prevent referrer leakage to result sites.
- Tracking parameters (`utm_*`, `gclid`, `fbclid`, …) are stripped.
- HTTPS is enforced in the nginx config; TLS terminates at your reverse proxy.

See [`frontend/src/pages/Privacy.tsx`](frontend/src/pages/Privacy.tsx) and the
[privacy policy page](//privacy) for the full, auditable policy.

## Open source & attribution

Licensed **AGPL-3.0** ([LICENSE](LICENSE)). This project is inspired by and
extends the architecture of **SearXNG** (AGPL-3.0) — see [NOTICE](NOTICE) for
attribution. `null` is an independent codebase; no SearXNG source file is
copied. Running a public instance carries the AGPL §13 obligation to offer
source to your users.

## Roadmap

- [x] Engine registry + aggregation + dedupe/rank
- [x] Home, results, compare-privacy, about/privacy/faq/contact/settings
- [x] Docker Compose, CI, AGPL compliance
- [x] Knowledge panel (Wikipedia + Wikidata, 30-day cache) and instant answers (math, units, currency, weather, dictionary, time)
- [ ] PostgreSQL analytics sink (aggregate only)
- [ ] Browser extension (`null://` protocol handler)
- [ ] Per-user preference sync (self-hosted)

## License

AGPL-3.0 © the null contributors. See [LICENSE](LICENSE) and [NOTICE](NOTICE).