import { resultHref } from "../lib/api";
import type { SearchResultItem } from "../lib/types";

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(input?: string | null): string {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface CardProps {
  item: SearchResultItem;
  index: number;
  linkClass?: string;
}

function Favicon({ domain }: { domain?: string | null }) {
  if (!domain) return null;
  return (
    <img
      src={`/api/favicon?domain=${encodeURIComponent(domain)}`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        if (!img.dataset.fallback) {
          img.dataset.fallback = "1";
          img.src = "data:image/svg+xml," + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="%232f6df6" opacity="0.15"/><text x="8" y="12" text-anchor="middle" font-size="9" font-weight="700" fill="%232f6df6">${(domain[0] ?? "?").toUpperCase()}</text></svg>`
          );
        } else {
          img.style.visibility = "hidden";
        }
      }}
    />
  );
}

export function ResultCard({ item, index, linkClass = "" }: CardProps) {
  const href = resultHref(item.url);
  const engines = item.engine.split("+").filter(Boolean);
  const date = formatDate(item.published_date);

  return (
    <article
      className={
        "animate-fade-in group rounded-xl py-4 " +
        (item.domain_match ? "-mx-3 border border-brand/30 bg-brand/[0.04] px-3 " : "")
      }
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    >
      {item.domain_match && (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand dark:text-brand-muted">
          Official site
        </p>
      )}
      <div className="mb-1 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
        <Favicon domain={item.domain} />
        <span className="truncate">{host(item.url)}</span>
        {date && (
          <>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{date}</span>
          </>
        )}
      </div>
      <h3 className="mb-1">
        <a
          href={href}
          rel="noreferrer noopener"
          className={"text-lg font-medium text-brand hover:underline dark:text-brand-muted " + linkClass}
        >
          {item.title}
        </a>
      </h3>
      {item.snippet && (
        <p className="line-clamp-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {item.snippet}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          via{" "}
          {engines.map((e, i) => (
            <span key={e} className="mr-1">
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {engineLabel(e)}
              </span>
              {i < engines.length - 1 && " + "}
            </span>
          ))}
        </span>
      </div>
    </article>
  );
}

function engineLabel(engine: string): string {
  switch (engine) {
    case "duckduckgo":
      return "DuckDuckGo";
    case "googleapi":
      return "Google";
    case "marginalia":
      return "Marginalia";
    case "mwmbl":
      return "Mwmbl";
    default:
      return engine;
  }
}

export { engineLabel };

export function ResultList({
  items,
  start,
  linkClass,
}: {
  items: SearchResultItem[];
  start: number;
  linkClass?: string;
}) {
  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {items.map((item, i) => (
        <ResultCard key={`${item.url}-${i}`} item={item} index={start + i} linkClass={linkClass} />
      ))}
    </div>
  );
}

export function ResultCards({
  items,
  linkClass,
}: {
  items: SearchResultItem[];
  linkClass?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <article
          key={`${item.url}-${i}`}
          className="animate-fade-in card flex flex-col p-4"
          style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Favicon domain={item.domain} />
            <span className="truncate">{host(item.url)}</span>
          </div>
          <h3 className="mb-1">
            <a
              href={resultHref(item.url)}
              rel="noreferrer noopener"
              className={"font-medium text-brand hover:underline dark:text-brand-muted " + linkClass}
            >
              {item.title}
            </a>
          </h3>
          {item.snippet && (
            <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              {item.snippet}
            </p>
          )}
          <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">via {engineLabel(item.engine.split("+")[0])}</div>
        </article>
      ))}
    </div>
  );
}

export function ResultGrid({
  items,
  linkClass,
}: {
  items: SearchResultItem[];
  linkClass?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <article
          key={`${item.url}-${i}`}
          className="animate-fade-in card flex flex-col p-4"
          style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
        >
          <h3 className="mb-1">
            <a
              href={resultHref(item.url)}
              rel="noreferrer noopener"
              className={"text-sm font-medium text-brand hover:underline dark:text-brand-muted " + linkClass}
            >
              {item.title}
            </a>
          </h3>
          <p className="line-clamp-4 flex-1 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
            {item.snippet}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
            <Favicon domain={item.domain} />
            <span className="truncate">{host(item.url)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
