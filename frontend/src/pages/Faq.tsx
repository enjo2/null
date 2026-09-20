import { Link, useLocation } from "react-router-dom";

const faqs = [
  {
    q: "Which engines are queried, and why not something like Yandex or Qwant?",
    a: "null only ships engines that tolerate automated requests from a server: DuckDuckGo, Bing, Marginalia, and Mwmbl (independent, open-source). Google is available via its official Custom Search JSON API once you add NULL_GOOGLE_CSE_KEY / NULL_GOOGLE_CSE_ID. Providers like Yandex, Qwant, Startpage, Mojeek, and Ecosia answer server traffic with a captcha or a 403, so we simply don't ship them — surfacing a red 'error' dot on an engine we know can't work helps nobody.",
  },
  {
    q: "If the query is sent to Google anyway, how is this private?",
    a: "The request is made from null's server, never your browser — Google sees a server peer, not your IP. And the default instance doesn't need Google at all: DuckDuckGo, Bing, Marginalia, and Mwmbl cover most queries. On the 'null' side, we never log the query or your IP.",
  },
  {
    q: "Do you use cookies?",
    a: "We do not set tracking cookies, and nothing about your session is persisted on our side. Our only in-memory cache stores result sets (shared across users), never who asked.",
  },
  {
    q: "Can I self-host?",
    a: "Yes — that's the design goal. See docs/INSTALL.md and the docker-compose.yml in the repo. Self-hosting means the strongest guarantee available: the software runs on hardware you control.",
  },
  {
    q: "Why can't I select Google directly on the default instance?",
    a: "Google's HTML interface is a JavaScript app — there is no plain-HTML page to scrape. The stable route is Google's official Custom Search JSON API (100 free queries/day): set NULL_GOOGLE_CSE_KEY and NULL_GOOGLE_CSE_ID and the 'googleapi' engine lights up.",
  },
  {
    q: "How does deduplication work?",
    a: "Results are normalized by canonical URL (tracking parameters stripped, scheme/host folded). When two engines return the same page, it's merged: the best title/snippet is kept and the merged entry scores higher because multiple independent engines corroborated it.",
  },
  {
    q: "What happens if an engine fails?",
    a: "Engines are isolated. A timeout or failure in one never blocks the others; each has a hard timeout (default 6s). The response includes per-engine status so you can see exactly which engines answered.",
  },
  {
    q: "Does the comparison table have a conflict of interest?",
    a: "It should: null appears in its own table, scored by the same code that runs the engine, with sources linked. If a future version logs queries, the checkmark dies on the same release. That's the point of publishing data and the generation script.",
  },
  {
    q: "Who runs null?",
    a: "For this demo, a small team of engineers. In the real world, run it yourself — the AGPL license explicitly exists so the community can fork, audit, and trust it.",
  },
  {
    q: "Can I disable analytics entirely?",
    a: "Yes. Set NULL_ANALYTICS_ENABLED=false. Without it, only the in-memory cache and rate limiter remain, and neither is identity-bearing.",
  },
];

export function Faq() {
  const { hash } = useLocation();

  return (
    <div className="mx-auto max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
        Frequently asked questions
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Honest answers to the questions we'd ask if we were you.
      </p>

      <div className="mt-8 space-y-4">
        {faqs.map((f, i) => (
          <details
            key={f.q}
            open={hash === `#q${i}`}
            className="card group p-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-neutral-900 dark:text-white">
              {f.q}
              <span className="text-neutral-400 transition-transform group-open:rotate-45">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{f.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
        Still curious?{" "}
        <Link to="/contact" className="text-brand hover:underline dark:text-brand-muted">
          Get in touch
        </Link>
        .
      </p>
    </div>
  );
}