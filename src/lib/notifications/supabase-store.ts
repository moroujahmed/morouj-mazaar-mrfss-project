import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { NotificationStore } from "./store-types";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Service-role notification store. Reads and writes go through the admin client
 * because the outbox has no client-facing RLS policy.
 */
export const supabaseNotificationStore: NotificationStore = {
  async listPending(limit, dueAt) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notifications")
      .select("id, channel, recipient, template, payload, attempts")
      .eq("status", "PENDING")
      .lte("next_attempt_at", dueAt)
      .order("next_attempt_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      channel: row.channel,
      recipient: row.recipient,
      template: row.template,
      payload: asRecord(row.payload),
      attempts: row.attempts,
    }));
  },

  async markSent(id, attempts, sentAt) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("notifications")
      .update({
        status: "SENT",
        attempts,
        sent_at: sentAt,
        next_attempt_at: sentAt,
        last_error: null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async markRetry(id, attempts, nextAttemptAt, failure) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("notifications")
      .update({
        status: "PENDING",
        attempts,
        next_attempt_at: nextAttemptAt,
        last_error: failure.slice(0, 500),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async markFailed(id, attempts, failure) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("notifications")
      .update({
        status: "FAILED",
        attempts,
        last_error: failure.slice(0, 500),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
};
