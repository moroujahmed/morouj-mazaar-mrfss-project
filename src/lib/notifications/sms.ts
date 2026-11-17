import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * SMS adapter (Africa's Talking) used for COD one-time codes.
 *
 * When the provider is not configured the caller must disable cash checkout
 * with a clear message; it must never silently skip verification. Test runs use
 * the console adapter, which never contacts the network and never logs codes in
 * production.
 */

export type SmsResult =
  | { ok: true }
  | { ok: false; reason: "NOT_CONFIGURED" | "SEND_FAILED" };

/** Test-only console adapter. Production never sets these flags. */
export function smsFixtureMode(): boolean {
  return (
    process.env.OTP_FIXTURE === "1" || process.env.ORDERS_FIXTURE === "1"
  );
}

export function smsConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.AFRICASTALKING_API_KEY && env.AFRICASTALKING_USERNAME);
}

export async function sendSms({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<SmsResult> {
  if (smsFixtureMode()) {
    // Test-only: the code is deterministic in fixture mode, so logging it is
    // safe and lets a failing run be diagnosed.
    console.warn(`[sms:fixture] to=${to} message=${message}`);
    return { ok: true };
  }

  const env = getServerEnv();
  if (!env.AFRICASTALKING_API_KEY || !env.AFRICASTALKING_USERNAME) {
    return { ok: false, reason: "NOT_CONFIGURED" };
  }

  const body = new URLSearchParams({
    username: env.AFRICASTALKING_USERNAME,
    to,
    message,
  });
  if (env.AFRICASTALKING_SENDER_ID) {
    body.set("from", env.AFRICASTALKING_SENDER_ID);
  }

  let response: Response;
  try {
    response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          apiKey: env.AFRICASTALKING_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    return { ok: false, reason: "SEND_FAILED" };
  }

  if (!response.ok) return { ok: false, reason: "SEND_FAILED" };

  // The provider returns per-recipient statuses with HTTP 200.
  try {
    const payload = (await response.json()) as {
      SMSMessageData?: {
        Recipients?: Array<{ status?: string; statusCode?: number }>;
      };
    };
    const recipients = payload.SMSMessageData?.Recipients ?? [];
    if (recipients.length === 0) return { ok: false, reason: "SEND_FAILED" };
    const failed = recipients.some(
      (recipient) =>
        recipient.status !== "Success" && recipient.statusCode !== 101,
    );
    return failed ? { ok: false, reason: "SEND_FAILED" } : { ok: true };
  } catch {
    return { ok: false, reason: "SEND_FAILED" };
  }
}

export async function sendCodOtp(
  phone: string,
  code: string,
): Promise<SmsResult> {
  return sendSms({
    to: phone,
    message: `Your Bazaar Flame & Grill cash-order code is ${code}. It expires in 10 minutes. Never share it with anyone.`,
  });
}
