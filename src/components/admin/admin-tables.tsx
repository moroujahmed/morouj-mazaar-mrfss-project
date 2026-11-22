"use client";

import { useState, useTransition } from "react";

import { upsertTableAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { ToastInput } from "@/components/ui/toast";
import type { AdminSnapshot, DiningTable } from "@/lib/admin/types";

type Props = {
  snapshot: AdminSnapshot;
  onMutated: () => void;
  onToast: (toast: ToastInput) => void;
};

type TableDraft = {
  tableId?: string;
  tableNumber: string;
  label: string;
  isActive: boolean;
};

/**
 * Dining-table management. Creating a table mints a fresh QR token; editing an
 * existing one keeps its token so printed QR codes stay valid. Every create or
 * update carries a typed, audited reason.
 */
export function AdminTables({ snapshot, onMutated, onToast }: Props) {
  const [draft, setDraft] = useState<TableDraft | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!draft) return;
    if (!draft.tableNumber.trim() || !draft.label.trim()) {
      onToast({ tone: "error", title: "Missing details", description: "Table number and label are required." });
      return;
    }
    if (reason.trim().length < 3) {
      onToast({ tone: "error", title: "Reason required", description: "Type a reason with at least 3 characters." });
      return;
    }
    startTransition(async () => {
      const result = await upsertTableAction({
        ...(draft.tableId ? { tableId: draft.tableId } : {}),
        tableNumber: draft.tableNumber.trim(),
        label: draft.label.trim(),
        isActive: draft.isActive,
        reason,
      });
      if (result.ok) {
        onToast({
          tone: "success",
          title: draft.tableId ? "Table updated" : "Table created",
          description: draft.tableId ? undefined : "A new QR token was minted.",
        });
        setDraft(null);
        setReason("");
        onMutated();
      } else {
        onToast({ tone: "error", title: "Could not save table", description: result.error.message });
      }
    });
  }

  function edit(table: DiningTable) {
    setDraft({
      tableId: table.tableId,
      tableNumber: table.tableNumber,
      label: table.label,
      isActive: table.isActive,
    });
    setReason("");
  }

  return (
    <section aria-labelledby="admin-tables-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-tables-heading" className="text-lg font-extrabold text-green-800">
            Dine-in tables
          </h2>
          <p className="text-sm text-ink-secondary">
            QR tokens link to <code className="text-xs">/?table=&lt;token&gt;</code>. Editing a table keeps its token so printed codes keep working.
          </p>
        </div>
        <Button
          data-testid="admin-add-table"
          onClick={() => {
            setDraft({ tableNumber: "", label: "", isActive: true });
            setReason("");
          }}
        >
          Add table
        </Button>
      </div>

      {draft ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4" data-testid="admin-table-form">
          <h3 className="mb-3 font-semibold text-green-900">
            {draft.tableId ? `Edit table ${draft.tableNumber}` : "New table"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Table number"
              value={draft.tableNumber}
              onChange={(event) => setDraft({ ...draft, tableNumber: event.target.value })}
            />
            <TextField
              label="Label"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
            <TextField
              label="Reason for change"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              hint="At least 3 characters. Stored in the audit log."
            />
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-green-900">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
              />
              Active
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button isLoading={pending} onClick={save} data-testid="admin-save-table">Save table</Button>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={pending}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <Table caption="Dining tables" containerLabel="Dining tables table">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Table</TableHeaderCell>
            <TableHeaderCell>Label</TableHeaderCell>
            <TableHeaderCell>QR link</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Action</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {snapshot.tables.map((table) => (
            <TableRow key={table.tableId} data-testid={`admin-table-row-${table.tableNumber}`}>
              <TableCell>
                <span className="font-semibold text-green-800">{table.tableNumber}</span>
              </TableCell>
              <TableCell>{table.label}</TableCell>
              <TableCell>
                <code className="break-all text-xs text-ink-secondary" data-testid={`admin-table-qr-${table.tableNumber}`}>
                  /?table={table.qrToken}
                </code>
              </TableCell>
              <TableCell>
                <Badge tone={table.isActive ? "success" : "neutral"}>
                  {table.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="secondary" onClick={() => edit(table)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
