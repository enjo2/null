import { useEffect, useState } from "react";

interface Props {
  page: number;
  pages: number;
  perPage: number;
  total: number; // results on this search (server returns up to 100)
  onChangePage: (p: number) => void;
  onChangePerPage: (n: number) => void;
  onMore?: () => void; // provided when "More results" should append instead of jump
}

/**
 * DuckDuckGo-style bottom pagination:
 *
 *   [Prev]  1  2  3  …  8  [Next]      Jump to [ ] · Per page [10▾]
 *               [ More results ]
 *
 * Numbered pages with ellipsis elision, prev/next, a jump input and the
 * per-page selector (persisted in preferences). "More results" appends the
 * next page inline when `onMore` is provided, otherwise it jumps.
 */
export function Pagination({ page, pages, perPage, total, onChangePage, onChangePerPage, onMore }: Props) {
  const [jump, setJump] = useState(String(page));

  useEffect(() => {
    setJump(String(page));
  }, [page]);

  if (total === 0) return null;

  const goto = (p: number) => {
    const clamped = Math.min(Math.max(1, p), pages);
    if (clamped !== page) {
      onChangePage(clamped);
      document.getElementById("results-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const onJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jump, 10);
    if (Number.isFinite(n)) goto(n);
  };

  // Every page number, always visible — the pool caps at 100 results, so
  // the row is at most 10 buttons wide and never needs ellipsis elision.
  const nums: number[] = Array.from({ length: pages }, (_, i) => i + 1);

  const nav =
    "inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium transition-colors " +
    "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 " +
    "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent";
  const pageCls = (active: boolean) =>
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition-colors " +
    (active
      ? "bg-brand text-white"
      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800");

  return (
    <div className="mt-10 select-none">
      {/* More results — appends the next page inline. Always visible; disabled
          when the pool is exhausted so the control doesn't jump around. */}
      {onMore && (
        <div className="flex justify-center">
          <button
            onClick={onMore}
            disabled={page >= pages}
            title={page >= pages ? "No more results for this query" : `Load page ${page + 1}`}
            className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white dark:disabled:hover:bg-neutral-100"
          >
            {page >= pages ? "No more results" : "More results"}
          </button>
        </div>
      )}

      <nav
        className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 border-t border-neutral-200/70 pt-4 dark:border-neutral-800"
        aria-label="Search result pages"
      >
        {/* Prev / numbered pages / Next */}
        <div className="flex flex-wrap items-center justify-center gap-1">
          <button onClick={() => goto(page - 1)} disabled={page <= 1} className={nav} aria-label="Previous page">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Prev
          </button>
          {nums.map((n) => (
            <button key={n} onClick={() => goto(n)} aria-current={n === page ? "page" : undefined} className={pageCls(n === page)}>
              {n}
            </button>
          ))}
          <button onClick={() => goto(page + 1)} disabled={page >= pages} className={nav} aria-label="Next page">
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Jump to page */}
        <form onSubmit={onJumpSubmit} className="flex items-center gap-1.5">
          <label htmlFor="jump-page" className="text-sm text-neutral-500 dark:text-neutral-400">
            Jump to
          </label>
          <input
            id="jump-page"
            inputMode="numeric"
            pattern="[0-9]*"
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => setJump(String(page))}
            className="h-8 w-14 rounded-lg border border-neutral-300 bg-white px-2 text-center text-sm text-neutral-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            aria-label={`Jump to page, 1 to ${pages}`}
          />
        </form>

        {/* Results per page — persisted in preferences */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="per-page" className="text-sm text-neutral-500 dark:text-neutral-400">
            Per page
          </label>
          <select
            id="per-page"
            value={perPage}
            onChange={(e) => onChangePerPage(Number(e.target.value))}
            className="h-8 rounded-lg border border-neutral-300 bg-white px-1.5 text-sm text-neutral-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </nav>
    </div>
  );
}
