/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Accent colors are CSS variables set at runtime (Settings → Accent
        // color). Tailwind receives them as <alpha-value> placeholders so
        // opacity modifiers like bg-brand/10 keep working.
        brand: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          muted: "rgb(var(--accent-muted) / <alpha-value>)",
        },
        surface: {
          light: "#ffffff",
          muted: "#f4f6fb",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(17,24,39,0.08), 0 1px 2px rgba(17,24,39,0.04)",
        pop: "0 12px 32px rgba(17,24,39,0.16)",
        glass: "0 8px 28px rgba(17,24,39,0.10), inset 0 1px 0 rgba(255,255,255,0.35)",
      },
    },
  },
  plugins: [],
};
