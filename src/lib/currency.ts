/** Money and distance helpers. Canonical rules live in CANONICAL_EXAMPLES.md. */

export const FREE_DELIVERY_METRES = 5_000;
export const MAX_DELIVERY_METRES = 15_000;

const UGX_FORMATTER = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 0,
});

/** Format an integer UGX amount with the canonical `USh` prefix. */
export function formatUGX(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`UGX amounts must be integers, received ${amount}`);
  }
  return `USh ${UGX_FORMATTER.format(amount)}`;
}

/**
 * Delivery fee in whole UGX.
 * Free at or below 5,000 m; otherwise ceil((metres - 5000) / 1000) * rate.
 */
export function calculateDeliveryFee(
  metres: number,
  ratePerExcessKmUgx: number,
): number {
  if (!Number.isInteger(metres) || metres < 0) {
    throw new Error(`Distance must be a non-negative integer metre value`);
  }
  if (!Number.isInteger(ratePerExcessKmUgx) || ratePerExcessKmUgx < 0) {
    throw new Error(`Rate must be a non-negative integer UGX value`);
  }
  if (metres <= FREE_DELIVERY_METRES) return 0;

  const excessKm = Math.ceil((metres - FREE_DELIVERY_METRES) / 1_000);
  return excessKm * ratePerExcessKmUgx;
}

export function isBeyondMaxDelivery(metres: number): boolean {
  return metres > MAX_DELIVERY_METRES;
}

export function formatDistanceMetres(metres: number): string {
  if (metres < 1_000) return `${metres} m`;
  return `${(metres / 1_000).toFixed(metres % 1_000 === 0 ? 0 : 3)} km`;
}
