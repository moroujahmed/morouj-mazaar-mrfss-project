"use client";

import { useState, useTransition } from "react";

import { updateStaffAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { ToastInput } from "@/components/ui/toast";
import type { AdminSnapshot, StaffMember } from "@/lib/admin/types";

type Props = {
  snapshot: AdminSnapshot;
  onMutated: () => void;
  onToast: (toast: ToastInput) => void;
};

type StaffDraft = {
  profileId: string;
  role: StaffMember["role"];
  isActive: boolean;
  motorcyclePlate: string;
};

/**
 * Staff directory. Role and active changes always carry a typed reason; the
 * server rejects demoting or deactivating the last active admin
 * (`LAST_ADMIN_PROTECTED`), and the button is disabled here for the same case
 * so the guard is visible before the round trip.
 */
export function AdminStaff({ snapshot, onMutated, onToast }: Props) {
  const [drafts, setDrafts] = useState<Record<string, StaffDraft>>(() =>
    Object.fromEntries(
      snapshot.staff.map((member) => [
        member.profileId,
        {
          profileId: member.profileId,
          role: member.role,
          isActive: member.isActive,
          motorcyclePlate: member.motorcyclePlate ?? "",
        },
      ]),
    ),
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const activeAdmins = snapshot.staff.filter(
    (member) => member.role === "ADMIN" && member.isActive,
  );

  function isLastAdmin(member: StaffMember, draft: StaffDraft): boolean {
    return (
      member.role === "ADMIN" &&
      member.isActive &&
      activeAdmins.length === 1 &&
      (draft.role !== "ADMIN" || !draft.isActive)
    );
  }

  function save(member: StaffMember) {
    const draft = drafts[member.profileId];
    if (!draft) return;
    const reason = reasons[member.profileId] ?? "";
    if (reason.trim().length < 3) {
      onToast({
        tone: "error",
        title: "Reason required",
        description: "Type a reason with at least 3 characters.",
      });
      return;
    }
    if (isLastAdmin(member, draft)) {
      onToast({
        tone: "error",
        title: "Last admin protected",
        description: "You cannot demote or deactivate the last active admin.",
      });
      return;
    }
    startTransition(async () => {
      const result = await updateStaffAction({
        profileId: member.profileId,
        role: draft.role,
        isActive: draft.isActive,
        motorcyclePlate: draft.motorcyclePlate || null,
        reason,
      });
      if (result.ok) {
        onToast({ tone: "success", title: "Staff member updated" });
        setReasons((current) => ({ ...current, [member.profileId]: "" }));
        onMutated();
      } else {
        onToast({
          tone: "error",
          title: "Could not update staff member",
          description: result.error.message,
        });
      }
    });
  }

  return (
    <section aria-labelledby="admin-staff-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-staff-heading" className="text-lg font-extrabold text-green-800">
          Staff &amp; roles
        </h2>
        <p className="text-sm text-ink-secondary">
          {activeAdmins.length} active administrator{activeAdmins.length === 1 ? "" : "s"}.
          The last active admin cannot be demoted or deactivated.
        </p>
      </div>

      <Table caption="Staff members" containerLabel="Staff directory table">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Phone</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
            <TableHeaderCell>Plate</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Reason &amp; save</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {snapshot.staff.map((member) => {
            const draft = drafts[member.profileId];
            if (!draft) return null;
            const protectedMember = isLastAdmin(member, draft);
            return (
              <TableRow key={member.profileId} data-testid={`admin-staff-row-${member.fullName}`}>
                <TableCell>
                  <span className="font-semibold">{member.fullName}</span>
                </TableCell>
                <TableCell>{member.phone}</TableCell>
                <TableCell>
                  <SelectField
                    label="Role"
                    value={draft.role}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [member.profileId]: {
                          ...draft,
                          role: event.target.value as StaffMember["role"],
                        },
                      }))
                    }
                    className="w-32"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="KITCHEN">Kitchen</option>
                    <option value="RIDER">Rider</option>
                  </SelectField>
                </TableCell>
                <TableCell>
                  <TextField
                    label="Plate"
                    value={draft.motorcyclePlate}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [member.profileId]: {
                          ...draft,
                          motorcyclePlate: event.target.value,
                        },
                      }))
                    }
                    className="w-32"
                  />
                </TableCell>
                <TableCell>
                  <label className="flex items-center gap-2 text-sm font-semibold text-green-900">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [member.profileId]: {
                            ...draft,
                            isActive: event.target.checked,
                          },
                        }))
                      }
                    />
                    Active
                  </label>
                  <span className="mt-1 block">
                    <Badge tone={member.isActive ? "success" : "neutral"}>
                      {member.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <TextField
                      label="Reason"
                      value={reasons[member.profileId] ?? ""}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [member.profileId]: event.target.value,
                        }))
                      }
                      className="w-48"
                      data-testid={`admin-staff-reason-${member.fullName}`}
                    />
                    <Button
                      size="sm"
                      isLoading={pending}
                      disabled={protectedMember}
                      onClick={() => save(member)}
                      data-testid={`admin-staff-save-${member.fullName}`}
                    >
                      Save
                    </Button>
                  </div>
                  {protectedMember ? (
                    <p className="mt-1 text-xs text-status-danger">Last admin — change protected.</p>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
