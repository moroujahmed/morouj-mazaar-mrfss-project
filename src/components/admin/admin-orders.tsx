"use client";

import { useMemo, useState, useTransition } from "react";

import {
  cancelOrderAction,
  completeOrderAction,
  getAdminOrderAction,
  reassignOrderAction,
  redeliverOrderAction,
  resetHandoverPinAction,
  updateOrderContactAction,
} from "@/actions/admin";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextField } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { ToastInput } from "@/components/ui/toast";
import { formatUGX } from "@/lib/currency";
import type { AdminOrderDetail, AdminOrderStatus, AdminSnapshot } from "@/lib/admin/types";

type Props = {
  snapshot: AdminSnapshot;
  onMutated: () => void;
  onToast: (toast: ToastInput) => void;
};

const STATUS_TONE: Record<AdminOrderStatus, BadgeTone> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED_UNPAID: "brand",
  PREPARING: "brand",
  READY_FOR_PICKUP: "success",
  CLAIMED: "success",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "neutral",
  DELIVERY_FAILED: "danger",
  CANCELLED: "neutral",
};

function statusLabel(status: AdminOrderStatus): string {
  return status.replaceAll("_", " ");
}

export function AdminOrders({ snapshot, onMutated, onToast }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, startPending] = useTransition();
  const [reason, setReason] = useState("");
  const [riderId, setRiderId] = useState("");
  const [edit, setEdit] = useState({ customerName: "", customerPhone: "", notes: "" });

  const riders = snapshot.staff.filter((member) => member.role === "RIDER" && member.isActive);

  const orders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.orders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        String(order.orderNumber).includes(needle) ||
        order.customerName.toLowerCase().includes(needle) ||
        order.customerPhone.includes(needle)
      );
    });
  }, [query, snapshot.orders, statusFilter]);

  function open(orderId: string) {
    setSelectedId(orderId);
    setReason("");
    startLoading(async () => {
      const result = await getAdminOrderAction({ orderId });
      if (result.ok) {
        setDetail(result.data);
        setEdit({
          customerName: result.data.customerName ?? "",
          customerPhone: result.data.customerPhone ?? "",
          notes: result.data.notes ?? "",
        });
        setRiderId(result.data.riderId ?? "");
      } else {
        onToast({ tone: "error", title: "Could not load order", description: result.error.message });
      }
    });
  }

  function act(
    label: string,
    work: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) {
    if (reason.trim().length < 3) {
      onToast({ tone: "error", title: "Reason required", description: "Type a reason with at least 3 characters." });
      return;
    }
    startPending(async () => {
      const result = await work();
      if (result.ok) {
        onToast({ tone: "success", title: label });
        setReason("");
        onMutated();
        if (selectedId) open(selectedId);
      } else {
        onToast({ tone: "error", title: `${label} failed`, description: result.error?.message });
      }
    });
  }

  return (
    <section aria-labelledby="admin-orders-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-orders-heading" className="text-lg font-extrabold text-green-800">
            Live orders
          </h2>
          <p className="text-sm text-ink-secondary">
            Open an order for the audited drawer. Destructive actions require a reason.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TextField
            label="Search orders"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order #, name, phone"
            className="w-56"
          />
          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-52"
          >
            <option value="ALL">All statuses</option>
            {Object.keys(STATUS_TONE).map((status) => (
              <option key={status} value={status}>
                {statusLabel(status as AdminOrderStatus)}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders match" description="Try a different status or search term." />
      ) : (
        <Table caption="Orders" containerLabel="Orders table">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Order</TableHeaderCell>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Total</TableHeaderCell>
              <TableHeaderCell>Rider</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.orderId} data-testid={`admin-order-row-${order.orderNumber}`}>
                <TableCell>
                  <span className="font-semibold text-green-800">#{order.orderNumber}</span>
                  <span className="block text-xs text-ink-secondary">{order.orderType}</span>
                </TableCell>
                <TableCell>
                  {order.customerName}
                  <span className="block text-xs text-ink-secondary">{order.customerPhone}</span>
                </TableCell>
                <TableCell>
                  <Badge tone={STATUS_TONE[order.status]}>{statusLabel(order.status)}</Badge>
                </TableCell>
                <TableCell>{formatUGX(order.totalAmount)}</TableCell>
                <TableCell>{order.riderName ?? "—"}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid={`admin-open-order-${order.orderNumber}`}
                    onClick={() => open(order.orderId)}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet
        open={selectedId !== null}
        onClose={() => {
          if (!pending) {
            setSelectedId(null);
            setDetail(null);
          }
        }}
        title={detail ? `Order #${detail.orderNumber}` : "Order"}
        description="Every change is audited. A typed reason is required for destructive actions."
        footer={
          detail ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                isLoading={pending}
                onClick={() =>
                  act("Contact updated", () =>
                    updateOrderContactAction({
                      orderId: detail.orderId,
                      customerName: edit.customerName,
                      customerPhone: edit.customerPhone,
                      customerNotes: edit.notes,
                      reason: reason || "Contact correction",
                    }),
                  )
                }
              >
                Save contact
              </Button>
              <Button
                variant="secondary"
                isLoading={pending}
                onClick={() => act("Order completed", () => completeOrderAction({ orderId: detail.orderId, reason }))}
              >
                Complete
              </Button>
              <Button
                variant="secondary"
                isLoading={pending}
                onClick={() => act("PIN reset", () => resetHandoverPinAction({ orderId: detail.orderId, reason }))}
              >
                Reset PIN
              </Button>
              <Button
                variant="danger"
                isLoading={pending}
                onClick={() => act("Order cancelled", () => cancelOrderAction({ orderId: detail.orderId, reason }))}
              >
                Cancel order
              </Button>
            </div>
          ) : undefined
        }
      >
        {loading || !detail ? (
          <p className="text-sm text-ink-secondary">Loading order…</p>
        ) : (
          <div className="flex flex-col gap-4" data-testid="admin-order-drawer">
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[detail.status]}>{statusLabel(detail.status)}</Badge>
              <Badge tone="neutral">{detail.paymentStatus}</Badge>
              <Badge tone="neutral">{formatUGX(detail.totalAmount)}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-ink-secondary">Customer</dt><dd className="font-medium">{detail.customerName}</dd></div>
              <div><dt className="text-ink-secondary">Phone</dt><dd className="font-medium">{detail.customerPhone}</dd></div>
              <div><dt className="text-ink-secondary">Rider</dt><dd className="font-medium">{detail.riderName ?? "Unassigned"}</dd></div>
              <div><dt className="text-ink-secondary">Handover PIN</dt><dd className="font-medium">{detail.handoverPin ?? "—"}</dd></div>
            </dl>

            <TextField
              label="Reason (required for destructive actions)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="At least 3 characters. Stored in the audit log."
              data-testid="admin-action-reason"
            />
            <TextField
              label="Customer name"
              value={edit.customerName}
              onChange={(event) => setEdit((current) => ({ ...current, customerName: event.target.value }))}
            />
            <TextField
              label="Customer phone"
              value={edit.customerPhone}
              onChange={(event) => setEdit((current) => ({ ...current, customerPhone: event.target.value }))}
            />
            <TextField
              label="Notes"
              value={edit.notes}
              onChange={(event) => setEdit((current) => ({ ...current, notes: event.target.value }))}
            />

            <div className="rounded-xl border border-green-100 p-3">
              <p className="mb-2 text-sm font-semibold text-green-900">Reassign / redeliver</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <SelectField
                  label="Rider"
                  value={riderId}
                  onChange={(event) => setRiderId(event.target.value)}
                  className="sm:flex-1"
                >
                  <option value="">Select rider</option>
                  {riders.map((rider) => (
                    <option key={rider.profileId} value={rider.profileId}>
                      {rider.fullName}
                    </option>
                  ))}
                </SelectField>
                <Button
                  variant="secondary"
                  isLoading={pending}
                  onClick={() => {
                    if (!riderId) {
                      onToast({ tone: "error", title: "Choose a rider" });
                      return;
                    }
                    act("Order reassigned", () =>
                      reassignOrderAction({ orderId: detail.orderId, riderId, reason }),
                    );
                  }}
                >
                  Reassign
                </Button>
                <Button
                  variant="secondary"
                  isLoading={pending}
                  onClick={() =>
                    act("Redelivery created", () =>
                      redeliverOrderAction({
                        orderId: detail.orderId,
                        riderId: riderId || null,
                        reason,
                      }),
                    )
                  }
                >
                  Redeliver
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-green-900">Items</p>
              <ul className="space-y-1 text-sm">
                {detail.items.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                    <span>{item.quantity} × {item.name}</span>
                    <span>{formatUGX(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-green-900">Timeline</p>
              <ul className="space-y-1 text-xs text-ink-secondary">
                {detail.timeline.map((entry, index) => (
                  <li key={`${entry.status}-${entry.at}-${index}`}>
                    <span className="font-medium text-green-900">{statusLabel(entry.status as AdminOrderStatus)}</span>{" "}
                    {new Date(entry.at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" })}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
