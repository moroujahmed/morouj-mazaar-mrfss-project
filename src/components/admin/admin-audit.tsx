"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { AdminSnapshot } from "@/lib/admin/types";

export function AdminAudit({ snapshot }: { snapshot: AdminSnapshot }) {
  return (
    <section aria-labelledby="admin-audit-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-audit-heading" className="text-lg font-extrabold text-green-800">
          Audit feed
        </h2>
        <p className="text-sm text-ink-secondary">
          Most recent {snapshot.audit.length} administrative and staff actions.
        </p>
      </div>

      {snapshot.audit.length === 0 ? (
        <EmptyState title="No audit events yet" description="Actions appear here as soon as staff make a change." />
      ) : (
        <Table caption="Audit events" containerLabel="Audit feed table">
          <TableHead>
            <TableRow>
              <TableHeaderCell>When</TableHeaderCell>
              <TableHeaderCell>Actor</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshot.audit.map((event, index) => (
              <TableRow key={event.id ?? `${event.createdAt}-${index}`} data-testid="admin-audit-row">
                <TableCell>
                  {new Date(event.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Kampala" })}
                </TableCell>
                <TableCell>
                  {event.actorName ?? "System"}
                  <span className="block text-xs text-ink-secondary">{event.actorRole ?? ""}</span>
                </TableCell>
                <TableCell>
                  <Badge tone="neutral">{event.action}</Badge>
                  <span className="block text-xs text-ink-secondary">
                    {event.entityType}{event.entityId ? ` · ${event.entityId.slice(0, 8)}` : ""}
                  </span>
                </TableCell>
                <TableCell>{event.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
