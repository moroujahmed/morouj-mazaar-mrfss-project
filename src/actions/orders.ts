"use server";

import { headers } from "next/headers";

import {
  OrderFailure,
  toActionFailure,
  type ActionResult,
} from "@/lib/orders/errors";
import { getOrderStore } from "@/lib/orders/store";
import { clientIpFromHeaders, getRateLimiter } from "@/lib/routing/rate-limit";
import type { RateLimitResult } from "@/lib/routing/rate-limit";
import { submitFeedbackSchema } from "@/lib/schemas/order";

/**
 * Customer tracker mutations. Feedback is the only customer write after
 * checkout, and it is accepted once per order through `submit_feedback`:
 * the RPC only updates a `DELIVERED` order whose `customer_rating` is null.
 */

const FEEDBACK_TOKEN_LIMIT = { max: 5, windowSeconds: 60 * 60 };
const FEEDBACK_IP_LIMIT = { max: 20, windowSeconds: 60 * 60 };

export async function submitFeedbackAction(
  payload: unknown,
): Promise<ActionResult<{ success: true }>> {
  try {
    const parsed = submitFeedbackSchema.safeParse(payload);
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

    const requestHeaders = await headers();
    const ip = clientIpFromHeaders(requestHeaders);

    let tokenLimit: RateLimitResult;
    let ipLimit: RateLimitResult;
    try {
      [tokenLimit, ipLimit] = await Promise.all([
        getRateLimiter().consumeWithLimit(
          `mrfss:rl:feedback:token:${parsed.data.orderToken}`,
          FEEDBACK_TOKEN_LIMIT.max,
          FEEDBACK_TOKEN_LIMIT.windowSeconds,
        ),
        getRateLimiter().consumeWithLimit(
          `mrfss:rl:feedback:ip:${ip}`,
          FEEDBACK_IP_LIMIT.max,
          FEEDBACK_IP_LIMIT.windowSeconds,
        ),
      ]);
    } catch {
      throw new OrderFailure(
        "RATE_LIMITED",
        "Feedback is unavailable right now. Please try again shortly.",
      );
    }

    if (!tokenLimit.allowed || !ipLimit.allowed) {
      throw new OrderFailure(
        "RATE_LIMITED",
        "Too many feedback attempts. Try again later.",
      );
    }

    await getOrderStore().submitFeedback({
      orderToken: parsed.data.orderToken,
      rating: parsed.data.rating,
      notes: parsed.data.notes,
    });

    return { ok: true, data: { success: true } };
  } catch (error) {
    return toActionFailure(error);
  }
}
