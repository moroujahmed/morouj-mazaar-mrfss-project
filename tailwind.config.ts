import type { Config } from "tailwindcss";

/**
 * Design tokens from docs/DESIGN_SYSTEM_V2.md and docs/ACCESSIBILITY.md.
 * White text on orange-500 is forbidden; orange actions use green-900 text.
 *
 * Font families are declared with local/system fallbacks so the production
 * build never depends on a network font fetch. Self-hosted webfonts replace
 * the fallbacks when the brand assets are supplied.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        green: {
          50: "#F2F7F5",
          100: "#E3EEEA",
          700: "#1D4F42",
          800: "#173F35",
          900: "#102E27",
        },
        orange: {
          500: "#F28C28",
          600: "#E07D1F",
          700: "#A65A0F",
        },
        ink: {
          DEFAULT: "#102E27",
          secondary: "#52635D",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          inset: "#F2F4F3",
        },
        status: {
          success: "#17603F",
          successSurface: "#E8F5E9",
          danger: "#C62828",
          dangerSurface: "#FEE2E2",
          warning: "#8A4B00",
          warningSurface: "#FEF3C7",
        },
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "Plus Jakarta Sans",
          "system-ui",
          "sans-serif",
        ],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      fontSize: {
        display: ["clamp(2.6rem, 6vw, 3.75rem)", { lineHeight: "1.02" }],
        eyebrow: [
          "0.75rem",
          { lineHeight: "1.5", letterSpacing: "0.08em", fontWeight: "800" },
        ],
      },
      minHeight: {
        touch: "48px",
        action: "52px",
        primary: "56px",
      },
      minWidth: {
        touch: "48px",
        action: "52px",
        primary: "56px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 46, 39, 0.06), 0 8px 24px rgba(16, 46, 39, 0.08)",
        sheet: "0 -8px 40px rgba(16, 46, 39, 0.24)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "toast-in": "toast-in 160ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
