import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { enginesCatalog } from "../lib/api";
import { SearchBar } from "../components/SearchBar";
import { EngineLogo } from "../components/EngineLogo";
import type { EngineInfo } from "../lib/types";

/**
 * Local-only recent searches, stored in localStorage and capped at 8 entries.
 * Never transmitted anywhere; "Clear" removes them entirely.
 */
function RecentSearches() {
  const KEY = "null.recent";
  const navigate = useNavigate();
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]") as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setRecent(JSON.parse(localStorage.getItem(KEY) || "[]") as string[]);
      } catch {
        setRecent([]);
      }
    };
    window.addEventListener("null:recent-changed", sync);
    return () => window.removeEventListener("null:recent-changed", sync);
  }, []);

  if (recent.length === 0) return null;

  return (
    <div className="animate-fade-in mt-4 [animation-delay:120ms]">
      <div className="flex items-center justify-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
        <span className="font-medium uppercase tracking-wide">Recent</span>
        {recent.map((r) => (
          <button
            key={r}
            onClick={() => navigate(`/search?q=${encodeURIComponent(r)}`)}
            className="max-w-40 truncate rounded-full bg-neutral-100 px-2.5 py-1 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => {
            localStorage.removeItem(KEY);
            setRecent([]);
          }}
          className="hover:text-neutral-700 dark:hover:text-neutral-300"
          aria-label="Clear recent searches"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function Home() {
  const [catalog, setCatalog] = useState<EngineInfo[]>([]);

  useEffect(() => {
    enginesCatalog().then(setCatalog).catch(() => {});
  }, []);

  // "Powered by" shows web engines only — media engines (images/videos
  // sources) are showcased on their search tabs instead.
  const isWeb = (e: EngineInfo) => e.kind !== "media";
  const enabled = catalog.filter((e) => e.enabled && isWeb(e));
  const disabled = catalog.filter((e) => !e.enabled && isWeb(e));

  return (
    <>
      {/* Decorative aurora backdrop (three drifting accent ribbons). */}
      <div className="home-bg" aria-hidden="true">
        <span className="home-bg-ribbon" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-16">
      <section className="flex w-full max-w-xl flex-col items-center gap-10" aria-labelledby="home-title">
        {/* Logo mark */}
        <div className="animate-fade-in">
          <img
            src="/favicon.jpg"
            alt="null logo"
            width={64}
            height={64}
            className="rounded-2xl shadow-card"
          />
        </div>

        {/* Search bar */}
        <div className="animate-fade-in w-full [animation-delay:80ms]">
          <SearchBar autoFocus size="lg" />
          <RecentSearches />
        </div>

        {/* Powered by: engines row */}
        <div className="animate-fade-in flex flex-col items-center gap-3 [animation-delay:160ms]">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            {enabled.map((e) => (
              <span key={e.name} className="group relative inline-flex items-center gap-1.5 transition hover:scale-105">
                <EngineLogo engine={e.name} size={26} />
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{e.display_name}</span>
              </span>
            ))}
          </div>
          {disabled.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-neutral-400 dark:text-neutral-500">
              <span className="mr-1 uppercase tracking-wide">also supported</span>
              {disabled.map((e) => (
                <span key={e.name} className="group relative inline-flex items-center gap-1 opacity-50 transition hover:opacity-100" title={e.notes?.join("; ")}>
                  <EngineLogo engine={e.name} size={18} />
                  <span>{e.display_name}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      </section>
    </div>
    </>
  );
}