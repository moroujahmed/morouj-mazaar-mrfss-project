import type { TelemetryPayload } from "./schemas";
import type {
  RiderActiveOrder,
  RiderCashSummary,
  RiderPinResult,
  RiderPoolItem,
  RiderShift,
} from "./types";

export type RiderDeliveryOutcome =
  | "CUSTOMER_UNREACHABLE"
  | "WRONG_ADDRESS"
  | "REFUSED"
  | "OTHER";

export type RiderPinContext = {
  orderId: string;
  pin: string;
  latitude?: number;
  longitude?: number;
  ipHash?: string;
  userAgent?: string;
};

/**
 * Rider store boundary. Production calls only the documented security-definer
 * RPCs as the signed-in rider; the Playwright fixture mirrors the same rules on
 * the shared in-memory order store.
 */
export interface RiderStore {
  listPool(): Promise<RiderPoolItem[]>;
  getActiveOrder(): Promise<RiderActiveOrder | null>;
  getShift(): Promise<RiderShift>;
  getCashSummary(): Promise<RiderCashSummary>;
  claimOrder(orderId: string): Promise<RiderActiveOrder>;
  startDelivery(orderId: string): Promise<RiderActiveOrder>;
  releaseOrder(orderId: string, reason: string): Promise<void>;
  verifyPin(context: RiderPinContext): Promise<RiderPinResult>;
  reportFailed(
    orderId: string,
    outcome: RiderDeliveryOutcome,
    reason: string,
    coordinates?: { latitude?: number; longitude?: number },
  ): Promise<void>;
  updateTelemetry(payload: TelemetryPayload): Promise<void>;
  startShift(openingFloat: number): Promise<RiderShift>;
  endShift(): Promise<RiderShift>;
}
