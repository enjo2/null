import { Link } from "react-router-dom";

export function Privacy() {
  const sections = [
    {
      id: "short",
      title: "The short version",
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>We do not log search queries.</li>
          <li>We do not log IP addresses.</li>
          <li>We do not set tracking cookies, and our cookies never connect your searches to your identity.</li>
          <li>We do not build advertising profiles.</li>
          <li>Result links pass through a local redirect so the destination never sees your query.</li>
          <li>Everything is open source (AGPL-3.0) and self-hostable.</li>
        </ul>
      ),
    },
    {
      id: "what-we-store",
      title: "What we store",
      body: (
        <>
          <p>By default, null stores <em>nothing that identifies you</em>. The only data retained is:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Aggregate counters</strong> — total query count, average latency, deduplication
              rate, category popularity, and per-engine health. These are bucketed per minute and cannot
              be reversed into individual queries. Configurable via{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">NULL_ANALYTICS_ENABLED</code>.
            </li>
            <li>
              <strong>An in-memory result cache</strong> so identical queries across users are served
              without re-contacting upstream engines. Shared query results are cached as JSON, not tied
              to you, and expire within{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">NULL_CACHE_TTL_SECONDS</code>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "what-we-never-store",
      title: "What we never store",
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Your IP address (ever).</li>
          <li>Your user agent or device fingerprint.</li>
          <li>The link between you and any query, even transiently in logs.</li>
          <li>Session history, as the "back" button is the only history we keep.</li>
        </ul>
      ),
    },
    {
      id: "engines",
      title: "Backend engines and your query",
      body: (
        <>
          <p>
            A metasearch engine forwards your query to the engines it aggregates. To do our job, the
            query must go somewhere — we cannot offer Google results without asking Google. What we control:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Which engines run (only engines that tolerate server traffic; captcha-gated providers like Yandex, Qwant, Startpage, Mojeek, and Ecosia are not shipped).</li>
            <li>
              That Google is opt-in via its official Custom Search JSON API — the request
              goes to Google's API as a server peer, never with your browser or IP.
            </li>
            <li>Rate limits (per IP, per engine) that respect each engine's Terms of Service.</li>
          </ul>
          <p className="mt-2">
            For maximum privacy, self-host or use the built-in engines that honor HTTP requests
            without JavaScript and are reachable without accounts.
          </p>
        </>
      ),
    },
    {
      id: "redirect",
      title: "The /r redirect",
      body: (
        <p>
          Results are served as <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">null.example/r?url=https://…</code>.
          Your browser navigates through null, so the destination site receives no{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">Referer</code>{" "}
          containing your query. The redirect also strips common tracking parameters
          (<code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">utm_*</code>,{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">gclid</code>,{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">fbclid</code>, …)
          before you arrive. No redirect is ever logged.
        </p>
      ),
    },
    {
      id: "sources",
      title: "Sources for the comparison table",
      body: (
        <p>
          Data powering <Link to="/compare-privacy">/compare-privacy</Link> is regenerated from public
          policies via <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">scripts/update_comparison.py</code>.
          Each engine row carries a <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">sources</code> field
          pointing at the exact documents used. Out-of-date claims are bugs; please report them.
        </p>
      ),
    },
    {
      id: "audit",
      title: "Audits and transparency",
      body: (
        <p>
          Because null is server software, the strongest audit is reproducing the binary from source and
          watching your own network traffic. We also publish: build reproducibility checks, enabled-engine
          configuration, and monthly aggregate usage reports (counts only) — all in the repository, without
          individual data.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes & contact",
      body: (
        <p>
          Any change to what we store will be reflected here and in the{" "}
          <a className="text-brand hover:underline dark:text-brand-muted" href="/changelog">changelog</a>{" "}
          before shipping. Questions: <Link to="/contact" className="text-brand hover:underline dark:text-brand-muted">Contact</Link>.
        </p>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Privacy policy</h1>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        An auditable policy, readable in under five minutes.
      </p>

      <nav aria-label="Policy sections" className="mt-6 flex flex-wrap gap-2">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="card scroll-mt-24 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{s.title}</h2>
            <div className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}