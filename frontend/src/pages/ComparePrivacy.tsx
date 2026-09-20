import { useCallback, useEffect, useMemo, useState } from "react";
import { comparison, analytics } from "../lib/api";
import type {
  AnalyticsSnapshot,
  ComparisonData,
} from "../lib/types";

type Value = 0 | 1 | 2;

function Indicator({ value }: { value: Value }) {
  if (value === 2) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        title="Yes"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Yes">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (value === 1) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        title="Partial"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Partial">
          <rect x="4" y="10" width="16" height="4" rx="2" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      title="No"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-label="No">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-neutral-600 dark:text-neutral-400">
      <span className="inline-flex items-center gap-2">
        <Indicator value={2} /> = full commitment
      </span>
      <span className="inline-flex items-center gap-2">
        <Indicator value={1} /> = partial / self-reported
      </span>
      <span className="inline-flex items-center gap-2">
        <Indicator value={0} /> = no
      </span>
    </div>
  );
}



export function ComparePrivacy() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [stats, setStats] = useState<AnalyticsSnapshot | null>(null);
  const [showNotes, setShowNotes] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([comparison(), analytics()]);
      setData(c);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comparison data");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featureRows = useMemo(() => {
    if (!data) return [];
    return data.feature_definitions.map((f) => {
      const values: Array<{ value: Value; note?: string | null }> = data.engines.map((eng) => {
        const feat = eng.features.find((x) => x.id === f.id);
        return { value: (feat?.value ?? 0) as Value, note: feat?.note };
      });
      return { feature: f, values };
    });
  }, [data]);

  const totalScores = useMemo(() => {
    if (!data) return new Map<string, number>();
    return new Map(
      data.engines.map((eng) => [
        eng.id,
        eng.features.reduce((acc, f) => acc + f.value, 0),
      ])
    );
  }, [data]);

  const print = () => window.print();

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `null-privacy-comparison-${data.generated_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return <div className="card border-red-200 p-6 text-red-700 dark:border-red-900 dark:text-red-300">{error}</div>;
  }
  if (!data) {
    return <div className="py-16 text-center text-neutral-500">Loading comparison data…</div>;
  }

  const maxScore = data.feature_definitions.length * 2;

  return (
    <div className="py-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Privacy, compared honestly.
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Every engine here claims to care — this table checks. Null scores high today because
          it logs nothing and you can audit every line of its code. We publish the sources, the
          data, and the script that generates this page.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Legend />
        <div className="flex flex-wrap gap-2">
          <button onClick={print} className="btn btn-ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
            </svg>
            Print / PDF
          </button>
          <button onClick={downloadJson} className="btn btn-ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download JSON
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={showNotes}
              onChange={(e) => setShowNotes(e.target.checked)}
              className="accent-brand"
            />
            Show notes
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 print:border-0">
        <table className="w-full min-w-[860px] border-collapse bg-white text-sm dark:bg-neutral-900">
          <caption className="sr-only">Privacy feature comparison across search engines</caption>
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Neutral / Engine
              </th>
              {data.engines.map((eng) => (
                <th scope="col" key={eng.id} className="px-3 py-3 text-center">
                  <a
                    href={eng.url}
                    rel="noreferrer noopener"
                    target="_blank"
                    className="font-semibold text-neutral-900 hover:underline dark:text-white"
                  >
                    {eng.id === "null" ? <span className="text-brand">null</span> : eng.name}
                  </a>
                  <div className="mt-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    {eng.jurisdiction}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureRows.map(({ feature, values }) => (
              <tr key={feature.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <th scope="row" className="px-4 py-3 text-left font-medium text-neutral-800 dark:text-neutral-200">
                  <span className="group relative inline-flex items-baseline gap-1">
                    {feature.label}
                    {feature.note && (
                      <span className="group/tt relative inline-flex">
                        <button
                          type="button"
                          aria-label={`Tooltip: ${feature.note}`}
                          className="ml-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                          tabIndex={0}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                          </svg>
                        </button>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-64 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-normal text-white shadow-lg group-hover/tt:block dark:bg-neutral-700"
                        >
                          {feature.note}
                        </span>
                      </span>
                    )}
                  </span>
                </th>
                {values.map((v, i) => (
                  <td key={i} className="px-3 py-3 text-center">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Indicator value={v.value} />
                      {showNotes && v.note && (
                        <span className="hidden text-[10px] text-neutral-400 xl:inline" title={v.note}>
                          *
                        </span>
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            ))}

            <tr className="bg-neutral-50 dark:bg-neutral-800/40">
              <th scope="row" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Score
              </th>
              {data.engines.map((eng) => {
                const total = totalScores.get(eng.id) ?? 0;
                const pct = Math.round((total / maxScore) * 100);
                return (
                  <td key={eng.id} className="px-3 py-3 text-center">
                    <div className="font-semibold text-neutral-900 dark:text-white">
                      {total}
                      <span className="text-xs font-normal text-neutral-400"> / {maxScore}</span>
                    </div>
                    <div className="mx-auto mt-1 flex h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div
                        className={`h-full ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                        role="presentation"
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">How this data is maintained</h2>
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Values come from public privacy policies and transparency reports, normalized by{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              scripts/update_comparison.py
            </code>
            , and validated against the{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">ComparisonData</code> schema.
            The live table is served from{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">/compare-privacy</code>.
            Every cell can be traced back to a listed source.
          </p>
          <a
            href={`/privacy#sources`}
            className="mt-3 inline-block text-sm font-medium text-brand hover:underline dark:text-brand-muted"
          >
            View the full sources in the privacy policy →
          </a>
        </div>

        <div className="card p-6">
          <h2 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">Why null appears in its own table</h2>
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Honesty is the point. Null claims zero logging today because it is auditable — but the
            table is generated from the same code that runs the engine, and{" "}
            <span className="font-medium">its score is only as good as its next release note</span>.
            When something changes, the checkmark disappears.
          </p>
          {stats && (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              This instance: {stats.total_queries.toLocaleString()} aggregate queries handled,
              {stats.dedupe_rate > 0 ? ` ${(stats.dedupe_rate * 100).toFixed(1)}%` : " no"} duplicates merged.
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-400">
            Snapshot generated: {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
      </section>
    </div>
  );
}