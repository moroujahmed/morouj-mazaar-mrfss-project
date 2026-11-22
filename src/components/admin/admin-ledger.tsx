"use client";

import { useState, useTransition } from "react";

import { reconcileCashAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { ToastInput } from "@/components/ui/toast";
import { formatUGX } from "@/lib/currency";
import type { AdminSnapshot } from "@/lib/admin/types";

type Props = {
  snapshot: AdminSnapshot;
  onMutated: () => void;
  onToast: (toast: ToastInput) => void;
};

export function AdminLedger({ snapshot, onMutated, onToast }: Props) {
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const totalExpected = snapshot.ledger.reduce((sum, row) => sum + row.expectedCash, 0);
  const totalSettled = snapshot.ledger.reduce((sum, row) => sum + row.settledCash, 0);

  function reconcile(riderId: string) {
    const amount = Number(counted[riderId]);
    const reason = notes[riderId] ?? "";
    if (!Number.isInteger(amount) || amount < 0) {
      onToast({ tone: "error", title: "Invalid amount", description: "Enter a whole shilling amount of 0 or more." });
      return;
    }
    if (reason.trim().length < 3) {
      onToast({ tone: "error", title: "Reason required", description: "Type a note with at least 3 characters." });
      return;
    }
    startTransition(async () => {
      const result = await reconcileCashAction({ riderId, countedCash: amount, notes: reason });
      if (result.ok) {
        onToast({
          tone: "success",
          title: "Cash reconciled",
          description: `Business date ${String(result.data.businessDate)} · ${result.data.status}`,
        });
        onMutated();
      } else {
        onToast({ tone: "error", title: "Reconciliation failed", description: result.error.message });
      }
    });
  }

  return (
    <section aria-labelledby="admin-ledger-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-ledger-heading" className="text-lg font-extrabold text-green-800">
          Cash ledger
        </h2>
        <p className="text-sm text-ink-secondary">
          EAT business date {snapshot.analytics.to}. Expected cash sums to the linked delivered COD orders.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl border border-green-100 bg-surface px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-secondary">Expected</p>
          <p className="text-xl font-extrabold text-green-800">{formatUGX(totalExpected)}</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-surface px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-secondary">Settled</p>
          <p className="text-xl font-extrabold text-green-800">{formatUGX(totalSettled)}</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-surface px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-secondary">Outstanding</p>
          <p className="text-xl font-extrabold text-green-800">{formatUGX(totalExpected - totalSettled)}</p>
        </div>
      </div>

      {snapshot.ledger.length === 0 ? (
        <EmptyState title="No riders on shift" description="Cash rows appear once riders deliver COD orders." />
      ) : (
        <Table caption="Cash ledger" containerLabel="Cash ledger table">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Rider</TableHeaderCell>
              <TableHeaderCell>Expected</TableHeaderCell>
              <TableHeaderCell>Settled</TableHeaderCell>
              <TableHeaderCell>Variance</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Reconcile</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshot.ledger.map((row) => (
              <TableRow key={row.riderId} data-testid={`admin-ledger-row-${row.riderName}`}>
                <TableCell>
                  <span className="font-semibold">{row.riderName}</span>
                  <span className="block text-xs text-ink-secondary">{row.motorcyclePlate ?? ""}</span>
                </TableCell>
                <TableCell>{formatUGX(row.expectedCash)}</TableCell>
                <TableCell>{formatUGX(row.settledCash)}</TableCell>
                <TableCell>{formatUGX(row.variance)}</TableCell>
                <TableCell>
                  <Badge tone={row.status === "SETTLED" ? "success" : row.status === "PARTIAL" ? "warning" : "neutral"}>
                    {row.status}
                  </Badge>
                  {row.linkedOrders.length ? (
                    <span className="block text-xs text-ink-secondary">
                      {row.linkedOrders.map((order) => `#${order.orderNumber}`).join(", ")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <TextField
                      label="Counted cash"
                      inputMode="numeric"
                      value={counted[row.riderId] ?? String(row.settledCash)}
                      onChange={(event) =>
                        setCounted((current) => ({ ...current, [row.riderId]: event.target.value }))
                      }
                      className="w-32"
                    />
                    <TextField
                      label="Notes"
                      value={notes[row.riderId] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [row.riderId]: event.target.value }))
                      }
                      className="w-44"
                    />
                    <Button
                      size="sm"
                      isLoading={pending}
                      onClick={() => reconcile(row.riderId)}
                      data-testid={`admin-reconcile-${row.riderName}`}
                    >
                      Reconcile
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
