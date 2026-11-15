import { describe, expect, it } from "vitest";

import { formatStoreTime, getStoreStatus } from "@/lib/storefront/store-status";

const baseHours = {
  isStoreOpen: true,
  openingTime: "10:00:00",
  closingTime: "22:00:00",
  timezone: "Africa/Kampala",
};

// Africa/Kampala is UTC+3 all year, so UTC 08:00 is 11:00 EAT.
function at(utcIso: string): Date {
  return new Date(utcIso);
}

describe("store hours", () => {
  it("is open during business hours", () => {
    expect(getStoreStatus(baseHours, at("2026-11-15T08:00:00Z"))).toEqual({
      open: true,
      closesAt: "22:00:00",
    });
  });

  it("is open in the final opening hour", () => {
    expect(getStoreStatus(baseHours, at("2026-11-15T18:30:00Z"))).toEqual({
      open: true,
      closesAt: "22:00:00",
    });
  });

  it("closes exactly at closing time", () => {
    expect(getStoreStatus(baseHours, at("2026-11-15T19:00:00Z"))).toEqual({
      open: false,
      opensAt: "10:00:00",
      reason: "hours",
    });
  });

  it("closes before opening time", () => {
    expect(getStoreStatus(baseHours, at("2026-11-15T06:00:00Z"))).toEqual({
      open: false,
      opensAt: "10:00:00",
      reason: "hours",
    });
  });

  it("honours the manual closed switch over business hours", () => {
    expect(
      getStoreStatus(
        { ...baseHours, isStoreOpen: false },
        at("2026-11-15T08:00:00Z"),
      ),
    ).toEqual({
      open: false,
      opensAt: "10:00:00",
      reason: "manual",
    });
  });

  it("supports a window that crosses midnight", () => {
    const overnight = {
      ...baseHours,
      openingTime: "22:00:00",
      closingTime: "02:00:00",
    };

    expect(getStoreStatus(overnight, at("2026-11-15T20:00:00Z")).open).toBe(
      true,
    );
    expect(getStoreStatus(overnight, at("2026-11-15T22:00:00Z")).open).toBe(
      true,
    );
    expect(getStoreStatus(overnight, at("2026-11-15T09:00:00Z")).open).toBe(
      false,
    );
  });

  it("formats stored times to HH:mm", () => {
    expect(formatStoreTime("22:00:00")).toBe("22:00");
    expect(formatStoreTime("10:00")).toBe("10:00");
  });
});
