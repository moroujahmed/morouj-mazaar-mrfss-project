import { getAuthorizedProfile } from "@/lib/auth/guards";
import { getKitchenStore } from "@/lib/kitchen/store";
import type { KitchenTicket } from "@/lib/kitchen/types";
import { formatUGX } from "@/lib/currency";

/**
 * Browser-print kitchen docket (ADR-007).
 *
 * KITCHEN/ADMIN only. The docket never contains the handover PIN or the
 * customer phone number (the board contract does not expose either), and every
 * render is audited by `audit_kitchen_reprint`.
 */

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PAYMENT_LABELS: Record<KitchenTicket["paymentMethod"], string> = {
  MTN_MOMO: "MTN MoMo",
  AIRTEL_MONEY: "Airtel Money",
  BANK_CARD: "Card",
  CASH_ON_DELIVERY: "Cash on delivery",
};

const kampalaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kampala",
  dateStyle: "medium",
  timeStyle: "short",
});

function placedAt(ticket: KitchenTicket): string {
  const date = new Date(ticket.createdAt);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : kampalaTime.format(date);
}

function docketHtml(ticket: KitchenTicket): string {
  const typeLabel =
    ticket.orderType === "DINE_IN"
      ? `Dine-in${ticket.tableNumber ? ` · Table ${ticket.tableNumber}` : ""}`
      : "Delivery";

  const items = ticket.items
    .map((item) => {
      const modifiers = item.modifiers
        .map(
          (modifier) =>
            `<li>${escapeHtml(modifier.name)}${
              modifier.priceDelta > 0
                ? ` (+${escapeHtml(formatUGX(modifier.priceDelta))})`
                : ""
            }</li>`,
        )
        .join("");

      return `<li class="item">
        <span class="qty">${item.quantity}×</span>
        <span class="name">${escapeHtml(item.name)}</span>
        ${modifiers ? `<ul class="mods">${modifiers}</ul>` : ""}
      </li>`;
    })
    .join("");

  const change =
    ticket.paymentMethod === "CASH_ON_DELIVERY" &&
    ticket.codChangeDue != null &&
    ticket.codChangeDue > 0
      ? `<p class="strong">Change due: ${escapeHtml(formatUGX(ticket.codChangeDue))}</p>`
      : "";

  const notes = ticket.customerNotes
    ? `<section><h2>Customer note</h2><p>${escapeHtml(ticket.customerNotes)}</p></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Docket #${ticket.orderNumber}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; width: 72mm; font: 12px/1.45 "Segoe UI", Arial, sans-serif; color: #102e27; }
  h1 { margin: 0; font-size: 16px; }
  h2 { margin: 10px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  header { border-bottom: 1px dashed #102e27; padding-bottom: 6px; }
  .sub { margin: 2px 0 0; color: #52635d; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .strong { font-weight: 700; }
  ul { margin: 0; padding: 0; list-style: none; }
  .item { display: grid; grid-template-columns: 16mm 1fr; gap: 2px; padding: 5px 0; border-bottom: 1px dotted #c9d4d0; }
  .qty { font-weight: 700; }
  .mods { grid-column: 2; padding-left: 0; color: #52635d; }
  .mods li::before { content: "– "; }
  .total { margin-top: 8px; font-size: 14px; }
  footer { margin-top: 10px; border-top: 1px dashed #102e27; padding-top: 6px; color: #52635d; font-size: 10px; }
  .print-bar { margin: 12px 0; }
  .print-bar button { width: 100%; min-height: 44px; border: 0; border-radius: 8px; background: #173f35; color: #fff; font: inherit; font-weight: 700; }
  @media print { .print-bar { display: none; } }
</style>
</head>
<body>
  <div class="print-bar"><button type="button" onclick="window.print()">Print docket</button></div>
  <header>
    <h1>Bazaar Flame &amp; Grill</h1>
    <p class="sub">Kitchen docket · ${escapeHtml(typeLabel)}</p>
    <p class="sub">Order #${ticket.orderNumber} · ${escapeHtml(placedAt(ticket))}</p>
  </header>
  <section>
    <h2>Customer</h2>
    <p class="strong">${escapeHtml(ticket.customerName)}</p>
  </section>
  <section>
    <h2>Items</h2>
    <ul>${items || "<li>No items recorded</li>"}</ul>
  </section>
  ${notes}
  <section>
    <h2>Payment</h2>
    <p>${escapeHtml(PAYMENT_LABELS[ticket.paymentMethod])} · ${escapeHtml(
      ticket.paymentStatus === "PAID" ? "Paid" : "Collect payment",
    )}</p>
    ${change}
    <p class="row total"><span>Total</span><span>${escapeHtml(formatUGX(ticket.totalAmount))}</span></p>
  </section>
  <footer>
    <p>Kitchen copy. No handover PIN or customer phone is printed.</p>
    <p>Reprints are recorded in the audit log.</p>
  </footer>
  <script>
    window.addEventListener("load", function () {
      window.print();
    });
  </script>
</body>
</html>`;
}

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = await getAuthorizedProfile(["KITCHEN", "ADMIN"]);
  if (!auth.ok) return plain("Sign in to print dockets.", 401);

  const { orderId } = await params;
  const store = getKitchenStore();

  let ticket: KitchenTicket | null = null;
  try {
    ticket = await store.getTicket(orderId);
  } catch {
    return plain("The kitchen board is unavailable right now.", 503);
  }

  if (!ticket) return plain("That order is not on the kitchen board.", 404);

  try {
    await store.auditReprint(orderId);
  } catch {
    return plain("The print could not be audited, so it was not released.", 503);
  }

  return new Response(docketHtml(ticket), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
