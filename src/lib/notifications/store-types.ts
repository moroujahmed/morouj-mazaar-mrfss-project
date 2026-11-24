export type NotificationChannel = "SMS" | "WHATSAPP" | "PUSH";

export type PendingNotification = {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
  attempts: number;
};

/**
 * Notification outbox boundary. The dispatch worker only needs to claim due
 * rows and record the outcome; it never touches the provider or the database
 * directly, which keeps retry/dead-letter behaviour unit-testable.
 */
export interface NotificationStore {
  listPending(limit: number, dueAt: string): Promise<PendingNotification[]>;
  markSent(id: string, attempts: number, sentAt: string): Promise<void>;
  markRetry(
    id: string,
    attempts: number,
    nextAttemptAt: string,
    error: string,
  ): Promise<void>;
  markFailed(id: string, attempts: number, error: string): Promise<void>;
}
