export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  engines_note?: string[];
  category: string;
  published_date?: string | null;
  score: number;
  position?: number | null;
  thumbnail?: string | null;
  language?: string | null;
  fetch_time_ms: number;
  domain?: string | null;       // bare host, shown as favicon chip in results
  domain_match?: boolean;      // true when host matches the query exactly
  // Media results (images/videos)
  width?: number | null;
  height?: number | null;
  publisher?: string | null;
  duration?: string | null;
}

export interface EngineStatus {
  name: string;
  display_name: string;
  ok: boolean;
  error?: string | null;
  result_count: number;
  fetch_time_ms: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  engines: EngineStatus[];
  total: number;
  query_time_ms: number;
  dedupe_hits: number;
  category: string;
  language: string;
  from_cache: boolean;
  search_id: string;
}

export interface Suggestion {
  query: string;
  engine: string;
}

export interface SuggestionsResponse {
  query: string;
  suggestions: Suggestion[];
}

export interface PrivacyFeature {
  id: string;
  label: string;
  value: number; // 0 no, 1 partial, 2 yes
  note?: string | null;
}

export interface PrivacyEngine {
  id: string;
  name: string;
  url: string;
  logo?: string | null;
  open_source: number;
  jurisdiction: string;
  features: PrivacyFeature[];
  sources: string[];
}

export interface ComparisonData {
  generated_at: string;
  meta: Record<string, string>;
  engines: PrivacyEngine[];
  feature_definitions: PrivacyFeature[];
}

export interface AnalyticsSnapshot {
  total_queries: number;
  queries_last_24h: number;
  avg_query_time_ms: number;
  top_categories: { category: string; count: number }[];
  dedupe_rate: number;
  engine_health: Record<string, boolean>;
}

export interface SearchParams {
  q: string;
  category?: string;
  language?: string;
  limit?: number;
  safe?: number;
  engines?: string; // comma-separated names to query
  // Client-side pagination window — used by the results page, never sent to the API.
  offset?: number;
  offsetEnd?: number;
}

export interface EngineInfo {
  name: string;
  display_name: string;
  tier: string; // native | api | scrape
  enabled: boolean;
  kind?: string; // web | media — media engines don't belong in "Powered by"
  notes?: string[];
}

// --- Knowledge panel -------------------------------------------------------

export interface KnowledgeAttribute {
  key: string;
  value: string;
  kind: "text" | "link" | "date" | "number";
  href?: string | null;
  tooltip?: string | null;
}

export interface KnowledgeLink {
  key: string; // website | wikipedia | instagram | facebook | twitter | linkedin | youtube | email | external
  label: string;
  icon: string;
  url: string;
}

export interface RelatedEntity {
  title: string;
  url: string;
  thumbnail?: string | null;
  description?: string | null;
}

export interface KnowledgePanelData {
  name: string;
  entity_type:
    | "company"
    | "person"
    | "place"
    | "product"
    | "concept"
    | "organization"
    | "event"
    | "film"
    | "music"
    | "animal"
    | "other";
  type_label: string;
  tagline: string;
  description: string;
  wiki_url: string;
  wikidata_id?: string | null;
  image?: string | null;
  thumbnail?: string | null;
  attributes: KnowledgeAttribute[];
  links: KnowledgeLink[];
  related: RelatedEntity[];
  sources: string[];
  confidence: number;
  from_cache: boolean;
  fetched_at?: string | null;
  ttl_days: number;
}

// --- Instant answers -------------------------------------------------------

export interface InstantAnswerData {
  kind: "math" | "unit-conversion" | "currency" | "weather" | "dictionary" | "time" | "generic";
  title: string;
  subtitle: string;
  value: string;
  detail: string;
  icon: string;
  extra: string[];
  source: string;
}