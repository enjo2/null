import { useCallback, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { autocomplete } from "../lib/api";
import type { SearchParams } from "../lib/types";

interface Props {
  params?: Partial<SearchParams>;
  autoFocus?: boolean;
  size?: "lg" | "md";
  inputId?: string; // exposed so keyboard shortcuts can focus the field
}

export function SearchBar({ params, autoFocus, size = "lg", inputId }: Props) {
  const [query, setQuery] = useState(params?.q ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => setQuery(params?.q ?? ""), [params?.q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const run = useCallback(
    (q: string) => {
      setOpen(false);
      const paramsObj = new URLSearchParams({ q });
      if (params?.category) paramsObj.set("category", params.category);
      if (params?.language) paramsObj.set("language", params.language);
      // Local-only recent searches, capped at 8. Never sent to the server.
      try {
        const KEY = "null.recent";
        const next = [q, ...((JSON.parse(localStorage.getItem(KEY) || "[]") as string[]) || [])]
          .filter((v, i, a) => v && a.indexOf(v) === i)
          .slice(0, 8);
        localStorage.setItem(KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("null:recent-changed"));
      } catch {
        /* storage unavailable */
      }
      navigate(`/search?${paramsObj.toString()}`);
    },
    [navigate, params?.category, params?.language]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) run(query.trim());
  };

  const debouncedSuggest = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await autocomplete(value.trim());
      setSuggestions(res.suggestions.map((s) => s.query));
    } catch {
      setSuggestions([]);
    }
  }, []);

  const timer = useRef<number | undefined>(undefined);
  const onInput = (value: string) => {
    setQuery(value);
    setOpen(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void debouncedSuggest(value), 180);
  };

  const big = size === "lg";

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <form onSubmit={submit} role="search" aria-label="Search">
        <div className="relative">
          <span
            className={
              "pointer-events-none absolute left-4 text-neutral-400 " +
              (big ? "top-3.5" : "top-3")
            }
          >
            <svg width={big ? 20 : 18} height={big ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            id={inputId}
            value={query}
            autoFocus={autoFocus}
            onChange={(e) => onInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter") submit(e);
            }}
            className={"input pl-11 " + (big ? "py-3.5 text-base" : "py-2.5 text-sm")}
            placeholder="Search without being tracked…"
            aria-label="Search query"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-ghost absolute right-2 top-1/2 -translate-y-1/2">
            <span className={big ? "" : "hidden sm:inline"}>Search</span>
          </button>
        </div>
      </form>

      {open && suggestions.length > 0 && (
        <ul className="card animate-fade-in absolute z-30 mt-1 w-full overflow-hidden py-1">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(s);
                  run(s);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-neutral-400">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <span className="truncate">{s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}