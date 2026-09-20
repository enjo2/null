import { useEffect, useState } from "react";

const GLYPHS = "01ABCDEF#$%&*+/<=>?@";

function scramble(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch === " ") {
      out += " ";
      continue;
    }
    out += Math.random() < 0.85 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ch;
  }
  return out;
}

/**
 * Cosmetic "encrypting your query" overlay shown when a search starts.
 *
 * It makes null's privacy promise visible: on the wire your query is already
 * TLS-encrypted, and on the server it is never logged. This animation is
 * theatre — the real protections are architectural. Honors the accent color
 * via CSS variables and the reduced-motion media query.
 *
 * `active` ties the overlay to the request lifecycle: as soon as results are
 * in (or the request failed) it disappears instead of overstaying its welcome.
 */
export function EncryptOverlay({ query, active = true }: { query: string; active?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!query || !active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const shown = query.slice(0, 48);
    setDisplay(scramble(shown));
    const iv = window.setInterval(() => setDisplay(scramble(shown)), 70);
    const to = window.setTimeout(() => setVisible(false), 1500);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(to);
    };
  }, [query, active]);

  if (!visible) return null;

  return (
    <div className="search-encrypt-overlay" aria-hidden="true">
      <div className="search-encrypt-card">
        <div className="search-encrypt-glyphs">{display || "…"}</div>
        <div className="search-encrypt-label">Encrypting query · no logs · no trace</div>
      </div>
    </div>
  );
}
