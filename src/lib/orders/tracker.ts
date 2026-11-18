import type {
  FeedbackRating,
  OrderConfirmation,
} from "@/lib/schemas/order";

/**
 * Live tracker payload.
 *
 * The order token is a bearer capability, but polling still returns a narrower
 * payload than the initial token RPC: no handover PIN, no customer phone, no
 * notes, and no payment reference. The PIN is rendered once from the server
 * page and then hidden as soon as the order reaches a terminal state.
 */
export type TrackerTimelineEntry = {
  status: OrderConfirmation["status"];
  at: string;
  reason?: string | null;
};

export type TrackerSnapshot = {
  orderToken: string;
  orderNumber: number;
  orderType: OrderConfirmation["orderType"];
  status: OrderConfirmation["status"];
  paymentStatus: OrderConfirmation["paymentStatus"];
  paymentMethod: OrderConfirmation["paymentMethod"];
  customerName: string;
  tableNumber?: string | null;
  deliveryArea?: string | null;
  itemsSubtotal: number;
  modifiersTotal: number;
  deliveryFee: number;
  packagingFee: number;
  totalAmount: number;
  codChangeRequestedFor?: number | null;
  codChangeDue?: number | null;
  etaAt?: string | null;
  acknowledgedAt?: string | null;
  roadDistanceM?: number | null;
  estimatedTravelMinutes?: number | null;
  createdAt?: string;
  readyAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  canRate?: boolean;
  feedback?: { rating: FeedbackRating; notes?: string | null } | null;
  timeline: TrackerTimelineEntry[];
  refund?: {
    status: string;
    amount: number;
    reason?: string | null;
    requestedAt?: string | null;
    completedAt?: string | null;
  } | null;
  deliveryFailure?: {
    outcome: string;
    reason?: string | null;
    createdAt?: string | null;
  } | null;
  rider?: {
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    updatedAt?: string | null;
  } | null;
  items: OrderConfirmation["items"];
};

export function toTrackerSnapshot(order: OrderConfirmation): TrackerSnapshot {
  return {
    orderToken: order.orderToken,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    tableNumber: order.tableNumber,
    deliveryArea: order.deliveryArea,
    itemsSubtotal: order.itemsSubtotal,
    modifiersTotal: order.modifiersTotal,
    deliveryFee: order.deliveryFee,
    packagingFee: order.packagingFee,
    totalAmount: order.totalAmount,
    codChangeRequestedFor: order.codChangeRequestedFor,
    codChangeDue: order.codChangeDue,
    etaAt: order.etaAt,
    acknowledgedAt: order.acknowledgedAt,
    roadDistanceM: order.roadDistanceM,
    estimatedTravelMinutes: order.estimatedTravelMinutes,
    createdAt: order.createdAt,
    readyAt: order.readyAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
    destinationLatitude: order.destinationLatitude,
    destinationLongitude: order.destinationLongitude,
    canRate: order.canRate,
    feedback: order.feedback,
    timeline: order.timeline,
    refund: order.refund,
    deliveryFailure: order.deliveryFailure,
    rider: order.rider
      ? {
          name: order.rider.name,
          latitude: order.rider.latitude,
          longitude: order.rider.longitude,
          updatedAt: order.rider.updatedAt,
        }
      : null,
    items: order.items,
  };
}

export function isTerminalStatus(status: TrackerSnapshot["status"]): boolean {
  return (
    status === "DELIVERED" ||
    status === "DELIVERY_FAILED" ||
    status === "CANCELLED"
  );
}

/** Parse an ISO timestamp, returning null instead of an invalid date. */
export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
