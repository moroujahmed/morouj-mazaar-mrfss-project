export type OrderErrorCode =
  | "VALIDATION_ERROR"
  | "STORE_CLOSED"
  | "KITCHEN_PAUSED"
  | "ITEM_OUT_OF_STOCK"
  | "MOV_NOT_MET"
  | "DISTANCE_OUT_OF_BOUNDS"
  | "DISTANCE_UNAVAILABLE"
  | "COD_NOT_AVAILABLE"
  | "OTP_REQUIRED"
  | "OTP_INVALID"
  | "OTP_LOCKED"
  | "PAYMENT_METHOD_UNAVAILABLE"
  | "PAYMENT_UNAVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_STATE_INVALID"
  | "ORDER_NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ActionError = {
  code: OrderErrorCode;
  message: string;
  field?: string;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

const MESSAGES: Record<OrderErrorCode, string> = {
  VALIDATION_ERROR: "Check the highlighted details and try again.",
  STORE_CLOSED: "We are outside opening hours. Your cart is saved.",
  KITCHEN_PAUSED: "The kitchen has paused new orders. Try again shortly.",
  ITEM_OUT_OF_STOCK: "An item in your cart is no longer available.",
  MOV_NOT_MET: "Your order is below the minimum order value.",
  DISTANCE_OUT_OF_BOUNDS: "This address is outside our delivery area.",
  DISTANCE_UNAVAILABLE:
    "We cannot calculate the delivery route right now. Try again shortly.",
  COD_NOT_AVAILABLE:
    "Cash on delivery is not available for this order. Choose another payment method.",
  OTP_REQUIRED: "Enter the 6-digit code we sent to your phone.",
  OTP_INVALID: "That code is not valid. Check it and try again.",
  OTP_LOCKED: "Too many incorrect codes. Request a new code.",
  PAYMENT_METHOD_UNAVAILABLE:
    "That payment method is not available right now. Choose another method.",
  PAYMENT_UNAVAILABLE:
    "The payment provider is unavailable right now. Try again shortly.",
  IDEMPOTENCY_CONFLICT:
    "This checkout session changed. Refresh the page and try again.",
  ORDER_STATE_INVALID:
    "This order can no longer accept that action. Refresh the page.",
  ORDER_NOT_FOUND: "We could not find that order.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

export class OrderFailure extends Error {
  readonly code: OrderErrorCode;
  readonly field?: string;

  constructor(code: OrderErrorCode, message?: string, field?: string) {
    super(message ?? MESSAGES[code]);
    this.name = "OrderFailure";
    this.code = code;
    this.field = field;
  }
}

export function fail(
  code: OrderErrorCode,
  message?: string,
  field?: string,
): { ok: false; error: ActionError } {
  return {
    ok: false,
    error: {
      code,
      message: message ?? MESSAGES[code],
      ...(field ? { field } : {}),
    },
  };
}

export function succeed<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

const KNOWN_CODES = new Set<string>([
  "VALIDATION_ERROR",
  "STORE_CLOSED",
  "KITCHEN_PAUSED",
  "ITEM_OUT_OF_STOCK",
  "MOV_NOT_MET",
  "DISTANCE_OUT_OF_BOUNDS",
  "DISTANCE_UNAVAILABLE",
  "COD_NOT_AVAILABLE",
  "OTP_REQUIRED",
  "OTP_INVALID",
  "OTP_LOCKED",
  "PAYMENT_METHOD_UNAVAILABLE",
  "PAYMENT_UNAVAILABLE",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_STATE_INVALID",
  "ORDER_NOT_FOUND",
  "RATE_LIMITED",
]);

/**
 * Convert database/action exceptions into a safe action failure. PostgreSQL
 * functions raise `CODE: detail`; only the code crosses the network, never the
 * raw database text.
 */
export function toActionFailure(error: unknown): {
  ok: false;
  error: ActionError;
} {
  if (error instanceof OrderFailure) {
    return fail(error.code, error.message, error.field);
  }

  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  const candidate = raw.split(":")[0]?.trim() ?? "";
  if (KNOWN_CODES.has(candidate)) {
    return fail(candidate as OrderErrorCode);
  }

  return fail("INTERNAL_ERROR");
}
