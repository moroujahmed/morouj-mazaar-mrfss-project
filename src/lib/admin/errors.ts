export type AdminErrorCode =
  | "AUTH_UNAUTHORIZED"
  | "ACCOUNT_INACTIVE"
  | "ORDER_NOT_FOUND"
  | "ORDER_STATE_INVALID"
  | "ITEM_NOT_FOUND"
  | "REFUND_NOT_FOUND"
  | "LAST_ADMIN_PROTECTED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type AdminActionError = {
  code: AdminErrorCode;
  message: string;
  field?: string;
};

/** Typed failure raised by the fixture store; RPC errors map to the same codes. */
export class AdminFailure extends Error {
  readonly code: AdminErrorCode;

  constructor(code: AdminErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AdminFailure";
    this.code = code;
  }
}

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AdminActionError };

const MESSAGES: Record<AdminErrorCode, string> = {
  AUTH_UNAUTHORIZED: "Your session ended. Sign in again.",
  ACCOUNT_INACTIVE: "This account is inactive. Contact the manager.",
  ORDER_NOT_FOUND: "That order no longer exists.",
  ORDER_STATE_INVALID: "That action is not allowed at this stage.",
  ITEM_NOT_FOUND: "That menu item no longer exists.",
  REFUND_NOT_FOUND: "That refund request no longer exists.",
  LAST_ADMIN_PROTECTED: "You cannot change the last active admin.",
  VALIDATION_ERROR: "Check the values and try again.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong. Try again.",
};

/** Map an RPC message (e.g. `VALIDATION_ERROR: reason required`) to a code. */
function codeFromMessage(message: string): AdminErrorCode {
  const upper = message.toUpperCase();
  const codes: AdminErrorCode[] = [
    "LAST_ADMIN_PROTECTED",
    "ORDER_STATE_INVALID",
    "ORDER_NOT_FOUND",
    "ITEM_NOT_FOUND",
    "AUTH_UNAUTHORIZED",
    "ACCOUNT_INACTIVE",
    "VALIDATION_ERROR",
    "RATE_LIMITED",
    "REFUND_NOT_FOUND",
  ];
  return codes.find((code) => upper.startsWith(code)) ?? "INTERNAL_ERROR";
}

export function toAdminFailure(error: unknown): AdminActionResult<never> {
  if (error instanceof AdminFailure) {
    return {
      ok: false,
      error: { code: error.code, message: error.message || MESSAGES[error.code] },
    };
  }
  if (error instanceof Error) {
    const code = codeFromMessage(error.message);
    return {
      ok: false,
      error: { code, message: MESSAGES[code] },
    };
  }
  return { ok: false, error: { code: "INTERNAL_ERROR", message: MESSAGES.INTERNAL_ERROR } };
}

export function adminMessage(code: AdminErrorCode): string {
  return MESSAGES[code];
}
