import { describe, expect, it } from "vitest";

import {
  canonicalContrastPairs,
  contrastRatio,
  palette,
  relativeLuminance,
} from "@/lib/design-tokens";

describe("WCAG contrast math", () => {
  it("returns 21:1 for black on white and 1:1 for identical colours", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#173F35", "#173F35")).toBeCloseTo(1, 5);
  });

  it("orders luminance correctly", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#173F35")).toBeLessThan(
      relativeLuminance("#F2F7F5"),
    );
  });

  it("rejects malformed colours", () => {
    expect(() => relativeLuminance("#FFF")).toThrow(/Invalid hex/);
    expect(() => relativeLuminance("green")).toThrow(/Invalid hex/);
  });
});

describe("canonical palette", () => {
  it("meets every declared AA/AAA target", () => {
    for (const pair of canonicalContrastPairs) {
      const ratio = contrastRatio(
        palette[pair.foreground],
        palette[pair.background],
      );

      if (pair.forbidden) {
        expect(ratio, `${pair.label} must stay below AA`).toBeLessThan(
          pair.minRatio,
        );
      } else {
        expect(ratio, `${pair.label} must meet ${pair.minRatio}:1`).toBeGreaterThanOrEqual(
          pair.minRatio,
        );
      }
    }
  });

  it("keeps white on orange forbidden", () => {
    expect(contrastRatio(palette.white, palette.orange500)).toBeLessThan(4.5);
    expect(contrastRatio(palette.green900, palette.orange500)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("keeps orange-500 out of body-text pairings on white", () => {
    expect(
      contrastRatio(palette.orange500, palette.white),
    ).toBeLessThan(4.5);
    expect(
      contrastRatio(palette.orange700, palette.white),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps status text legible on its tinted surface", () => {
    const pairs = [
      [palette.success700, palette.successSurface],
      [palette.red600, palette.dangerSurface],
      [palette.warning700, palette.warningSurface],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
