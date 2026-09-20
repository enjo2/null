import type {
  AnalyticsSnapshot,
  ComparisonData,
  EngineInfo,
  InstantAnswerData,
  KnowledgePanelData,
  SearchParams,
  SearchResponse,
  SuggestionsResponse,
} from "./types";

// --- Local knowledge-panel cache (30-day TTL, hash-keyed) ------------------
//
// Panels are cached in localStorage keyed by a SHA-256 of the normalized
// query, so browsing the storage never reveals a readable search history.
// Only panel data is stored — never the raw queries — and entries expire
// after 30 days, matching the server-side TTL.

const PANEL_CACHE_PREFIX = "null.kp.";
const PANEL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface PanelCacheEntry {
  at: number;
  panel: KnowledgePanelData;
}

async function panelCacheKey(query: string): Promise<string> {
  const normalized = query.trim().toLowerCase();
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fall through to plain key */
  }
  return normalized;
}

function prunePanelCache() {
  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PANEL_CACHE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const entry = JSON.parse(raw) as PanelCacheEntry;
        if (!entry?.at || now - entry.at > PANEL_TTL_MS) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage unavailable (private mode) — cache is best-effort */
  }
}

async function getCachedPanel(query: string): Promise<KnowledgePanelData | null> {
  try {
    const key = PANEL_CACHE_PREFIX + (await panelCacheKey(query));
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as PanelCacheEntry;
    if (!entry?.panel || Date.now() - entry.at > PANEL_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return { ...entry.panel, from_cache: true };
  } catch {
    return null;
  }
}

async function setCachedPanel(query: string, panel: KnowledgePanelData): Promise<void> {
  try {
    prunePanelCache();
    const entry: PanelCacheEntry = { at: Date.now(), panel };
    localStorage.setItem(PANEL_CACHE_PREFIX + (await panelCacheKey(query)), JSON.stringify(entry));
  } catch {
    /* best-effort */
  }
}

const BASE = import.meta.env.VITE_API_BASE || "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "omit" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function search(params: SearchParams): Promise<SearchResponse> {
  const qs = new URLSearchParams();
  qs.set("q", params.q);
  if (params.category && params.category !== "general") qs.set("category", params.category);
  if (params.language && params.language !== "auto") qs.set("language", params.language);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.engines) qs.set("engines", params.engines);
  return get<SearchResponse>(`/search?${qs.toString()}`);
}

export function autocomplete(q: string): Promise<SuggestionsResponse> {
  return get<SuggestionsResponse>(`/autocomplete?q=${encodeURIComponent(q)}`);
}

export function comparison(): Promise<ComparisonData> {
  return get<ComparisonData>("/compare-privacy");
}

export function analytics(): Promise<AnalyticsSnapshot> {
  return get<AnalyticsSnapshot>("/analytics/snapshot");
}

export function enginesCatalog(): Promise<EngineInfo[]> {
  return get<EngineInfo[]>("/engines/catalog");
}

export function resultHref(rawUrl: string): string {
  return `${BASE}/r?url=${encodeURIComponent(rawUrl)}`;
}

/** Fetch a knowledge panel, backed by the local 30-day cache. */
export async function knowledgePanel(q: string): Promise<KnowledgePanelData | null> {
  const cached = await getCachedPanel(q);
  if (cached) return cached;
  const panel = await get<KnowledgePanelData | null>(`/knowledge-panel?q=${encodeURIComponent(q)}`);
  if (panel) void setCachedPanel(q, panel);
  return panel;
}

/** Fetch an instant answer (math, units, currency, weather, define, time). */
export function instantAnswer(q: string): Promise<InstantAnswerData | null> {
  return get<InstantAnswerData | null>(`/instant?q=${encodeURIComponent(q)}`);
}