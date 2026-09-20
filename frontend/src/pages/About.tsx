import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { enginesCatalog } from "../lib/api";
import { EngineLogo } from "../components/EngineLogo";
import type { EngineInfo } from "../lib/types";

const pages = [
  { to: "/compare-privacy", title: "Compare privacy", desc: "How we stack up against every major engine — table, scores, sources.", color: "bg-brand/10 text-brand" },
  { to: "/privacy", title: "Privacy policy", desc: "Auditable, readable in five minutes, no lawyer required.", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  { to: "/faq", title: "FAQ", desc: "The questions you already know the answers to.", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { to: "/contact", title: "Contact", desc: "Report bugs, suggest features, ask privacy questions.", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { to: "/settings", title: "Settings", desc: "Theme, language, safe search, engine selection.", color: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
];

export function About() {
  const [catalog, setCatalog] = useState<EngineInfo[]>([]);
  useEffect(() => { enginesCatalog().then(setCatalog).catch(() => {}); }, []);

  const enabled = catalog.filter((e) => e.enabled);
  const disabled = catalog.filter((e) => !e.enabled);

  return (
    <div className="mx-auto max-w-3xl py-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
          <rect width="64" height="64" rx="14" className="fill-brand" />
          <path d="M20 18h24v6H37v22h-8V24H20z" className="fill-white" />
        </svg>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">About null</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            A privacy-first metasearch engine built by the community for the community.
            Self-hosted, auditable, AGPL-3.0 — because no company should own what you search for.
          </p>
        </div>
      </div>

      {/* Pages grid */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {pages.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            className="group rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
          >
            <span className={`mb-2 inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${p.color}`}>
              {p.title}
            </span>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{p.desc}</p>
          </Link>
        ))}
      </div>

      {/* Engines section */}
      <section className="mt-14" aria-labelledby="engines-heading">
        <h2 id="engines-heading" className="text-xl font-semibold text-neutral-900 dark:text-white">
          Supported search engines
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          null aggregates results across multiple independent engines.
          Opt-in engines respect each provider's ToS and are disabled by default.
        </p>

        {/* Active engines */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {enabled.map((e) => (
            <EngineCard key={e.name} engine={e} dim={false} />
          ))}
        </div>

        {/* Disabled / opt-in engines */}
        {disabled.length > 0 && (
          <>
            <p className="mt-8 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              Opt-in engines — disabled by default to respect Terms of Service
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {disabled.map((e) => (
                <EngineCard key={e.name} engine={e} dim />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Tech note */}
      <section className="mt-14" aria-labelledby="tech-heading">
        <h2 id="tech-heading" className="text-xl font-semibold text-neutral-900 dark:text-white">How it works</h2>
        <ol className="mt-4 space-y-3">
          {[
            ["One query, many engines", "Your query is sent simultaneously to every enabled engine. Each has a hard timeout so a slow one never blocks the rest."],
            ["Results are merged, not copied", "Normalized URLs — tracking parameters stripped — are deduplicated. A result confirmed by several engines ranks higher."],
            ["Transparent ranking", "Score = engine trust weight × position + diversity bonus + freshness. No black box."],
            ["Clean trail", "Results link through a local redirect so the destination never sees your query. No cookies are set."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Links */}
      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/compare-privacy" className="btn btn-primary">Compare privacy</Link>
        <Link to="/privacy" className="btn btn-ghost">Read privacy policy</Link>
        <Link to="/faq" className="btn btn-ghost">Read FAQ</Link>
      </div>
    </div>
  );
}

function EngineCard({ engine, dim }: { engine: EngineInfo; dim: boolean }) {
  const notes = engine.notes ?? [];
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition dark:border-neutral-800 dark:bg-neutral-900">
      <EngineLogo engine={engine.name} size={36} dim={dim} />
      <div>
        <p className="font-semibold text-neutral-900 dark:text-white">{engine.display_name}</p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {engine.tier === "native" && "Native API — no scraping, no ToS risk"}
          {engine.tier === "direct" && "Direct — enabled by default, no API key required"}
          {engine.tier === "api" && "Official API — high quality, reliable"}
          {engine.tier === "scrape" && "HTML adapter — opt-in, respects ToS when used responsibly"}
        </p>
        {notes.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{notes.join(" · ")}</p>
        )}
      </div>
    </div>
  );
}