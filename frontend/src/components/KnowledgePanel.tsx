import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { knowledgePanel, resultHref } from "../lib/api";
import type {
  KnowledgeAttribute,
  KnowledgeLink,
  KnowledgePanelData,
  RelatedEntity,
} from "../lib/types";

/* -------------------------------------------------------------------- icons */

function LinkIcon({ icon }: { icon: string }) {
  const c = "h-4 w-4";
  switch (icon) {
    case "website":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    case "wikipedia":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3.6 8.2 12c-.3.7-.6 1-1.3 1-.4 0-.8-.2-1-.7L2 4.9c-.2-.5-.5-.7-.9-.9V3h5.6v1c-.5.1-.8.3-.8.7 0 .2 0 .3.1.5l2.3 5 2-4.5-.6-1.2c-.3-.5-.5-.6-1-.7V3h4.9v1c-.6.1-.8.3-.8.6 0 .2 0 .3.1.5l2.2 4.9 2.1-5c.1-.2.1-.4.1-.5 0-.4-.3-.6-.9-.7V3H20v1c-.5.1-.8.3-1.1.9L14.9 13c-.3.7-.7 1-1.3 1-.6 0-1-.3-1.3-1z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.5h-2.6C11.2 2.5 10 4 10 6.6v1.9H8v3h2v9.5h4V11.5h2.7l.3-3H14z" />
        </svg>
      );
    case "twitter":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L2.5 2h6.4l4.4 5.9L18.9 2zm-1.1 18h1.7L7.9 3.8H6L17.8 20z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.5c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4V9z" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.4-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.7.3c-.5.1-1.5.1-2.4 1-.7.7-.9 2.3-.9 2.3S.8 9.1.8 11v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.3 7.6.3s4.6 0 7.7-.3c.5-.1 1.5-.1 2.4-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.8V11c0-1.9-.2-3.8-.2-3.8zM9.8 15.1V8.7l6.1 3.2-6.1 3.2z" />
        </svg>
      );
    case "imdb":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="5" width="20" height="14" rx="2" opacity="0.15" />
          <path d="M4.5 8.5h2l1 4 1-4h2v7h-1.6v-4l-.9 4H6.9l-.8-4v4H4.5v-7zM12 8.5h1.8l1.2 4.5v-4.5h1.6v7h-1.7l-1.3-4.8v4.8H12v-7zM18 8.5h1.5v7H18v-7z" />
        </svg>
      );
    case "email":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    default:
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      );
  }
}

/* ----------------------------------------------------------------- helpers */

const ATTR_TIPS: Record<string, string> = {
  "Founded": "Date the entity was established (Wikidata P571)",
  "Inception": "Date of establishment (P571)",
  "Founder(s)": "People who started the organisation (P112)",
  "Headquarters": "Primary office location (P159)",
  "Type": "Legal or organisational form (P1454)",
  "Stock ticker": "Exchange symbol for publicly traded companies (P414)",
  "Area served": "Geographic area of operation (P2541)",
  "Population": "Reported resident count (P1082)",
  "Area": "Geographic area covered (P2046)",
  "Capital": "Capital city (P36)",
  "Born": "Date of birth (P569)",
  "Died": "Date of death (P570)",
  "Nationality": "Country of citizenship (P27)",
  "Occupation": "Profession or roles (P106)",
  "Known for": "Notable work or achievement (P800)",
  "Country": "Country the entity is in (P17)",
  "Located in": "Containing administrative unit (P131)",
  "Developer": "Author or developing organisation (P178)",
  "Released": "First publication date (P577)",
  "Performer": "Artist performing the work (P175)",
  "Genre": "Creative genre (P136)",
  "Language": "Language of the work (P407)",
  "Website": "Official website (P856)",
};

function websiteLink(links: KnowledgeLink[]): KnowledgeLink | null {
  return links.find((l) => l.key === "website") ?? null;
}

function prettyHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* -------------------------------------------------------------- sub-sections */

/** DDG-style quick links: icon above a small label. */
function QuickLinksRow({ links }: { links: KnowledgeLink[] }) {
  if (!links.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Quick links</h4>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-3">
        {links.slice(0, 8).map((l) => (
          <a
            key={l.key + l.url}
            href={resultHref(l.url)}
            target="_blank"
            rel="noreferrer noopener"
            title={l.label}
            className="group flex w-16 flex-col items-center gap-1.5 rounded-lg p-1 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition group-hover:border-brand/50 group-hover:text-brand dark:border-neutral-700 dark:text-neutral-200 dark:group-hover:text-brand-muted">
              <LinkIcon icon={l.icon} />
            </span>
            <span className="w-full truncate text-center text-[11px] text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-neutral-100">
              {l.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Key facts, shown inside the expanded section. */
function KeyFacts({ attributes }: { attributes: KnowledgeAttribute[] }) {
  if (!attributes.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Key facts</h4>
      <div className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {attributes.slice(0, 10).map((a) => (
          <div key={a.key + a.value} className="flex items-baseline justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-0 dark:border-neutral-800/70">
            <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400" title={a.tooltip || ATTR_TIPS[a.key]}>
              {a.key}
            </span>
            {a.href ? (
              <a
                href={resultHref(a.href)}
                target="_blank"
                rel="noreferrer noopener"
                className="truncate text-right text-xs font-medium text-brand hover:underline dark:text-brand-muted"
              >
                {a.value}
              </a>
            ) : (
              <span className="truncate text-right text-xs font-medium text-neutral-800 dark:text-neutral-200">
                {a.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Related searches, shown inside the expanded section. */
function RelatedRow({ items }: { items: RelatedEntity[] }) {
  const navigate = useNavigate();
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">People also search for</h4>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((r) => (
          <button
            key={r.url}
            onClick={() => navigate(`/search?q=${encodeURIComponent(r.title)}`)}
            className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-brand/40 hover:text-brand dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-brand-muted"
          >
            {r.title}
          </button>
        ))}
      </div>
    </div>
  );
}

/** "Source: Wikipedia · Was this helpful?" row below the card. Local-only. */
function FeedbackRow({ panelName, wikiUrl }: { panelName: string; wikiUrl: string }) {
  const [done, setDone] = useState<null | "yes" | "no">(null);

  const vote = (ok: boolean) => {
    setDone(ok ? "yes" : "no");
    // No network call: feedback is deliberately local-only, in line with the
    // zero-logging privacy model. A self-hosted operator could wire this up.
    try {
      const key = "null.kp-feedback";
      const raw = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, string[]>;
      const votes = raw[ok ? "ok" : "issues"] || [];
      raw[ok ? "ok" : "issues"] = [...votes, panelName].slice(-50);
      localStorage.setItem(key, JSON.stringify(raw));
    } catch {
      /* best-effort */
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 px-2 text-xs text-neutral-500 dark:text-neutral-400">
      <span>
        Source:{" "}
        <a
          href={resultHref(wikiUrl)}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-neutral-300 underline-offset-2 hover:text-neutral-800 dark:decoration-neutral-600 dark:hover:text-neutral-200"
        >
          Wikipedia
        </a>
      </span>
      {done ? (
        <span className="text-neutral-400 dark:text-neutral-500">
          · Thanks — feedback stays on this device.
        </span>
      ) : (
        <>
          <span aria-hidden="true">·</span>
          <span>Was this helpful?</span>
          <button
            onClick={() => vote(true)}
            aria-label="Yes, this was helpful"
            className="rounded-md px-1.5 py-0.5 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
          </button>
          <button
            onClick={() => vote(false)}
            aria-label="No, this was not helpful"
            className="rounded-md px-1.5 py-0.5 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180">
              <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- shell */

interface Props {
  query: string;
  onClose: () => void;
  position?: "top" | "side" | "modal";
}

export function KnowledgePanel({ query, onClose, position = "top" }: Props) {
  const [panel, setPanel] = useState<KnowledgePanelData | null>(null);
  const [failed, setFailed] = useState(false);
  const [openAll, setOpenAll] = useState(false); // chevron expander
  const seq = useRef(0);

  useEffect(() => {
    const s = ++seq.current;
    setPanel(null);
    setFailed(false);
    setOpenAll(false);
    let cancelled = false;
    knowledgePanel(query)
      .then((p) => {
        if (!cancelled && s === seq.current) {
          if (p) setPanel(p);
          else setFailed(true); // no data -> nothing to show
        }
      })
      .catch(() => {
        if (!cancelled && s === seq.current) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Modal behavior: lock page scroll and move focus into the dialog.
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (position !== "modal") return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, [position]);

  const description = useMemo(() => (panel?.description ?? "").trim(), [panel]);
  const needsClamp = description.length > 340;
  const image = panel?.image || panel?.thumbnail || null;
  const website = panel ? websiteLink(panel.links) : null;

  if (failed) return null; // never render an empty panel

  const modal = position === "modal";

  const card = (
    <aside
      role={modal ? "dialog" : "complementary"}
      aria-modal={modal || undefined}
      aria-label={`Knowledge panel for ${panel?.name ?? query}`}
      className={
        "animate-panel-in card w-full overflow-hidden rounded-2xl shadow-pop " +
        (modal ? "relative mx-auto w-full max-w-lg" : "")
      }
      onClick={modal ? (e) => e.stopPropagation() : undefined}
    >
      {panel === null ? (
        /* ------------------------------------------------ skeleton loader */
        <div className="animate-pulse p-5 sm:p-6" aria-live="polite" aria-label="Loading knowledge panel">
          <div className="flex items-start gap-5">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-7 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-3 w-1/4 rounded bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-3 w-1/5 rounded bg-neutral-100 dark:bg-neutral-800" />
            </div>
            <div className="h-28 w-44 shrink-0 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-3 w-5/6 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="mt-5 flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 w-14 rounded-full bg-neutral-100 dark:bg-neutral-800" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* -------------------------------------------------- header row */}
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 dark:text-white">
                  {panel.name}
                </h2>
                {panel.tagline && (
                  <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{panel.tagline}</p>
                )}
                {website && (
                  <a
                    href={resultHref(website.url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-block text-sm font-medium text-brand hover:underline dark:text-brand-muted"
                  >
                    {prettyHost(website.url)}
                  </a>
                )}
              </div>
              {image && (
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                  className="h-24 w-36 shrink-0 rounded-xl border border-neutral-200 object-cover sm:h-28 sm:w-44 dark:border-neutral-700"
                />
              )}
              {modal && (
                <button
                  ref={closeRef}
                  onClick={onClose}
                  aria-label="Close knowledge panel"
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              )}
            </div>

            {/* -------------------------------------------- description */}
            {description && (
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                <span className={needsClamp && !openAll ? "line-clamp-3" : "whitespace-pre-line"}>{description}</span>{" "}
                <a
                  href={resultHref(panel.wiki_url)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline dark:text-brand-muted"
                >
                  Continued on Wikipedia
                </a>
              </p>
            )}

            <QuickLinksRow links={panel.links} />
          </div>

          {/* --------------------------------- chevron expander / extra */}
          {(panel.attributes.length > 0 || panel.related.length > 0) && (
            <>
              <button
                onClick={() => setOpenAll((v) => !v)}
                aria-expanded={openAll}
                aria-label={openAll ? "Show less" : "Show key facts and related searches"}
                className="flex w-full items-center justify-center border-t border-neutral-200/70 py-2 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800 dark:border-neutral-700/60 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={"transition-transform duration-200 " + (openAll ? "rotate-180" : "")}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openAll && (
                <div className="space-y-5 border-t border-neutral-200/70 px-5 py-4 sm:px-6 dark:border-neutral-700/60">
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {panel.type_label}
                  </span>
                  <KeyFacts attributes={panel.attributes} />
                  <RelatedRow items={panel.related} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );

  if (modal) {
    // Mobile: centered modal over a dimmed, blurred backdrop.
    return createPortal(
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950/60 p-4 pt-[10vh] backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      >
        {card}
      </div>,
      document.body
    );
  }

  // Inline (top of results): render in place, plus the source/feedback row.
  return (
    <div>
      {card}
      {panel && <FeedbackRow panelName={panel.name} wikiUrl={panel.wiki_url} />}
    </div>
  );
}
