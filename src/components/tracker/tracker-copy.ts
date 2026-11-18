import type { BadgeTone } from "@/components/ui/badge";
import type { OrderConfirmation } from "@/lib/schemas/order";

export const STATUS_COPY: Record<
  OrderConfirmation["status"],
  { label: string; tone: BadgeTone; detail: string }
> = {
  PENDING_PAYMENT: {
    label: "Awaiting payment",
    tone: "warning",
    detail: "We have your order. The kitchen starts as soon as payment clears.",
  },
  CONFIRMED_UNPAID: {
    label: "Order received",
    tone: "brand",
    detail: "The kitchen will confirm your order shortly. Pay cash on delivery.",
  },
  PREPARING: {
    label: "Preparing",
    tone: "brand",
    detail: "The kitchen is cooking your order now.",
  },
  READY_FOR_PICKUP: {
    label: "Ready",
    tone: "success",
    detail: "Your order is packed and waiting for a rider.",
  },
  CLAIMED: {
    label: "With the rider",
    tone: "success",
    detail: "A rider has your order and is about to set off.",
  },
  OUT_FOR_DELIVERY: {
    label: "On the way",
    tone: "success",
    detail: "Your rider is heading to your pin.",
  },
  DELIVERED: {
    label: "Delivered",
    tone: "success",
    detail: "Enjoy your meal.",
  },
  DELIVERY_FAILED: {
    label: "Delivery failed",
    tone: "danger",
    detail: "Our team will contact you about this delivery.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "danger",
    detail: "This order was cancelled. Any payment taken is refunded.",
  },
};

export const PAYMENT_COPY: Record<
  OrderConfirmation["paymentStatus"],
  { label: string; tone: BadgeTone }
> = {
  PENDING: { label: "Payment pending", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  FAILED: { label: "Payment failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

export const TIMELINE_LABEL: Record<OrderConfirmation["status"], string> = {
  PENDING_PAYMENT: "Order placed",
  CONFIRMED_UNPAID: "Order received",
  PREPARING: "Cooking",
  READY_FOR_PICKUP: "Packed and ready",
  CLAIMED: "Rider assigned",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery failed",
  CANCELLED: "Cancelled",
};
