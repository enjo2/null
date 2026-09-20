import { useCallback, useEffect, useState } from "react";

/**
 * Local, never-synced user preferences.
 *
 * Everything here lives in this browser's localStorage under a single key.
 * Nothing is sent to the server — the search request only carries the
 * preferences that shape the current query (engines, language, safe search).
 */

const PREFS_KEY = "null.prefs";

export interface Prefs {
  // Knowledge panel
  panel: boolean;
  panelPosition: "side" | "top";
  // Instant answers
  instant: boolean;
  // Results
  layout: "list" | "card" | "grid";
  fontSize: 100 | 112 | 125;
  safeSearch: boolean;
  language: string;
  perPage: number;
  // Engines (names to exclude from queries)
  excludedEngines: string[];
  // Keyboard shortcuts
  shortcuts: boolean;
  // Accent color — key of ACCENTS (blue, violet, indigo, cyan, teal, emerald,
  // lime, amber, orange, rose, pink, red)
  accent: string;
  // Cosmetic "encrypting…" animation on every search
  encryptAnim: boolean;
}

export const ACCENTS: Record<string, { label: string; accent: string; muted: string }> = {
  blue: { label: "Blue", accent: "47 109 246", muted: "91 142 247" },
  violet: { label: "Violet", accent: "124 58 237", muted: "155 105 245" },
  indigo: { label: "Indigo", accent: "79 70 229", muted: "129 116 243" },
  cyan: { label: "Cyan", accent: "8 145 178", muted: "47 168 205" },
  teal: { label: "Teal", accent: "13 148 136", muted: "45 184 171" },
  emerald: { label: "Emerald", accent: "5 150 105", muted: "52 168 149" },
  lime: { label: "Lime", accent: "101 163 13", muted: "142 196 42" },
  amber: { label: "Amber", accent: "217 119 6", muted: "234 154 49" },
  orange: { label: "Orange", accent: "234 88 12", muted: "249 133 47" },
  rose: { label: "Rose", accent: "225 29 72", muted: "238 67 103" },
  pink: { label: "Pink", accent: "219 39 119", muted: "240 98 160" },
  red: { label: "Red", accent: "220 38 38", muted: "240 80 80" },
};

export const DEFAULT_PREFS: Prefs = {
  panel: true,
  panelPosition: "side",
  instant: true,
  layout: "list",
  fontSize: 100,
  safeSearch: true,
  language: "auto",
  perPage: 10,
  excludedEngines: [],
  shortcuts: true,
  accent: "blue",
  encryptAnim: true,
};

interface Listener {
  (): void;
}

let listeners: Listener[] = [];
let current: Prefs | null = null;

function currentPrefs(): Prefs {
  if (!current) {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      current = raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULT_PREFS };
    } catch {
      current = { ...DEFAULT_PREFS };
    }
    // Migrate stale per-page values to the supported 10/25/50 set.
    if (![10, 25, 50].includes(current.perPage)) current.perPage = 10;
  }
  return current;
}

function write(next: Prefs) {
  current = next;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep in-memory value */
  }
  for (const listener of listeners) listener();
}

export function usePrefs() {
  const [prefs, setPrefsState] = useState<Prefs>(currentPrefs);

  useEffect(() => {
    const listener = () => setPrefsState(currentPrefs());
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    write({ ...currentPrefs(), ...patch });
  }, []);

  const reset = useCallback(() => {
    write({ ...DEFAULT_PREFS });
  }, []);

  return { prefs, update, reset };
}

/** Read prefs without subscribing (one-shot, for non-component callers). */
export function usePrefsSnapshot(): Prefs {
  return currentPrefs();
}

/** Apply the stored accent color to the document (called on load + change). */
export function applyAccent(accentName: string): void {
  const a = ACCENTS[accentName] ?? ACCENTS.blue;
  const root = document.documentElement;
  root.style.setProperty("--accent", a.accent);
  root.style.setProperty("--accent-muted", a.muted);
}

/** Remove every locally-cached knowledge panel (used by Settings). */
export function clearPanelCache(): void {
  try {
    const prefix = "null.kp.";
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    /* best-effort */
  }
}
