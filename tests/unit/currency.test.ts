import { describe, expect, it } from "vitest";

import {
  calculateDeliveryFee,
  formatUGX,
  isBeyondMaxDelivery,
} from "@/lib/currency";
import { kampalaDateKey } from "@/lib/time";

describe("delivery fee", () => {
  it("is free for the canonical Nakasero fixture (1,562 m)", () => {
    expect(calculateDeliveryFee(1_562, 1_500)).toBe(0);
  });

  it("matches the canonical Ntinda fixture (8,093 m -> USh 6,000)", () => {
    expect(calculateDeliveryFee(8_093, 1_500)).toBe(6_000);
  });

  it("starts charging above 5,000 m", () => {
    expect(calculateDeliveryFee(5_000, 1_500)).toBe(0);
    expect(calculateDeliveryFee(5_001, 1_500)).toBe(1_500);
  });

  it("charges the maximum within the allowed radius", () => {
    expect(calculateDeliveryFee(15_000, 1_500)).toBe(15_000);
  });

  it("blocks distances beyond 15 km", () => {
    expect(isBeyondMaxDelivery(15_000)).toBe(false);
    expect(isBeyondMaxDelivery(15_001)).toBe(true);
  });

  it("rejects non-integer distances", () => {
    expect(() => calculateDeliveryFee(1562.5, 1_500)).toThrow();
  });
});

describe("formatUGX", () => {
  it("formats the canonical totals", () => {
    expect(formatUGX(35_000)).toBe("USh 35,000");
    expect(formatUGX(38_000)).toBe("USh 38,000");
    expect(formatUGX(8_000)).toBe("USh 8,000");
    expect(formatUGX(65_500)).toBe("USh 65,500");
  });

  it("rejects fractional amounts", () => {
    expect(() => formatUGX(1.5)).toThrow();
  });
});

describe("kampalaDateKey", () => {
  it("rolls over at midnight EAT", () => {
    expect(kampalaDateKey("2026-11-13T20:59:59Z")).toBe("2026-11-13");
    expect(kampalaDateKey("2026-11-13T21:00:00Z")).toBe("2026-11-14");
  });
});
