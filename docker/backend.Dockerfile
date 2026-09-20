# --- Base image ---------------------------------------------------------
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv/null

# --- Build stage: install deps -------------------------------------------
FROM base AS deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Runtime stage ---------------------------------------------------------
FROM base AS runtime
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# Run as non-root for safety.
RUN addgroup --system null && adduser --system --ingroup null null

COPY backend/app ./app

USER null
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/healthz', timeout=4).status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]