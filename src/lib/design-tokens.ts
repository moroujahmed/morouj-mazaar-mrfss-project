/**
 * The single normative palette from docs/ACCESSIBILITY.md §2.
 *
 * Components use Tailwind classes; this module exists so automated contrast
 * verification reads the same values as the design system instead of
 * duplicating hex codes in tests.
 */
export const palette = {
  green50: "#F2F7F5",
  green100: "#E3EEEA",
  green700: "#1D4F42",
  green800: "#173F35",
  green900: "#102E27",
  orange500: "#F28C28",
  orange600: "#E07D1F",
  orange700: "#A65A0F",
  white: "#FFFFFF",
  surfaceInset: "#F2F4F3",
  inkSecondary: "#52635D",
  red600: "#C62828",
  success700: "#17603F",
  warning700: "#8A4B00",
  successSurface: "#E8F5E9",
  dangerSurface: "#FEE2E2",
  warningSurface: "#FEF3C7",
} as const;

export type PaletteToken = keyof typeof palette;

export type ContrastPair = {
  readonly label: string;
  readonly foreground: PaletteToken;
  readonly background: PaletteToken;
  /** Minimum WCAG 2.2 ratio demanded by the design system. */
  readonly minRatio: number;
  /** True when the pair is documented as forbidden and must stay below minRatio. */
  readonly forbidden?: boolean;
};

const AA = 4.5;
const AAA = 7;

/**
 * Canonical pairs from ACCESSIBILITY.md §2 plus the status-pill pairs from
 * §3.2. A pair marked forbidden must never reach its AA threshold.
 */
export const canonicalContrastPairs: readonly ContrastPair[] = [
  { label: "White on green-800", foreground: "white", background: "green800", minRatio: AAA },
  { label: "White on green-900", foreground: "white", background: "green900", minRatio: AAA },
  { label: "White on green-700", foreground: "white", background: "green700", minRatio: AAA },
  { label: "Green-900 on orange-500", foreground: "green900", background: "orange500", minRatio: AA },
  { label: "Orange-700 on white", foreground: "orange700", background: "white", minRatio: AA },
  {
    label: "White on orange-500 (forbidden)",
    foreground: "white",
    background: "orange500",
    minRatio: AA,
    forbidden: true,
  },
  { label: "Gray-600 on white", foreground: "inkSecondary", background: "white", minRatio: AA },
  { label: "White on red-600", foreground: "white", background: "red600", minRatio: AA },
  { label: "Red-600 on white", foreground: "red600", background: "white", minRatio: AA },
  { label: "White on success-700", foreground: "white", background: "success700", minRatio: AA },
  { label: "White on warning-700", foreground: "white", background: "warning700", minRatio: AA },
  { label: "Green-900 on green-50", foreground: "green900", background: "green50", minRatio: AAA },
  { label: "Ink on white", foreground: "green900", background: "white", minRatio: AAA },
  { label: "Green-900 on green-100", foreground: "green900", background: "green100", minRatio: AAA },
  { label: "Success-700 on success surface", foreground: "success700", background: "successSurface", minRatio: AA },
  { label: "Red-600 on danger surface", foreground: "red600", background: "dangerSurface", minRatio: AA },
  { label: "Warning-700 on warning surface", foreground: "warning700", background: "warningSurface", minRatio: AA },
  { label: "Green-800 on surface inset", foreground: "green800", background: "surfaceInset", minRatio: AA },
  { label: "Gray-600 on surface inset", foreground: "inkSecondary", background: "surfaceInset", minRatio: AA },
];

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance for a six-digit hex colour. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  const [r, g, b] = [0, 2, 4].map((offset) =>
    channelToLinear(parseInt(value.slice(offset, offset + 2), 16)),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two six-digit hex colours. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
