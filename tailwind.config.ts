import type { Config } from "tailwindcss";

/**
 * Design tokens from docs/DESIGN_SYSTEM_V2.md and docs/ACCESSIBILITY.md.
 * White text on orange-500 is forbidden; orange actions use green-900 text.
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
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [],
};

export default config;
