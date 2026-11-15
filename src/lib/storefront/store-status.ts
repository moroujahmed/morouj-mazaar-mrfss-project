import { formatInTimeZone } from "date-fns-tz";

export type StoreHours = {
  isStoreOpen: boolean;
  openingTime: string;
  closingTime: string;
  timezone: string;
};

export type StoreStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; reason: "manual" | "hours" };

function toMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * The manual switch and the business hours must both allow orders.
 * Overnight windows (closing <= opening) are treated as spanning midnight.
 * All comparisons use the configured business timezone, never the browser's.
 */
export function getStoreStatus(
  hours: StoreHours,
  now: Date = new Date(),
): StoreStatus {
  if (!hours.isStoreOpen) {
    return {
      open: false,
      opensAt: hours.openingTime,
      reason: "manual",
    };
  }

  const current = formatInTimeZone(now, hours.timezone, "HH:mm");
  const currentMinutes = toMinutes(current);
  const opening = toMinutes(hours.openingTime);
  const closing = toMinutes(hours.closingTime);

  const withinHours =
    closing > opening
      ? currentMinutes >= opening && currentMinutes < closing
      : currentMinutes >= opening || currentMinutes < closing;

  return withinHours
    ? { open: true, closesAt: hours.closingTime }
    : { open: false, opensAt: hours.openingTime, reason: "hours" };
}

/** Display helper: 22:00:00 -> 22:00. */
export function formatStoreTime(value: string): string {
  return value.slice(0, 5);
}
