import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTheme } from "../lib/theme";

const REPO_URL = "https://github.com/null-search/null";

export function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Project on GitHub"
      title="Source code on GitHub"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.7 5.38-5.27 5.67.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    </a>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/favicon.jpg"
        alt=""
        width={size}
        height={size}
        className="rounded-lg"
        aria-hidden="true"
      />
      <span className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
        null
      </span>
    </span>
  );
}

export function ThemeToggle({ size = 16 }: { size?: number }) {
  const { resolved, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-neutral-900 dark:bg-neutral-900/80 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
      title={resolved === "dark" ? "Light mode" : "Dark mode"}
    >
      {resolved === "dark" ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
        </svg>
      )}
    </button>
  );
}

const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-muted"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white")
      }
    >
      {children}
    </Link>
  );
};

export function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isSearch = location.pathname === "/search";
  const bare = isHome || isSearch;

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal overlays for home — no visible header bar */}
      {isHome && (
        <>
          <div className="pointer-events-auto fixed right-5 top-4 z-30 flex items-center gap-2" aria-label="Home controls">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 shadow-sm backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              privacy-first · open source
            </span>
            <GitHubIcon size={17} />
            <ThemeToggle size={15} />
          </div>
          <Link
            to="/about"
            className="fixed bottom-5 right-5 z-30 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            About →
          </Link>
        </>
      )}
      {!bare && (
        /* Normal header for inner pages */
        <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="shrink-0" aria-label="null home">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              <NavLink to="/">Search</NavLink>
              <NavLink to="/compare-privacy">Compare privacy</NavLink>
              <NavLink to="/about">About</NavLink>
              <NavLink to="/privacy">Privacy</NavLink>
              <NavLink to="/faq">FAQ</NavLink>
            </nav>
            <div className="flex items-center gap-2">
              <GitHubIcon />
              <ThemeToggle />
              <Link to="/settings" className="icon-button" aria-label="Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </Link>
              <button
                className="icon-button md:hidden"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav className="border-t border-neutral-200 px-4 py-2 md:hidden dark:border-neutral-800" aria-label="Mobile">
              <div className="flex flex-col gap-1">
                <NavLink to="/">Search</NavLink>
                <NavLink to="/compare-privacy">Compare privacy</NavLink>
                <NavLink to="/about">About</NavLink>
                <NavLink to="/privacy">Privacy</NavLink>
                <NavLink to="/faq">FAQ</NavLink>
                <NavLink to="/contact">Contact</NavLink>
              </div>
            </nav>
          )}
        </header>
      )}

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        <Outlet />
      </main>

      {!bare && (
        <footer className="mt-16 border-t border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-neutral-500 sm:flex-row sm:px-6 dark:text-neutral-400">
            <p>
              <span className="font-medium text-neutral-700 dark:text-neutral-200">null</span> — a
              privacy-first metasearch engine.
            </p>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-neutral-900 dark:hover:text-white">Privacy</Link>
              <Link to="/about" className="hover:text-neutral-900 dark:hover:text-white">About</Link>
              <Link to="/contact" className="hover:text-neutral-900 dark:hover:text-white">Contact</Link>
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">AGPL-3.0</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}