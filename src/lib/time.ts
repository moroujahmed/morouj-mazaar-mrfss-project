import { formatInTimeZone } from "date-fns-tz";

/** Business dates and customer-facing times use East Africa Time. */
export const BUSINESS_TIME_ZONE = "Africa/Kampala";

export function formatKampala(
  value: Date | string | number,
  pattern = "dd MMM yyyy, HH:mm",
): string {
  return formatInTimeZone(new Date(value), BUSINESS_TIME_ZONE, pattern);
}

/** Stable `yyyy-MM-dd` key for ledger and analytics business days. */
export function kampalaDateKey(
  value: Date | string | number = new Date(),
): string {
  return formatInTimeZone(new Date(value), BUSINESS_TIME_ZONE, "yyyy-MM-dd");
}
