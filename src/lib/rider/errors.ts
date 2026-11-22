export type RiderErrorCode =
  | "AUTH_UNAUTHORIZED"
  | "ORDER_NOT_FOUND"
  | "ORDER_ALREADY_CLAIMED"
  | "RIDER_HAS_ACTIVE_ORDER"
  | "ORDER_STATE_INVALID"
  | "SHIFT_ALREADY_OPEN"
  | "SHIFT_NOT_OPEN"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type RiderActionError = {
  code: RiderErrorCode;
  message: string;
  field?: string;
};

/** Typed failure raised by the fixture store; the Supabase store raises RPC messages. */
export class RiderFailure extends Error {
  readonly code: RiderErrorCode;

  constructor(code: RiderErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RiderFailure";
    this.code = code;
  }
}

export type RiderActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RiderActionError };

const MESSAGES: Record<RiderErrorCode, string> = {
  AUTH_UNAUTHORIZED: "Your session ended. Sign in again.",
  ORDER_NOT_FOUND: "That delivery is no longer available.",
  ORDER_ALREADY_CLAIMED:
    "Another rider claimed this delivery first. The pool has been refreshed.",
  RIDER_HAS_ACTIVE_ORDER:
    "You already have an active delivery. Finish or release it first.",
  ORDER_STATE_INVALID:
    "This delivery changed on another screen. Refresh and try again.",
  SHIFT_ALREADY_OPEN: "Your shift is already open.",
  SHIFT_NOT_OPEN: "Start your shift before claiming deliveries.",
  VALIDATION_ERROR: "Check the values and try again.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

export function riderFailure(
  code: RiderErrorCode,
  message?: string,
  field?: string,
): { ok: false; error: RiderActionError } {
  return {
    ok: false,
    error: {
      code,
      message: message ?? MESSAGES[code],
      ...(field ? { field } : {}),
    },
  };
}

const KNOWN_CODES = new Set<string>(Object.keys(MESSAGES));

export function toRiderFailure(error: unknown): {
  ok: false;
  error: RiderActionError;
} {
  const typedCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (KNOWN_CODES.has(typedCode)) {
    return riderFailure(typedCode as RiderErrorCode);
  }

  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  const candidate = raw.split(":")[0]?.trim() ?? "";
  if (KNOWN_CODES.has(candidate)) {
    return riderFailure(candidate as RiderErrorCode);
  }
  return riderFailure("INTERNAL_ERROR");
}
