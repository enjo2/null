# null — Installation & configuration

Three paths: **Vercel**, **Docker Compose**, and **bare metal**.

## Vercel (recommended)

Prerequisites: [Vercel CLI](https://vercel.com/docs/cli) ≥ 48.1, Node ≥ 18.

```bash
git clone <your-repo-url> null && cd null
vercel --prod        # follow prompts; project is detected automatically
```

Or connect the repo at <https://vercel.com/new> — Vercel detects the FastAPI
`pyproject.toml` preset and runs the build step (`frontend → public/`).

### How it works on Vercel

```
Request path          → component that serves it
─────────────────────────────────────────────────
/assets/*             → Vercel Edge CDN (immutable cache)
/search               → vercel.json rewrite → /index.html (CDN)
/api/*                → FastAPI serverless function
/docs, /openapi.json  → FastAPI serverless function
/                     → /index.html (CDN)
```

Every `/api/*` request is a fresh serverless invocation. There is no shared
state between invocations — in-memory cache is per warm instance only — which
is the privacy-preserving default. No queries or IPs survive the function
timeout.

### Setting env vars on Vercel

```bash
vercel env add NULL_ENABLED_ENGINES      # e.g. duckduckgo,bing,marginalia
```

Or do it in the Vercel Dashboard → your project → Settings → Environment
Variables.

### Serverless function size

The Python bundle includes `backend/app/` and all pip dependencies. The
`.vercelignore` excludes `frontend/node_modules`, `tests/`, and `docker/` to
stay within Vercel's function size limits (500 MB). The `build` script places
the SPA output into `public/`, which is served from the edge CDN — never from
the function.

## Docker Compose (self-hosted)

Prerequisites: Docker ≥ 24, `docker compose` plugin.

```bash
git clone <your-repo-url> null
cd null
cp .env.example .env          # edit engines/keys you want
docker compose up --build -d
docker compose ps             # frontend :8080 healthy, backend healthy
```

Open `http://localhost:8080`. If you change `NULL_*` variables:

```bash
docker compose up -d          # recreates containers with new env
```

### Routing captcha-gated engines through Tor (optional)

Some providers (Yandex, Qwant, Startpage, Mojeek, Ecosia) answer server
traffic with a captcha — this pipeline routes an engine's requests through a
local Tor SOCKS5 proxy when the engine sets ``use_tor = True``:

1. Install Tor (e.g. `apt-get install tor`), leave its SOCKS proxy on the
   default port so it listens at `127.0.0.1:9050`:

   ```bash
   systemctl enable --now tor
   ss -lntp | grep 9050      # should show tor
   ```

2. Set the proxy in null's `.env` (or `vercel env add NULL_TOR_PROXY`):

   ```
   NULL_TOR_PROXY=socks5://127.0.0.1:9050
   ```

   With the value empty/null, engines use the direct connection. (No shipped
   engine currently sets `use_tor` — the flag is plumbing for future engines.)

## Bare metal (backend)

Requires Python ≥ 3.11.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export NULL_ENABLED_ENGINES=duckduckgo
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

## Bare metal (frontend dev)

Requires Node ≥ 18.

```bash
cd frontend
npm install
npm run dev          # :5173 with /api proxied to :8000
# production preview
npm run build && npm run preview
```

## Environment reference

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `NULL_HTTP_PORT` | `8080` | Host port for the web UI (nginx). |
| `NULL_ENABLED_ENGINES` | native defaults | Comma-separated engine ids. |
| `NULL_GOOGLE_CSE_KEY`, `NULL_GOOGLE_CSE_ID` | *(empty)* | Official Google Custom Search JSON API (100 free queries/day). |
| `NULL_TOR_PROXY` | *(empty)* | SOCKS5 proxy (e.g. `socks5://127.0.0.1:9050`) for captcha-gated engines (none currently). |
| `NULL_ALLOW_HTML_SCRAPE_ENGINES` | `false` | Enable the Bing/Marginalia HTML adapters. Respect each provider's ToS before enabling. |
| `NULL_ANALYTICS_ENABLED` | `true` | Aggregate counters only. Never queries/IPs. |
| `NULL_CACHE_ENABLED` | `true` | In-memory result cache. |
| `NULL_CACHE_TTL_SECONDS` | `600` | Cache lifetime. |
| `NULL_LOG_QUERIES` | `false` | Keep `false` — the whole point. |
| `NULL_RATE_LIMIT_PER_MINUTE` | `30` | Per-IP requests/min. |
| `NULL_RATE_LIMIT_BURST` | `8` | Token bucket burst. |
| `NULL_TRUST_PROXY_HEADERS` | `false` | Honor `X-Forwarded-For` for rate limiting (set `true` behind nginx; the compose file does). |
| `NULL_TIMEOUT_MS` | `6000` | Per-engine hard timeout. |
| `NULL_MAX_RESULTS_PER_ENGINE` | `15` | Results harvested per engine. |
| `NULL_MAX_RESULTS_TOTAL` | `50` | Results returned max. |
| `NULL_STRIP_TRACKING_PARAMS` | `true` | Strip `utm_*`/`gclid`/etc. on the `/r` redirect and search responses. |

## Reverse proxy / HTTPS

The nginx container already sets good security headers. For TLS, put a
reverse proxy (Caddy/Traefik/your cloud LB) in front of the frontend port and
terminate TLS there. Example Caddyfile:

```
null.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

## Health & operations

- `docker compose healthcheck` — `GET /api/healthz` must return 200.
- Grafana/Prometheus can scrape `/api/analytics/snapshot` (add prometheus-client
  to your stack; the endpoint is JSON, not Prometheus format — see roadmap).

## Updating comparison data

```bash
python scripts/update_comparison.py --refresh   # rebuilds backend/app/comparison/data.json
python scripts/update_comparison.py --dry-run   # preview scores without writing
```

Run this whenever any compared provider publishes a new privacy policy, and
commit the regenerated JSON so the page stays auditable.