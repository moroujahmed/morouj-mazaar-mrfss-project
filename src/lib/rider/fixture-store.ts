import "server-only";

import { randomUUID } from "node:crypto";

import { findFixtureStaffById } from "@/lib/auth/fixture-staff";
import {
  claimFixtureRiderOrder,
  fixtureRiderCashSummary,
  getFixtureRiderActiveOrder,
  listFixtureRiderPool,
  recordFixtureRiderTelemetry,
  releaseFixtureRiderOrder,
  reportFixtureRiderFailure,
  startFixtureRiderDelivery,
  verifyFixtureRiderPin,
} from "@/lib/orders/fixture-store";

import { RiderFailure } from "./errors";
import type { RiderStore } from "./store-types";
import type { RiderShift } from "./types";

type FixtureShift = {
  shiftId: string;
  startedAt: string;
  endedAt: string | null;
  openingFloat: number;
  expectedCash: number | null;
};

type RiderFixtureState = {
  shifts: Map<string, FixtureShift>;
};

type RiderFixtureGlobal = typeof globalThis & {
  __mrfssRider?: RiderFixtureState;
};

function state(): RiderFixtureState {
  const globalStore = globalThis as RiderFixtureGlobal;
  globalStore.__mrfssRider ??= { shifts: new Map() };
  return globalStore.__mrfssRider;
}

export function resetRiderStoreForTests(): void {
  const globalStore = globalThis as RiderFixtureGlobal;
  delete globalStore.__mrfssRider;
}

function openShift(riderId: string): FixtureShift | null {
  const shift = state().shifts.get(riderId);
  return shift && shift.endedAt === null ? shift : null;
}

function toShift(shift: FixtureShift | null): RiderShift {
  if (!shift) {
    return { isOpen: false, shiftId: null, openingFloat: 0 };
  }
  return {
    isOpen: shift.endedAt === null,
    shiftId: shift.shiftId,
    startedAt: shift.startedAt,
    openingFloat: shift.openingFloat,
    expectedCash: shift.expectedCash,
  };
}

/**
 * Playwright-only rider store bound to one rider. It runs on the same
 * process-global order store as checkout and kitchen, so claim/start/PIN/
 * telemetry semantics match the database without a Supabase stack. The rider
 * id is explicit per request, mirroring `auth.uid()` without shared mutable
 * state across concurrent actions.
 */
export function createFixtureRiderStore(riderId: string): RiderStore {
  return {
    async listPool() {
      return listFixtureRiderPool();
    },

    async getActiveOrder() {
      return getFixtureRiderActiveOrder(riderId);
    },

    async getShift() {
      return toShift(openShift(riderId));
    },

    async getCashSummary() {
      return fixtureRiderCashSummary(riderId);
    },

    async claimOrder(orderId) {
      const member = findFixtureStaffById(riderId);
      if (!member) throw new RiderFailure("AUTH_UNAUTHORIZED");
      return claimFixtureRiderOrder(orderId, riderId, member.fullName);
    },

    async startDelivery(orderId) {
      return startFixtureRiderDelivery(orderId, riderId);
    },

    async releaseOrder(orderId, reason) {
      releaseFixtureRiderOrder(orderId, riderId, reason);
    },

    async verifyPin({ orderId, pin, latitude, longitude }) {
      return verifyFixtureRiderPin({
        orderId,
        riderId,
        pin,
        latitude,
        longitude,
      });
    },

    async reportFailed(orderId, outcome, reason) {
      reportFixtureRiderFailure(orderId, riderId, outcome, reason);
    },

    async updateTelemetry(payload) {
      recordFixtureRiderTelemetry({
        orderId: payload.orderId,
        riderId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        recordedAt: new Date().toISOString(),
      });
    },

    async startShift(openingFloat) {
      if (openShift(riderId)) {
        throw new RiderFailure("SHIFT_ALREADY_OPEN");
      }

      const shift: FixtureShift = {
        shiftId: randomUUID(),
        startedAt: new Date().toISOString(),
        endedAt: null,
        openingFloat,
        expectedCash: null,
      };
      state().shifts.set(riderId, shift);
      return toShift(shift);
    },

    async endShift() {
      const shift = openShift(riderId);
      if (!shift) throw new RiderFailure("SHIFT_NOT_OPEN");

      shift.expectedCash = fixtureRiderCashSummary(riderId).outstandingCash;
      shift.endedAt = new Date().toISOString();
      return {
        isOpen: false,
        shiftId: null,
        startedAt: null,
        openingFloat: 0,
        expectedCash: shift.expectedCash,
      };
    },
  };
}
