"use server";

import { randomInt } from "node:crypto";

import { headers } from "next/headers";

import { sendCodOtp, smsConfigured } from "@/lib/notifications/sms";
import {
  OrderFailure,
  toActionFailure,
  type ActionResult,
} from "@/lib/orders/errors";
import { getOrderStore } from "@/lib/orders/store";
import { normalizeUgPhone } from "@/lib/phone";
import { clientIpFromHeaders, getRateLimiter } from "@/lib/routing/rate-limit";
import { sendCodOtpSchema } from "@/lib/schemas/order";

/**
 * COD one-time code delivery.
 *
 * Only a bcrypt hash is stored (`store_cod_otp`). Test runs use a fixed code so
 * browser tests stay deterministic; production always generates a random one.
 */

const OTP_TTL_SECONDS = 10 * 60;
const OTP_PHONE_LIMIT = { max: 3, windowSeconds: 60 * 60 };
const OTP_IP_LIMIT = { max: 10, windowSeconds: 60 * 60 };

const FIXTURE_OTP_CODE = "123456";

export type SendCodOtpResult = {
  sent: boolean;
  skip: boolean;
  expiresInSeconds: number;
};

function otpFixtureMode(): boolean {
  return (
    process.env.OTP_FIXTURE === "1" || process.env.ORDERS_FIXTURE === "1"
  );
}

function generateCode(): string {
  if (otpFixtureMode()) return FIXTURE_OTP_CODE;
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function consume(key: string, max: number, windowSeconds: number) {
  try {
    return await getRateLimiter().consumeWithLimit(key, max, windowSeconds);
  } catch {
    throw new OrderFailure("OTP_UNAVAILABLE");
  }
}

export async function sendCodOtpAction(
  payload: unknown,
): Promise<ActionResult<SendCodOtpResult>> {
  try {
    const parsed = sendCodOtpSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return toActionFailure(
        new OrderFailure(
          "VALIDATION_ERROR",
          issue?.message ?? undefined,
          issue?.path.join("."),
        ),
      );
    }

    const phone = normalizeUgPhone(parsed.data.phone);
    if (!phone) {
      return toActionFailure(
        new OrderFailure(
          "VALIDATION_ERROR",
          "Enter a Ugandan mobile number.",
          "phone",
        ),
      );
    }

    const requestHeaders = await headers();
    const ip = clientIpFromHeaders(requestHeaders);

    const [phoneLimit, ipLimit] = await Promise.all([
      consume(
        `mrfss:rl:otp:phone:${phone}`,
        OTP_PHONE_LIMIT.max,
        OTP_PHONE_LIMIT.windowSeconds,
      ),
      consume(
        `mrfss:rl:otp:ip:${ip}`,
        OTP_IP_LIMIT.max,
        OTP_IP_LIMIT.windowSeconds,
      ),
    ]);

    if (!phoneLimit.allowed || !ipLimit.allowed) {
      throw new OrderFailure(
        "RATE_LIMITED",
        "Too many code requests. Wait a moment and try again.",
      );
    }

    const store = getOrderStore();

    // Returning customers with a delivered order skip the code entirely.
    if (await store.isReturningCustomer(phone)) {
      return {
        ok: true,
        data: { sent: false, skip: true, expiresInSeconds: 0 },
      };
    }

    // No provider, no cash checkout. Never bypass verification silently.
    if (!otpFixtureMode() && !smsConfigured()) {
      throw new OrderFailure("OTP_UNAVAILABLE");
    }

    const code = generateCode();
    const expiresAt = new Date(
      Date.now() + OTP_TTL_SECONDS * 1_000,
    ).toISOString();

    await store.storeCodOtp({ phone, code, expiresAt, maxAttempts: 3 });

    const sent = await sendCodOtp(phone, code);
    if (!sent.ok) throw new OrderFailure("OTP_UNAVAILABLE");

    return {
      ok: true,
      data: {
        sent: true,
        skip: false,
        expiresInSeconds: OTP_TTL_SECONDS,
      },
    };
  } catch (error) {
    return toActionFailure(error);
  }
}
