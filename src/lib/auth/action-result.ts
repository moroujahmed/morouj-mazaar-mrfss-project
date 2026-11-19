export type StaffAuthCode =
  | "AUTH_INVALID"
  | "ACCOUNT_INACTIVE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "AUTH_UNAVAILABLE";

export type StaffAuthError = {
  code: StaffAuthCode;
  message: string;
  field?: string;
};

export type StaffAuthResult =
  | {
      ok: true;
      data: { role: "ADMIN" | "KITCHEN" | "RIDER" };
    }
  | { ok: false; error: StaffAuthError };

export type StaffLogoutResult =
  | { ok: true; data: { success: true } }
  | { ok: false; error: StaffAuthError };

const MESSAGES: Record<StaffAuthCode, string> = {
  AUTH_INVALID: "That phone number or PIN is not correct.",
  ACCOUNT_INACTIVE: "This account is inactive. Ask an administrator to restore it.",
  VALIDATION_ERROR: "Enter a valid phone number and 6-digit PIN.",
  RATE_LIMITED: "Too many sign-in attempts. Wait 15 minutes and try again.",
  AUTH_UNAVAILABLE: "Staff sign-in is unavailable right now. Try again shortly.",
};

export function staffAuthFailure(
  code: StaffAuthCode,
  message?: string,
  field?: string,
): { ok: false; error: StaffAuthError } {
  return {
    ok: false,
    error: { code, message: message ?? MESSAGES[code], ...(field ? { field } : {}) },
  };
}
