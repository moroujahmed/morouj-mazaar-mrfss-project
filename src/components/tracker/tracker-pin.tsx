import { ShieldCheck } from "lucide-react";

/**
 * The PIN card always renders the safety-seal instruction before the digits.
 * Screen readers therefore reach the instruction first, and the PIN disappears
 * as soon as the order reaches a terminal state.
 */
export function TrackerPin({
  pin,
  active,
}: {
  pin: string | null;
  active: boolean;
}) {
  if (!pin || !active) return null;

  return (
    <section
      aria-labelledby="handover-heading"
      className="flex flex-col gap-2 rounded-xl border-2 border-green-800 bg-green-50 p-4"
    >
      <h2
        id="handover-heading"
        className="flex items-center gap-2 text-sm font-semibold text-green-800"
      >
        <ShieldCheck aria-hidden="true" className="size-4" />
        Handover PIN
      </h2>
      <div
        className="flex flex-col gap-1 rounded-lg bg-surface p-3"
        data-testid="safety-seal"
      >
        <p className="text-sm font-semibold text-green-900">
          Check the safety seal first.
        </p>
        <p className="text-sm text-ink-secondary">
          Make sure the bag is sealed and the seal number matches your docket.
          Only share the PIN after you have received the food.
        </p>
      </div>
      <p
        className="tabular font-mono text-3xl font-extrabold tracking-[0.3em] text-green-900"
        data-testid="handover-pin"
      >
        {pin}
      </p>
      <p className="text-sm text-ink-secondary">
        Give this PIN to the rider only when you receive your order.
      </p>
    </section>
  );
}
