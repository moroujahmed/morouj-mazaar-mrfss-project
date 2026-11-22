"use client";

import { useState, useTransition } from "react";

import { updateSettingsAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import type { ToastInput } from "@/components/ui/toast";
import type { AdminSettings, AdminSnapshot } from "@/lib/admin/types";

type Props = {
  snapshot: AdminSnapshot;
  onMutated: () => void;
  onToast: (toast: ToastInput) => void;
};

type NumberKey = {
  [K in keyof AdminSettings]: AdminSettings[K] extends number ? K : never;
}[keyof AdminSettings];

const GROUPS: Array<{ title: string; fields: Array<{ key: NumberKey | keyof AdminSettings; label: string; step?: string }> }> = [
  {
    title: "Storefront & delivery",
    fields: [
      { key: "restaurantName", label: "Restaurant name" },
      { key: "supportWhatsapp", label: "Support WhatsApp" },
      { key: "freeDeliveryRadiusKm", label: "Free delivery radius (km)", step: "0.1" },
      { key: "ratePerExcessKm", label: "Rate per excess km" },
      { key: "maxDeliveryRadiusKm", label: "Max delivery radius (km)", step: "0.1" },
      { key: "codMaxRadiusKm", label: "COD max radius (km)", step: "0.1" },
      { key: "minimumOrderValue", label: "Minimum order value" },
      { key: "minimumOrderValueDineIn", label: "Dine-in minimum" },
      { key: "packagingFeeDefault", label: "Packaging fee (delivery)" },
      { key: "packagingFeeDineIn", label: "Packaging fee (dine-in)" },
      { key: "maxCartValue", label: "Max cart value" },
      { key: "maxItemQuantity", label: "Max item quantity" },
      { key: "maxCartLines", label: "Max cart lines" },
    ],
  },
  {
    title: "Hours & kitchen",
    fields: [
      { key: "openingTime", label: "Opening time" },
      { key: "closingTime", label: "Closing time" },
      { key: "busyBufferMinutes", label: "Busy buffer (minutes)" },
      { key: "pinMaxAttempts", label: "PIN max attempts" },
      { key: "pinLockMinutes", label: "PIN lock (minutes)" },
      { key: "pinGeofenceM", label: "PIN geofence (metres)" },
      { key: "staffSessionHours", label: "Staff session (hours)" },
    ],
  },
];

export function AdminSettings({ snapshot, onMutated, onToast }: Props) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(snapshot.settings).map(([key, value]) => [key, String(value)]),
    ),
  );

  function save() {
    if (reason.trim().length < 3) {
      onToast({ tone: "error", title: "Reason required", description: "Type a reason with at least 3 characters." });
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(draft)) {
      const original = String((snapshot.settings as unknown as Record<string, unknown>)[key]);
      if (value === original) continue;
      const current = (snapshot.settings as unknown as Record<string, unknown>)[key];
      if (typeof current === "number") patch[key] = Number(value);
      else if (typeof current === "boolean") patch[key] = value === "true";
      else patch[key] = value;
    }
    if (Object.keys(patch).length === 0) {
      onToast({ tone: "info", title: "No changes to save" });
      return;
    }
    startTransition(async () => {
      const result = await updateSettingsAction({ ...patch, reason });
      if (result.ok) {
        onToast({ tone: "success", title: "Settings saved" });
        setReason("");
        onMutated();
      } else {
        onToast({ tone: "error", title: "Could not save settings", description: result.error.message });
      }
    });
  }

  return (
    <section aria-labelledby="admin-settings-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-settings-heading" className="text-lg font-extrabold text-green-800">
          Settings
        </h2>
        <p className="text-sm text-ink-secondary">
          Values are validated against the documented bounds. Every save writes a history row and an audit entry.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="rounded-2xl border border-green-100 bg-surface p-4">
          <h3 className="mb-3 font-semibold text-green-900">{group.title}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.fields.map(({ key, label, step }) => (
              <TextField
                key={key as string}
                label={label}
                value={draft[key as string] ?? ""}
                step={step}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [key as string]: event.target.value }))
                }
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-green-100 bg-surface p-4">
        <label className="flex min-w-56 flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold text-green-900">Reason for change</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Increased delivery radius after route review"
            className="min-h-12 rounded-xl border-2 border-green-100 bg-surface px-4 text-base focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-800"
          />
        </label>
        <Button isLoading={pending} onClick={save} data-testid="admin-save-settings" className="self-end">
          Save settings
        </Button>
      </div>
    </section>
  );
}
