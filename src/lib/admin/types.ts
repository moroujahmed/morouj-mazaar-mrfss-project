import { z } from "zod";

import { paymentMethodSchema, paymentStatusSchema } from "@/lib/schemas/order";

/**
 * Admin Hub contracts. These mirror the SECURITY DEFINER RPC payloads in
 * `API_CONTRACTS.md`. The list/snapshot views deliberately carry the fields the
 * operations team needs while the detail view is the only place that exposes a
 * handover PIN, which is why it is fetched on demand for a single order.
 */

const integer = z.coerce.number().int();
const nonnegative = integer.nonnegative();

export const adminOrderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "CONFIRMED_UNPAID",
  "PREPARING",
  "READY_FOR_PICKUP",
  "CLAIMED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "CANCELLED",
]);
export type AdminOrderStatus = z.infer<typeof adminOrderStatusSchema>;

export const adminOrderSummarySchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: integer,
  customerName: z.string(),
  customerPhone: z.string(),
  status: adminOrderStatusSchema,
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema,
  orderType: z.enum(["DELIVERY", "DINE_IN"]),
  deliveryArea: z.string().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  riderId: z.string().uuid().nullable().optional(),
  riderName: z.string().nullable().optional(),
  totalAmount: integer,
  createdAt: z.string(),
  acknowledgedAt: z.string().nullable().optional(),
  readyAt: z.string().nullable().optional(),
  etaAt: z.string().nullable().optional(),
});
export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;

export const adminOrderDetailSchema = adminOrderSummarySchema.extend({
  handoverPin: z.string().nullable().optional(),
  failedPinAttempts: nonnegative.default(0),
  pinLockedUntil: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  deliveryLatitude: z.coerce.number().nullable().optional(),
  deliveryLongitude: z.coerce.number().nullable().optional(),
  roadDistanceM: integer.nullable().optional(),
  codChangeDue: integer.nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  securityFlag: z.string().nullable().optional(),
  adminEditedAt: z.string().nullable().optional(),
  timeline: z
    .array(
      z.object({
        status: adminOrderStatusSchema,
        at: z.string(),
        reason: z.string().nullable().optional(),
      }),
    )
    .default([]),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: integer.positive(),
        unitPrice: integer,
        lineTotal: integer,
      }),
    )
    .default([]),
  payments: z
    .array(
      z.object({
        txRef: z.string(),
        method: z.string(),
        status: z.string(),
        amount: integer,
        createdAt: z.string().nullable().optional(),
      }),
    )
    .default([]),
  refund: z
    .object({
      id: z.string().uuid().optional(),
      status: z.string(),
      amount: integer.optional(),
      reason: z.string().nullable().optional(),
      requestedAt: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

export const adminSettingsSchema = z.object({
  restaurantName: z.string(),
  restaurantLat: z.coerce.number(),
  restaurantLng: z.coerce.number(),
  supportWhatsapp: z.string(),
  freeDeliveryRadiusKm: z.coerce.number(),
  ratePerExcessKm: integer,
  maxDeliveryRadiusKm: z.coerce.number(),
  codMaxRadiusKm: z.coerce.number(),
  minimumOrderValue: integer,
  minimumOrderValueDineIn: integer,
  packagingFeeDefault: integer,
  packagingFeeDineIn: integer,
  maxCartValue: integer,
  maxItemQuantity: integer,
  maxCartLines: integer,
  isStoreOpen: z.boolean(),
  openingTime: z.string(),
  closingTime: z.string(),
  isKitchenBusy: z.boolean(),
  busyBufferMinutes: integer,
  isKitchenPaused: z.boolean(),
  pinMaxAttempts: integer,
  pinLockMinutes: integer,
  pinGeofenceM: integer,
  staffSessionHours: integer,
});
export type AdminSettings = z.infer<typeof adminSettingsSchema>;

export const ledgerRowSchema = z.object({
  riderId: z.string().uuid(),
  riderName: z.string(),
  motorcyclePlate: z.string().nullable().optional(),
  expectedCash: integer,
  settledCash: integer,
  variance: integer,
  status: z.string(),
  linkedOrders: z
    .array(
      z.object({
        orderId: z.string().uuid(),
        orderNumber: integer,
        amount: integer,
      }),
    )
    .default([]),
});
export type LedgerRow = z.infer<typeof ledgerRowSchema>;

export const analyticsSchema = z.object({
  from: z.string(),
  to: z.string(),
  orders: integer,
  deliveredOrders: integer,
  cancelledOrders: integer,
  grossRevenue: integer,
  codCollected: integer,
  digitalCollected: integer,
  averageOrderValue: integer,
  averagePrepMinutes: z.coerce.number(),
  averageDeliveryMinutes: z.coerce.number(),
  topItems: z
    .array(z.object({ name: z.string(), quantity: integer }))
    .default([]),
});
export type Analytics = z.infer<typeof analyticsSchema>;

export const auditEventSchema = z.object({
  id: z.string().uuid().optional(),
  actorId: z.string().uuid().nullable().optional(),
  actorName: z.string().nullable().optional(),
  actorRole: z.string().nullable().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const adminMenuItemSchema = z.object({
  itemId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  basePrice: integer,
  imageUrl: z.string().nullable().optional(),
  prepTimeMinutes: integer,
  isAvailable: z.boolean(),
  isCombo: z.boolean(),
  sortOrder: integer,
});
export type AdminMenuItem = z.infer<typeof adminMenuItemSchema>;

export const adminCategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  displayOrder: integer,
  items: z.array(adminMenuItemSchema).default([]),
});
export type AdminCategory = z.infer<typeof adminCategorySchema>;

export const staffMemberSchema = z.object({
  profileId: z.string().uuid(),
  fullName: z.string(),
  phone: z.string(),
  role: z.enum(["ADMIN", "KITCHEN", "RIDER"]),
  isActive: z.boolean(),
  motorcyclePlate: z.string().nullable().optional(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const diningTableSchema = z.object({
  tableId: z.string().uuid(),
  tableNumber: z.string(),
  label: z.string(),
  qrToken: z.string(),
  isActive: z.boolean(),
});
export type DiningTable = z.infer<typeof diningTableSchema>;

export const refundRequestSchema = z.object({
  refundId: z.string().uuid(),
  orderId: z.string().uuid(),
  orderNumber: integer.optional(),
  amount: integer,
  status: z.string(),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  requestedAt: z.string().nullable().optional(),
});
export type RefundRequest = z.infer<typeof refundRequestSchema>;

export const adminSnapshotSchema = z.object({
  settings: adminSettingsSchema,
  orders: z.array(adminOrderSummarySchema),
  ledger: z.array(ledgerRowSchema),
  analytics: analyticsSchema,
  audit: z.array(auditEventSchema),
  menu: z.array(adminCategorySchema),
  staff: z.array(staffMemberSchema),
  tables: z.array(diningTableSchema),
  refunds: z.array(refundRequestSchema),
  fetchedAt: z.string(),
});
export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>;

export const adminOrderListSchema = z.object({
  total: integer,
  limit: integer,
  offset: integer,
  orders: z.array(adminOrderSummarySchema),
});
export type AdminOrderList = z.infer<typeof adminOrderListSchema>;

export const auditFeedSchema = z.object({
  total: integer,
  limit: integer,
  offset: integer,
  events: z.array(auditEventSchema),
});
export type AuditFeed = z.infer<typeof auditFeedSchema>;
