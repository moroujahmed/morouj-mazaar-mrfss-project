/**
 * Staff identity helpers.
 *
 * Staff never receive real email. Supabase Auth requires an email-shaped
 * identifier, so each staff member signs in with their E.164 phone mapped to a
 * synthetic address under the configured domain, and their 6-digit PIN is the
 * password (ADR-001).
 */

const UGANDAN_E164 = /^\+256[0-9]{9}$/;
const GENERIC_E164 = /^\+[1-9][0-9]{7,14}$/;

/** Normalize Ugandan local/international input to E.164, or return null. */
export function normalizePhoneE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]+$/.test(compact)) return null;

  const digits = compact.replace(/^\+/, "");

  if (/^0[0-9]{9}$/.test(digits)) {
    return `+256${digits.slice(1)}`;
  }
  if (/^256[0-9]{9}$/.test(digits)) {
    return `+${digits}`;
  }
  if (UGANDAN_E164.test(compact)) {
    return compact;
  }
  if (GENERIC_E164.test(`+${digits}`)) {
    return `+${digits}`;
  }

  return null;
}

export function defaultStaffEmailDomain(): string {
  return process.env.STAFF_EMAIL_DOMAIN || "staff.moroujmazaar.com";
}

/** Build the synthetic Supabase Auth email for a staff phone number. */
export function staffEmailForPhone(
  phone: string,
  domain = defaultStaffEmailDomain(),
): string {
  const normalized = normalizePhoneE164(phone);
  if (!normalized) {
    throw new Error("INVALID_PHONE");
  }

  return `${normalized.slice(1)}@${domain}`;
}
