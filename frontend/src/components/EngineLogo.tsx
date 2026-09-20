import type { EngineInfo } from "../lib/types";

/** Stylized marks for supported engines (not the real brand assets). */
export function EngineLogo({
  engine,
  size = 28,
  dim = false,
}: {
  engine: string | EngineInfo;
  size?: number;
  dim?: boolean;
}) {
  const name = typeof engine === "string" ? engine : engine.name;
  const opacity = dim ? 0.45 : 1;

  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    style: { opacity },
  } as const;

  switch (name) {
    case "ddg":
    case "duckduckgo":
      // Simplified DDG mark: orange circle + white duck (head, beak, body).
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#de5833" />
          <circle cx="13.2" cy="9.2" r="2.4" fill="#fff" />
          <path d="m15.4 8.6 2.8 1-2.8 1z" fill="#fff" />
          <path d="M7.2 15.6c0-2.5 2-4 4.6-4 2.2 0 3.9 1.2 4.2 3.2.1.8-.2 1.6-.9 2.1-1 .7-2.4 1-3.9 1-2.3 0-4-1-4-2.3z" fill="#fff" />
          <circle cx="13.9" cy="8.9" r="0.5" fill="#de5833" />
        </svg>
      );
    case "googleapi":
      return (
        <svg {...common}>
          <path
            d="M21.5 12.2c0-.7-.06-1.2-.2-1.8h-9.3v3.5h5.4c-.1 1-.7 2.4-1.9 3.3l3 2.3c1.8-1.6 3-4 3-7.3Z"
            fill="#4285f4"
          />
          <path
            d="M12 21.5c2.7 0 4.9-.9 6.5-2.5l-3-2.3c-.8.6-1.9 1-3.5 1-2.7 0-5-1.8-5.8-4.2l-3.1 2.4c1.6 3.1 4.8 5.1 8.9 5.1Z"
            fill="#34a853"
          />
          <path
            d="M6.2 10.7a6.3 6.3 0 0 0 0 2.6L9.3 11C9 9.8 9 8.8 9.3 7.6L6.2 10.7Z"
            fill="#fbbc05"
          />
          <path
            d="M12 5.7c1.5 0 2.8.5 3.8 1.5l2.7-2.6A8.4 8.4 0 0 0 12 2c-4.1 0-7.3 2-8.9 5.1l3.1 2.4C7 7.4 9.3 5.7 12 5.7Z"
            fill="#ea4335"
          />
        </svg>
      );
    case "marginalia":
      // Marginalia: old-web text index — open book.
      return (
        <svg {...common}>
          <path d="M12 5.8C10.4 4.6 8.2 4 5.6 4c-.9 0-1.6.7-1.6 1.6v11.6c0 .9.7 1.6 1.6 1.6 2.6 0 4.8.6 6.4 1.8 1.6-1.2 3.8-1.8 6.4-1.8.9 0 1.6-.7 1.6-1.6V5.6c0-.9-.7-1.6-1.6-1.6-2.6 0-4.8.6-6.4 1.8z" fill="#5b4636" />
          <path d="M12 5.8v13.2M6.2 8h3.6M6.2 11h3.6M14.2 8h3.6M14.2 11h3.6" stroke="#f4e9d8" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "mwmbl":
      // Mwmbl: community search — blue ring + white M.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#2f6df6" />
          <path
            d="M6.8 16.5V8.6l2.4 1.7 2.8-2.5 2.8 2.5 2.4-1.7v7.9h-2v-4.4l-3.2 2.8-3.2-2.8v4.4z"
            fill="#fff"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#2f6df6" opacity="0.15" />
          <text
            x="12"
            y="16"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#2f6df6"
          >
            {(name[0] ?? "?").toUpperCase()}
          </text>
        </svg>
      );
  }
}

export function engineDisplayName(name: string, catalog?: EngineInfo[]): string {
  const found = catalog?.find((e) => e.name === name);
  return found?.display_name ?? name;
}