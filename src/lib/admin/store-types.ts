import type {
  AdminActionResult,
  AdminFailure,
} from "./errors";
import type { UpdateOrderContactInput } from "./schemas";
import type {
  AdminOrderDetail,
  AdminOrderList,
  AdminOrderStatus,
  AdminSettings,
  AdminSnapshot,
  AuditFeed,
  DiningTable,
  RefundRequest,
  StaffMember,
} from "./types";

export type AdminStore = {
  snapshot(): Promise<AdminSnapshot>;

  listOrders(input: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminOrderList>;

  getOrder(orderId: string): Promise<AdminOrderDetail>;

  updateContact(input: UpdateOrderContactInput): Promise<AdminOrderDetail>;
  cancelOrder(orderId: string, reason: string): Promise<{ orderId: string }>;
  completeOrder(orderId: string, reason: string): Promise<{ orderId: string }>;
  reassignOrder(
    orderId: string,
    riderId: string,
    reason: string,
  ): Promise<{ orderId: string; riderId: string }>;
  redeliverOrder(
    orderId: string,
    reason: string,
    riderId?: string | null,
  ): Promise<{ orderId: string; status: string; riderId: string | null }>;
  resetPin(orderId: string, reason: string): Promise<{ orderId: string }>;
  approveRefund(
    refundId: string,
    decision: "APPROVE" | "REJECT",
    notes?: string,
  ): Promise<{ refundId: string; status: string }>;
  reconcileCash(
    riderId: string,
    countedCash: number,
    notes: string,
    businessDate?: string,
  ): Promise<Record<string, unknown>>;

  updateSettings(patch: Record<string, unknown>, reason: string): Promise<AdminSettings>;
  upsertCategory(input: Record<string, unknown>, reason: string): Promise<unknown>;
  upsertMenuItem(input: Record<string, unknown>, reason: string): Promise<unknown>;
  archiveMenuItem(itemId: string, reason: string): Promise<unknown>;
  upsertTable(input: Record<string, unknown>, reason: string): Promise<DiningTable>;
  updateStaff(input: Record<string, unknown>, reason: string): Promise<StaffMember>;
  listStaff(): Promise<StaffMember[]>;
  listRefunds(): Promise<RefundRequest[]>;

  auditFeed(input: {
    limit?: number;
    offset?: number;
    entityType?: string;
  }): Promise<AuditFeed>;
};

export { type AdminFailure, type AdminActionResult, type AdminOrderStatus };
