"use client";

import { useState, useTransition } from "react";

import { archiveMenuItemAction, upsertCategoryAction, upsertMenuItemAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/input";
import type { ToastInput } from "@/components/ui/toast";
import { formatUGX } from "@/lib/currency";
import type { AdminMenuItem, AdminSnapshot } from "@/lib/admin/types";

type Props = {
  snapshot: AdminSnapshot;
  onMutated: () => void;
  onToast: (toast: ToastInput) => void;
};

type ItemDraft = {
  itemId?: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  prepTimeMinutes: string;
  sortOrder: string;
  isAvailable: boolean;
  isCombo: boolean;
  imagePath: string;
};

function emptyDraft(categoryId: string): ItemDraft {
  return {
    categoryId,
    name: "",
    slug: "",
    description: "",
    basePrice: "",
    prepTimeMinutes: "10",
    sortOrder: "0",
    isAvailable: true,
    isCombo: false,
    imagePath: "",
  };
}

export function AdminMenu({ snapshot, onMutated, onToast }: Props) {
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", slug: "", displayOrder: "0" });
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function needReason(): boolean {
    if (reason.trim().length >= 3) return true;
    onToast({ tone: "error", title: "Reason required", description: "Type a reason with at least 3 characters." });
    return false;
  }

  function saveItem() {
    if (!draft || !needReason()) return;
    const payload = {
      ...(draft.itemId ? { itemId: draft.itemId } : {}),
      categoryId: draft.categoryId,
      name: draft.name,
      slug: draft.slug,
      description: draft.description || null,
      basePrice: Number(draft.basePrice),
      prepTimeMinutes: Number(draft.prepTimeMinutes),
      sortOrder: Number(draft.sortOrder),
      isAvailable: draft.isAvailable,
      isCombo: draft.isCombo,
      imagePath: draft.imagePath || null,
      reason,
    };
    startTransition(async () => {
      const result = await upsertMenuItemAction(payload);
      if (result.ok) {
        onToast({ tone: "success", title: "Menu item saved" });
        setDraft(null);
        setReason("");
        onMutated();
      } else {
        onToast({ tone: "error", title: "Could not save item", description: result.error.message });
      }
    });
  }

  function saveCategory() {
    if (!needReason()) return;
    startTransition(async () => {
      const result = await upsertCategoryAction({
        ...categoryDraft,
        displayOrder: Number(categoryDraft.displayOrder),
        reason,
      });
      if (result.ok) {
        onToast({ tone: "success", title: "Category saved" });
        setCategoryDraft({ name: "", slug: "", displayOrder: "0" });
        setReason("");
        onMutated();
      } else {
        onToast({ tone: "error", title: "Could not save category", description: result.error.message });
      }
    });
  }

  function archive(item: AdminMenuItem) {
    if (!needReason()) return;
    startTransition(async () => {
      const result = await archiveMenuItemAction({ itemId: item.itemId, reason });
      if (result.ok) {
        onToast({ tone: "success", title: "Item archived" });
        setReason("");
        onMutated();
      } else {
        onToast({ tone: "error", title: "Could not archive item", description: result.error.message });
      }
    });
  }

  return (
    <section aria-labelledby="admin-menu-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-menu-heading" className="text-lg font-extrabold text-green-800">
          Menu catalogue
        </h2>
        <p className="text-sm text-ink-secondary">
          Create and edit items, archive with a soft delete, and validate image paths.
        </p>
      </div>

      <div className="rounded-2xl border border-green-100 bg-surface p-4">
        <h3 className="mb-3 font-semibold text-green-900">Add a category</h3>
        <div className="flex flex-wrap items-end gap-2">
          <TextField label="Name" value={categoryDraft.name} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} className="w-44" />
          <TextField label="Slug" value={categoryDraft.slug} onChange={(e) => setCategoryDraft({ ...categoryDraft, slug: e.target.value })} className="w-44" />
          <TextField label="Order" value={categoryDraft.displayOrder} onChange={(e) => setCategoryDraft({ ...categoryDraft, displayOrder: e.target.value })} className="w-24" />
          <Button isLoading={pending} onClick={saveCategory} data-testid="admin-add-category">Add category</Button>
        </div>
      </div>

      {snapshot.menu.map((category) => (
        <div key={category.categoryId} className="rounded-2xl border border-green-100 bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-green-900">
              {category.name} <span className="text-xs text-ink-secondary">({category.slug})</span>
            </h3>
            <Button
              size="sm"
              variant="secondary"
              data-testid={`admin-add-item-${category.slug}`}
              onClick={() => setDraft(emptyDraft(category.categoryId))}
            >
              Add item
            </Button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {category.items.map((item) => (
              <li key={item.itemId} className="flex flex-col gap-2 rounded-xl border border-green-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-green-900">{item.name}</p>
                    <p className="text-xs text-ink-secondary">{formatUGX(item.basePrice)} · {item.prepTimeMinutes} min</p>
                  </div>
                  <Badge tone={item.isAvailable ? "success" : "neutral"}>
                    {item.isAvailable ? "Available" : "Archived"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraft({
                        itemId: item.itemId,
                        categoryId: item.categoryId,
                        name: item.name,
                        slug: item.slug,
                        description: item.description ?? "",
                        basePrice: String(item.basePrice),
                        prepTimeMinutes: String(item.prepTimeMinutes),
                        sortOrder: String(item.sortOrder),
                        isAvailable: item.isAvailable,
                        isCombo: item.isCombo,
                        imagePath: item.imageUrl ?? "",
                      })
                    }
                  >
                    Edit
                  </Button>
                  {item.isAvailable ? (
                    <Button size="sm" variant="danger" isLoading={pending} onClick={() => archive(item)}>
                      Archive
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-2xl border border-green-100 bg-surface p-4">
        <TextField
          label="Reason for menu change"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="At least 3 characters. Stored in the audit log."
        />
      </div>

      <Sheet
        open={draft !== null}
        onClose={() => !pending && setDraft(null)}
        title={draft?.itemId ? "Edit menu item" : "New menu item"}
        description="Image paths must begin with menu-images/ and stay within that bucket."
      >
        {draft ? (
          <div className="flex flex-col gap-3" data-testid="admin-menu-item-form">
            <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <TextField label="Slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            <TextField label="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <TextField label="Base price" value={draft.basePrice} inputMode="numeric" onChange={(e) => setDraft({ ...draft, basePrice: e.target.value })} />
            <TextField label="Prep minutes" value={draft.prepTimeMinutes} inputMode="numeric" onChange={(e) => setDraft({ ...draft, prepTimeMinutes: e.target.value })} />
            <TextField label="Sort order" value={draft.sortOrder} inputMode="numeric" onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
            <TextField label="Image path" value={draft.imagePath} onChange={(e) => setDraft({ ...draft, imagePath: e.target.value })} hint="e.g. menu-images/tilapia.webp" />
            <label className="flex items-center gap-2 text-sm font-semibold text-green-900">
              <input type="checkbox" checked={draft.isAvailable} onChange={(e) => setDraft({ ...draft, isAvailable: e.target.checked })} />
              Available
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-green-900">
              <input type="checkbox" checked={draft.isCombo} onChange={(e) => setDraft({ ...draft, isCombo: e.target.checked })} />
              Combo item
            </label>
            <Button isLoading={pending} onClick={saveItem} data-testid="admin-save-menu-item">Save item</Button>
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
