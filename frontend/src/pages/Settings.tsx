import { useTheme } from "../lib/theme";
import { ACCENTS, applyAccent, clearPanelCache, usePrefs } from "../lib/prefs";

const LANGUAGES = ["auto", "en", "de", "fr", "es", "it", "pt", "nl", "ru", "ja", "zh", "ar"];
const ENGINE_NAMES = ["duckduckgo", "googleapi", "marginalia", "mwmbl"];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={
          "relative h-6 w-11 rounded-full transition-colors " +
          (checked ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
            (checked ? "left-[22px]" : "left-0.5")
          }
        />
      </button>
    </label>
  );
}

export function Settings() {
  const { theme, set } = useTheme();
  const { prefs, update, reset } = usePrefs();

  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Settings</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Preferences are stored only in this browser. Nothing is sent to our servers except the
        searches you make.
      </p>

      <section className="card mt-8 space-y-4 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Appearance</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
          {(["system", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => set(t)}
              aria-pressed={theme === t}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors " +
                (theme === t
                  ? "bg-brand text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300")
              }
            >
              {t}
            </button>
          ))}
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Accent color
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Accent color">
            {Object.entries(ACCENTS).map(([id, a]) => (
              <button
                key={id}
                onClick={() => {
                  update({ accent: id });
                  applyAccent(id);
                }}
                aria-pressed={prefs.accent === id}
                aria-label={a.label}
                title={a.label}
                className={
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 " +
                  (prefs.accent === id ? "border-neutral-900 dark:border-white" : "border-transparent")
                }
                style={{ backgroundColor: `rgb(${a.accent})` }}
              >
                {prefs.accent === id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="fontsize" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Result text size
          </label>
          <select
            id="fontsize"
            value={prefs.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) as 100 | 112 | 125 })}
            className="input"
          >
            <option value={100}>Normal</option>
            <option value={112}>Large</option>
            <option value={125}>Extra large</option>
</select>
        </div>
      </section>

      <section className="card mt-4 space-y-5 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Knowledge panel</h2>
        <Toggle
          checked={prefs.panel}
          onChange={(v) => update({ panel: v })}
          label="Show knowledge panels for entity searches"
        />
        <Toggle
          checked={prefs.instant}
          onChange={(v) => update({ instant: v })}
          label="Show instant answers (weather, math, conversions)"
        />
        <div>
          <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Panel position on desktop
          </span>
          <div className="flex gap-2">
            {(["side", "top"] as const).map((p) => (
              <button
                key={p}
                onClick={() => update({ panelPosition: p })}
                aria-pressed={prefs.panelPosition === p}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors " +
                  (prefs.panelPosition === p
                    ? "bg-brand text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300")
                }
              >
                {p === "side" ? "Right side" : "Above results"}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            clearPanelCache();
            update({}); // trigger re-render; cached panels are gone
          }}
          className="btn btn-ghost border border-neutral-200 text-sm dark:border-neutral-700"
        >
          Clear cached panels ({ "30-day local cache" })
        </button>
      </section>

      <section className="card mt-4 space-y-5 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Search</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lang" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Language
            </label>
            <select
              id="lang"
              value={prefs.language}
              onChange={(e) => update({ language: e.target.value })}
              className="input"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l === "auto" ? "Auto-detect" : l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="perpage" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Results per page
            </label>
            <select
              id="perpage"
              value={prefs.perPage}
              onChange={(e) => update({ perPage: Number(e.target.value) })}
              className="input"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Default result layout
          </span>
          <div className="flex gap-2">
            {(["list", "card", "grid"] as const).map((l) => (
              <button
                key={l}
                onClick={() => update({ layout: l })}
                aria-pressed={prefs.layout === l}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors " +
                  (prefs.layout === l
                    ? "bg-brand text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300")
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Toggle
            checked={prefs.safeSearch}
            onChange={(v) => update({ safeSearch: v })}
            label="Strict safe search (no violent or explicit results)"
          />
          <Toggle
            checked={prefs.shortcuts}
            onChange={(v) => update({ shortcuts: v })}
            label="Keyboard shortcuts (/, s, arrows, k)"
          />
          <Toggle
            checked={prefs.encryptAnim}
            onChange={(v) => update({ encryptAnim: v })}
            label="Show the query-encryption animation on search"
          />
        </div>
      </section>

      <section className="card mt-4 space-y-5 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Excluded sources</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Keep out engines you don't want queried. Your choice is applied on every search and stays
          in this browser.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ENGINE_NAMES.map((name) => {
            const included = !prefs.excludedEngines.includes(name);
            return (
              <div key={name} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/50">
                <span className="text-sm capitalize">{name === "googleapi" ? "Google" : name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={included}
                  aria-label={`Include ${name}`}
                  onClick={() =>
                    update({
                      excludedEngines: included
                        ? [...prefs.excludedEngines, name]
                        : prefs.excludedEngines.filter((e) => e !== name),
                    })
                  }
                  className={
                    "relative h-6 w-11 rounded-full transition-colors " +
                    (included ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700")
                  }
                >
                  <span
                    className={
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
                      (included ? "left-[22px]" : "left-0.5")
                    }
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card mt-4 space-y-5 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Instance privacy</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          These reflect the running instance's configuration and must be changed in this instance's
          environment to take effect:
        </p>
        <div className="space-y-4 opacity-70">
          <Toggle checked onChange={() => {}} label="Aggregate analytics only (NULL_ANALYTICS_ENABLED)" />
          <Toggle checked onChange={() => {}} label="No query or IP logging" />
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <button
          onClick={reset}
          className="text-sm font-medium text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
        >
          Reset all preferences
        </button>
      </div>
    </div>
  );
}
