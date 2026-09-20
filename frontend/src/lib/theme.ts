import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "null.theme";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolve(theme: Theme): "light" | "dark" {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    return stored ?? "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolve(theme) === "dark");
    root.style.colorScheme = resolve(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const root = document.documentElement;
        root.classList.toggle("dark", mq.matches);
        root.style.colorScheme = mq.matches ? "dark" : "light";
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (resolve(prev) === "dark" ? "light" : "dark"));
  }, []);

  const set = useCallback((t: Theme) => setTheme(t), []);

  return { theme, resolved: resolve(theme), toggle, set };
}