/** Ugandan phone normalization. The server repeats this in Phase 6. */

const UG_COUNTRY_CODE = "256";

/**
 * Accepts `+2567…`, `2567…`, `07…`, `7…`, `+2563…`, `03…`, `3…` (spaces,
 * dashes, dots and parentheses are ignored). Returns E.164 or null.
 */
export function normalizeUgPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (!digits) return null;

  let national: string | null = null;

  if (digits.startsWith(`+${UG_COUNTRY_CODE}`)) {
    national = digits.slice(UG_COUNTRY_CODE.length + 1);
  } else if (digits.startsWith(UG_COUNTRY_CODE) && digits.length > 9) {
    national = digits.slice(UG_COUNTRY_CODE.length);
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  if (!national || !/^[37]\d{8}$/.test(national)) return null;
  return `+${UG_COUNTRY_CODE}${national}`;
}

export function formatUgPhone(e164: string): string {
  const national = e164.replace(/^\+256/, "");
  if (!/^[37]\d{8}$/.test(national)) return e164;
  return `+256 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}
