import type { InstantAnswerData } from "../lib/types";

const ICONS: Record<string, JSX.Element> = {
  calculator: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h4" />
    </svg>
  ),
  ruler: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z" />
      <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2" />
    </svg>
  ),
  thermometer: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 4a2 2 0 1 0-4 0v9.5a4.5 4.5 0 1 0 4 0z" />
    </svg>
  ),
  currency: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  cloud: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.5 19a4.5 4.5 0 0 0 .9-8.9A7 7 0 0 0 4.7 12.2 4 4 0 0 0 6 19z" />
    </svg>
  ),
  book: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  ),
};

export function InstantAnswerCard({ answer }: { answer: InstantAnswerData }) {
  const icon = ICONS[answer.icon] ?? ICONS.calculator;
  return (
    <div
      className="animate-fade-in card mb-4 border-brand/25 p-5 dark:border-brand/30"
      role="region"
      aria-label="Instant answer"
    >
      <div className="flex items-start gap-4">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-muted">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {answer.value}
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{answer.subtitle}</span>
          </div>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {answer.title}
          </p>
          {answer.detail && (
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {answer.detail}
            </p>
          )}
          {answer.extra.length > 0 && (
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{answer.extra.join(" · ")}</p>
          )}
          {answer.source && (
            <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              Source: {answer.source}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
