export type KitchenErrorCode =
  | "AUTH_UNAUTHORIZED"
  | "ORDER_NOT_FOUND"
  | "ORDER_STATE_INVALID"
  | "ITEM_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type KitchenActionError = {
  code: KitchenErrorCode;
  message: string;
  field?: string;
};

export type KitchenActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: KitchenActionError };

const MESSAGES: Record<KitchenErrorCode, string> = {
  AUTH_UNAUTHORIZED: "Your session ended. Sign in again.",
  ORDER_NOT_FOUND: "That order is no longer on the board.",
  ORDER_STATE_INVALID:
    "This ticket changed on another screen. Refresh the board and try again.",
  ITEM_NOT_FOUND: "That menu item could not be found.",
  VALIDATION_ERROR: "Check the values and try again.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

export function kitchenFailure(
  code: KitchenErrorCode,
  message?: string,
  field?: string,
): { ok: false; error: KitchenActionError } {
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

export function toKitchenFailure(error: unknown): {
  ok: false;
  error: KitchenActionError;
} {
  // Fixture and in-process failures carry a typed `code` (for example an
  // `OrderFailure` raised by the shared order store). Database RPC errors only
  // expose `CODE: detail` in the message, so both shapes are recognised.
  const typedCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (KNOWN_CODES.has(typedCode)) {
    return kitchenFailure(typedCode as KitchenErrorCode);
  }

  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  const candidate = raw.split(":")[0]?.trim() ?? "";
  if (KNOWN_CODES.has(candidate)) {
    return kitchenFailure(candidate as KitchenErrorCode);
  }
  return kitchenFailure("INTERNAL_ERROR");
}
