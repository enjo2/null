import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { instantAnswer, resultHref, search } from "../lib/api";
import { SearchBar } from "../components/SearchBar";
import { ResultCards, ResultGrid, ResultList, engineLabel } from "../components/ResultCard";
import { KnowledgePanel } from "../components/KnowledgePanel";
import { Pagination } from "../components/Pagination";
import { InstantAnswerCard } from "../components/InstantAnswer";
import { EncryptOverlay } from "../components/EncryptOverlay";
import { ThemeToggle } from "../components/Layout";
import { usePrefs } from "../lib/prefs";
import type { InstantAnswerData, SearchResponse, SearchResultItem } from "../lib/types";

const CATEGORIES = [
  { id: "general", label: "All" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "news", label: "News" },
];
const MEDIA_CATEGORIES = new Set(["images", "videos"]);

const SEARCH_INPUT_ID = "null-search-input";
const RESULT_LINK_CLASS = "null-result-link";
// The API caps at 100 results; fetch the max once and paginate client-side.
const SERVER_FETCH_LIMIT = 100;

type Layout = "list" | "card" | "grid";

/** Thumbnail grid for images/videos searches. Images open the host page in a
 * new tab; videos open the embeddable player. */
function MediaGrid({ items, category }: { items: SearchResultItem[]; category: string }) {
  const isVideos = category === "videos";
  return (
    <div
      className={
        isVideos
          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      }
    >
      {items.map((item, i) => (
        <a
          key={`${item.url}-${i}`}
          href={resultHref(item.url)}
          target="_blank"
          rel="noreferrer noopener"
          className="card animate-fade-in group overflow-hidden"
          style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
          title={item.title}
        >
          <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <img
              src={item.thumbnail || ""}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0";
              }}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            {isVideos && item.duration && (
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
                {item.duration}
              </span>
            )}
            {!isVideos && item.publisher && (
              <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                {item.publisher}
              </span>
            )}
          </div>
          <div className="p-2.5">
            <p className="line-clamp-2 text-sm font-medium text-neutral-800 group-hover:text-brand dark:text-neutral-200 dark:group-hover:text-brand-muted">
              {item.title}
            </p>
            <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {isVideos ? item.publisher || item.domain || "" : item.domain || item.snippet || ""}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}

function LayoutToggle({ value, onChange }: { value: Layout; onChange: (l: Layout) => void }) {
  const opts: { id: Layout; label: string; path: string }[] = [
    { id: "list", label: "List view", path: "M4 6h16M4 12h16M4 18h16" },
    { id: "card", label: "Card view", path: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" },
    { id: "grid", label: "Grid view", path: "M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z" },
  ];
  return (
    <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700" role="group" aria-label="Result layout">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          aria-label={o.label}
          title={o.label}
          className={
            "inline-flex h-8 w-8 items-center justify-center transition-colors " +
            (value === o.id
              ? "text-brand dark:text-brand-muted"
              : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200")
          }
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d={o.path} />
          </svg>
        </button>
      ))}
    </div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export function Results() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "general";

  const { prefs, update } = usePrefs();

  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [instant, setInstant] = useState<InstantAnswerData | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [encryptKey, setEncryptKey] = useState(0);
  // Page can arrive from the URL (?page=2) so paginated views are shareable.
  const [page, setPage] = useState(() => {
    const p = parseInt(new URLSearchParams(window.location.search).get("page") ?? "1", 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [expanded, setExpanded] = useState(false); // "More results" appends pages
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const reqSeq = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  const mountedRef = useRef(true);

  const enginesFilter = useMemo(
    () => (prefs.excludedEngines.length ? prefs.excludedEngines.join(",") : undefined),
    [prefs.excludedEngines]
  );

  const run = useCallback(
    async (query: string, cat: string) => {
      if (!query.trim()) return;
      const seq = ++reqSeq.current;
      setLoading(true);
      setError(null);
      setEncryptKey((k) => k + 1); // retrigger the encryption animation
      try {
        const res = await search({
          q: query,
          category: cat,
          limit: SERVER_FETCH_LIMIT,
          language: prefs.language,
          safe: prefs.safeSearch ? 1 : -1,
          engines: enginesFilter,
        });
        if (mountedRef.current && seq === reqSeq.current) setData(res);
      } catch (e) {
        if (mountedRef.current && seq === reqSeq.current) {
          setError(e instanceof Error ? e.message : "Search failed");
        }
      } finally {
        if (mountedRef.current && seq === reqSeq.current) setLoading(false);
      }
    },
    // NOTE: intentionally excludes `page` — pagination is client-side slicing,
    // so changing pages must never re-fetch or reset state.
    [prefs.language, prefs.safeSearch, enginesFilter]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setData(null);
    setInstant(null);
    setPage(1); // fresh query -> back to the first page
    setExpanded(false);
    setPanelOpen(true); // fresh query -> panel open again
    if (q) {
      void run(q, category);
      if (prefs.instant) {
        instantAnswer(q)
          .then((a) => {
            if (mountedRef.current) setInstant(a);
          })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, run, prefs.instant]);

  const setCategory = (cat: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (cat === "general") next.delete("category");
    else next.set("category", cat);
    setSearchParams(next);
  };

  const okEngines = useMemo(
    () => (data?.engines ?? []).filter((e) => e.ok).length,
    [data]
  );

  /* ------------------------------------------------------- pagination */
  const perPage = Math.max(1, prefs.perPage);
  const pages = Math.max(1, Math.ceil((data?.results.length ?? 0) / perPage));
  const pageItems = useMemo(
    () =>
      data
        ? data.results.slice(expanded ? 0 : (page - 1) * perPage, page * perPage)
        : [],
    [data, page, perPage, expanded]
  );
  const pageStart = expanded ? 0 : (page - 1) * perPage;

  const gotoPage = useCallback((p: number) => {
    setPage(p);
    setExpanded(false);
  }, []);

  // Keep the page param in the URL (no reload) so views are shareable.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    if ((searchParams.get("page") ?? "1") !== String(page)) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // A changed per-page setting can leave the page out of range.
  useEffect(() => {
    if (page > pages) gotoPage(pages);
  }, [page, pages, gotoPage]);

  /* ------------------------------------------------- keyboard shortcuts */
  useEffect(() => {
    if (!prefs.shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing) return;

      if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
      } else if (e.key === "k" && prefs.panel) {
        setPanelOpen((v) => !v);
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && data?.results.length) {
        e.preventDefault();
        const links = resultsRef.current?.querySelectorAll<HTMLAnchorElement>(`a.${RESULT_LINK_CLASS}`);
        if (!links || links.length === 0) return;
        const current = Array.prototype.indexOf.call(links, document.activeElement);
        const next =
          e.key === "ArrowDown"
            ? current < 0
              ? 0
              : Math.min(links.length - 1, current + 1)
            : current < 0
              ? links.length - 1
              : Math.max(0, current - 1);
        links[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.shortcuts, prefs.panel, data]);

  // Knowledge panel only on the All tab — image/video grids don't need it.
  const showPanel = prefs.panel && panelOpen && !!q && category === "general";
  const fontSizeStyle = { fontSize: `${prefs.fontSize}%` } as const;

  return (
    <div className="py-6" style={fontSizeStyle}>
      {prefs.encryptAnim && <EncryptOverlay key={encryptKey} query={q} active={loading} />}
      <div className="sticky top-0 z-10 -mx-4 mb-2 flex items-center gap-3 border-b border-neutral-200/60 bg-white/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-neutral-800/60 dark:bg-neutral-950/80">
        <Link to="/" className="shrink-0" aria-label="null home">
          <img
            src="/favicon.jpg"
            alt=""
            width={30}
            height={30}
            className="rounded-lg"
            aria-hidden="true"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <SearchBar params={{ q, category }} size="md" inputId={SEARCH_INPUT_ID} />
        </div>
        <LayoutToggle value={prefs.layout} onChange={(layout) => update({ layout })} />
        {prefs.panel && (
          <button
            onClick={() => setPanelOpen((v) => !v)}
            aria-pressed={panelOpen}
            aria-label="Toggle knowledge panel"
            title={panelOpen ? "Hide knowledge panel (k)" : "Show knowledge panel (k)"}
            className={
              "icon-button shrink-0 " +
              (panelOpen ? "text-brand dark:text-brand-muted" : "")
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
              <path d="M3 12h6" fill="currentColor" />
            </svg>
          </button>
        )}
        <Link to="/settings" className="icon-button shrink-0" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
        <span className="shrink-0"><ThemeToggle size={15} /></span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Category filter">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
            className={
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors " +
              (category === c.id
                ? "bg-brand text-white"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-8 lg:flex-row">
        {/* ------------------------------------------------ main column */}
        <div className="min-w-0 flex-1">
          {/* Knowledge panel — first thing on the page, above the results */}
          {showPanel && !isMobile && (
            <div className="mb-6">
              <KnowledgePanel query={q} onClose={() => setPanelOpen(false)} position="top" />
            </div>
          )}

          {/* Instant answer */}
          {prefs.instant && instant && !loading && <InstantAnswerCard answer={instant} />}

          {/* Mobile: panel renders as a dismissible modal */}
          {showPanel && isMobile && (
            <KnowledgePanel query={q} onClose={() => setPanelOpen(false)} position="modal" />
          )}

          {!!q && (
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              {loading ? (
                "Searching…"
              ) : data ? (
                <>
                  {data.total} results for{" "}
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">"{data.query}"</span>
                  {" · "}
                  {data.query_time_ms} ms ·{" "}
                  {okEngines === 0 ? "no engines" : `${okEngines} of ${data.engines.length} engines`}
                  {data.dedupe_hits > 0 && ` · ${data.dedupe_hits} duplicates merged`}
                </>
              ) : null}
            </p>
          )}

          {error && (
            <div className="card border-red-200 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300">
              {error}
            </div>
          )}

          {!q && !error && (
            <div className="card p-8 text-center">
              <p className="text-neutral-600 dark:text-neutral-400">
                Enter a query to search the web privately.
              </p>
            </div>
          )}

          <div id="results-top" ref={resultsRef}>
            {q && !loading && !error && data && (
              <>
                {data.results.length === 0 ? (
                  <div className="card p-8 text-center">
                    <p className="text-neutral-600 dark:text-neutral-400">
                      No results found. Try different keywords, another category, or another language.
                    </p>
                  </div>
                ) : MEDIA_CATEGORIES.has(category) ? (
                  <MediaGrid items={pageItems} category={category} />
                ) : prefs.layout === "list" ? (
                  <ResultList items={pageItems} start={pageStart} linkClass={RESULT_LINK_CLASS} />
                ) : prefs.layout === "card" ? (
                  <ResultCards items={pageItems} linkClass={RESULT_LINK_CLASS} />
                ) : (
                  <ResultGrid items={pageItems} linkClass={RESULT_LINK_CLASS} />
                )}
              </>
            )}
          </div>

          {/* Pagination — at the bottom of the results */}
          {!loading && !error && data && data.results.length > 0 && (
            <Pagination
              page={page}
              pages={pages}
              perPage={perPage}
              total={data.results.length}
              onChangePage={gotoPage}
              onMore={() => {
                setPage((p) => p + 1);
                setExpanded(true);
              }}
              onChangePerPage={(n) => {
                update({ perPage: n });
                gotoPage(1);
              }}
            />
          )}

          {loading && data && (
            <div aria-live="polite" className="text-sm text-neutral-400">
              Refreshing…
            </div>
          )}

          {prefs.shortcuts && (
            <p className="mt-8 hidden text-xs text-neutral-400 lg:block dark:text-neutral-500">
              Shortcuts: <kbd className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">/</kbd> or{" "}
              <kbd className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">s</kbd> search ·{" "}
              <kbd className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">↓</kbd>{" "}
              <kbd className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">↑</kbd> navigate ·{" "}
              <kbd className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">k</kbd> panel ·{" "}
              <kbd className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">Esc</kbd> close
            </p>
          )}
        </div>

        {/* ------------------------------------------------- side column */}
        <aside className="w-full shrink-0 space-y-6 lg:w-72" aria-label="Search options">
          <div className="card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Engines in this query
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(data?.engines ?? []).map((e) => (
                <div
                  key={e.name}
                  className="group/tick relative flex items-center gap-2"
                  title={e.ok ? (e.result_count ? `${e.display_name} — ${e.result_count} results` : `${e.display_name} — no results`) : `${e.display_name}: ${e.error ?? "failed"}`}
                >
                  <span
                    aria-hidden="true"
                    className={"h-2 w-2 shrink-0 rounded-full " + (e.ok ? (e.result_count ? "bg-green-500" : "bg-amber-400") : "bg-neutral-300 dark:bg-neutral-700")}
                  />
                  <span className={"truncate " + (e.ok ? "" : "text-neutral-400 dark:text-neutral-500")}>
                    {engineLabel(e.name)}
                  </span>
                </div>
              ))}
            </div>

            <h2 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Privacy controls
            </h2>
            <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-green-600">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                No cookies set by null
              </li>
              <li className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-green-600">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Query stays server-side
              </li>
              <li className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-green-600">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Results via local redirect
              </li>
            </ul>

            <p className="mt-6 text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
              Language and result-per-page preferences belong in{" "}
              <Link to="/settings" className="text-brand hover:underline dark:text-brand-muted">
                Settings
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
