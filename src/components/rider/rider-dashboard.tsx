"use client";

import {
  AlertTriangle,
  Bike,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  claimOrderAction,
  endShiftAction,
  releaseOrderAction,
  reportDeliveryFailedAction,
  startDeliveryAction,
  startShiftAction,
  verifyPinAction,
} from "@/actions/rider";
import { RiderActiveDelivery } from "@/components/rider/rider-active-delivery";
import { RiderPool } from "@/components/rider/rider-pool";
import { RiderShiftPanel } from "@/components/rider/rider-shift-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextField } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { TelemetrySendResult } from "@/hooks/use-geolocation";
import { formatUGX } from "@/lib/currency";
import { pinLockMessage } from "@/lib/rider/types";
import type { RiderSnapshot, RiderPinResult } from "@/lib/rider/types";

const POLL_MS = 10_000;

const OUTCOMES = [
  { value: "CUSTOMER_UNREACHABLE", label: "Customer unreachable" },
  { value: "WRONG_ADDRESS", label: "Wrong address" },
  { value: "REFUSED", label: "Customer refused the order" },
  { value: "OTHER", label: "Other" },
] as const;

function parseSnapshot(payload: unknown): RiderSnapshot | null {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    return null;
  }
  const data = (payload as { data: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  return data as RiderSnapshot;
}

export function RiderDashboard({
  initialSnapshot,
  riderName,
}: {
  initialSnapshot: RiderSnapshot;
  riderName: string;
}) {
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const snapshotRef = useRef(initialSnapshot);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const [failedOpen, setFailedOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>("CUSTOMER_UNREACHABLE");
  const [failureReason, setFailureReason] = useState("");
  const [failureError, setFailureError] = useState<string | null>(null);

  const [endOpen, setEndOpen] = useState(false);
  const [endBusy, setEndBusy] = useState(false);

  const applySnapshot = useCallback((next: RiderSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    setOnline(true);
  }, []);

  const sync = useCallback(async () => {
    if (snapshotRef.current === undefined) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/rider/snapshot", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) {
        window.location.assign("/rider/login");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = parseSnapshot(await response.json());
      if (!next) throw new Error("INVALID_SNAPSHOT");
      applySnapshot(next);
    } catch {
      setOnline(false);
    } finally {
      setSyncing(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [sync]);

  const sendPoint = useCallback(
    async (point: { latitude: number; longitude: number; recordedAt: string }) => {
      try {
        const response = await fetch("/api/rider/telemetry", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(point),
        });
        if (response.status === 401) {
          window.location.assign("/rider/login");
          return "stale" as TelemetrySendResult;
        }
        if (response.status === 409) return "stale" as TelemetrySendResult;
        return response.ok ? ("ok" as const) : ("retry" as const);
      } catch {
        return "retry" as const;
      }
    },
    [],
  );

  const active = snapshot.active;
  const geo = useGeolocation({
    enabled: active?.status === "OUT_FOR_DELIVERY" && snapshot.shift.isOpen,
    orderId: active?.orderId ?? null,
    sendPoint,
  });

  const runClaim = useCallback(
    async (orderId: string) => {
      setPendingAction("claim");
      const result = await claimOrderAction({ orderId });
      setPendingAction(null);
      if (!result.ok) {
        showToast({
          title: "Delivery not claimed",
          description: result.error.message,
          tone: "error",
        });
        setAnnouncement(result.error.message);
        await sync();
        return;
      }
      snapshotRef.current = { ...snapshotRef.current, active: result.data };
      setSnapshot(snapshotRef.current);
      setAnnouncement(`Order #${result.data.orderNumber} claimed. Collect it at the pass.`);
      showToast({
        title: `Order #${result.data.orderNumber} claimed`,
        description: "Collect the bag from the pass, then tap Start trip.",
        tone: "success",
      });
      await sync();
    },
    [showToast, sync],
  );

  const runStart = useCallback(async () => {
    if (!active) return;
    setPendingAction("start");
    const result = await startDeliveryAction({ orderId: active.orderId });
    setPendingAction(null);
    if (!result.ok) {
      showToast({ title: "Trip not started", description: result.error.message, tone: "error" });
      await sync();
      return;
    }
    snapshotRef.current = { ...snapshotRef.current, active: result.data };
    setSnapshot(snapshotRef.current);
    setAnnouncement("Trip started. Location sharing is on while this screen stays open.");
    showToast({
      title: "Trip started",
      description: "Keep this screen open. Verify the PIN at the customer's door.",
      tone: "success",
    });
    await sync();
  }, [active, showToast, sync]);

  const runStartShift = useCallback(
    async (openingFloat: number) => {
      setPendingAction("shift-start");
      const result = await startShiftAction({ openingFloat });
      setPendingAction(null);
      if (!result.ok) {
        showToast({ title: "Shift not started", description: result.error.message, tone: "error" });
        return;
      }
      snapshotRef.current = { ...snapshotRef.current, shift: result.data };
      setSnapshot(snapshotRef.current);
      setAnnouncement("Shift started. You can claim deliveries now.");
      showToast({ title: "Shift started", description: "You can claim deliveries now.", tone: "success" });
      await sync();
    },
    [showToast, sync],
  );

  const runEndShift = useCallback(async () => {
    setEndBusy(true);
    const result = await endShiftAction();
    setEndBusy(false);
    setEndOpen(false);
    if (!result.ok) {
      showToast({ title: "Shift not ended", description: result.error.message, tone: "error" });
      return;
    }
    snapshotRef.current = {
      ...snapshotRef.current,
      shift: result.data,
      active: null,
    };
    setSnapshot(snapshotRef.current);
    showToast({
      title: "Shift ended",
      description: `Expected cash ${formatUGX(result.data.expectedCash ?? 0)} is waiting for manager settlement.`,
      tone: "success",
    });
    await sync();
  }, [showToast, sync]);

  const runVerifyPin = useCallback(async () => {
    if (!active) return;
    if (!online) {
      setPinError("You are offline. The PIN must be verified online; completion is not queued.");
      return;
    }
    setPinBusy(true);
    setPinError(null);
    const result = await verifyPinAction({
      orderId: active.orderId,
      pin,
      latitude: geo.position?.latitude,
      longitude: geo.position?.longitude,
    });
    setPinBusy(false);

    if (!result.ok) {
      setPinError(result.error.message);
      return;
    }

    const data: RiderPinResult = result.data;
    if (data.ok) {
      setPinOpen(false);
      setPin("");
      snapshotRef.current = { ...snapshotRef.current, active: null };
      setSnapshot(snapshotRef.current);
      setAnnouncement(`Order #${active.orderNumber} delivered.`);
      showToast({
        title: `Order #${active.orderNumber} delivered`,
        description:
          data.changeDue === null || data.changeDue === undefined
            ? "Handover verified. The customer can now leave feedback."
            : `Handover verified. Return ${formatUGX(data.changeDue)} change.`,
        tone: "success",
      });
      await sync();
      return;
    }

    if (data.code === "PIN_LOCKED") {
      setPinError(pinLockMessage(data.lockedUntil));
    } else if (data.code === "TOO_FAR_FROM_DESTINATION") {
      setPinError(
        `You are ${Math.round(data.distanceM ?? 0)} m from the delivery pin. Move within ${data.allowedM ?? 300} m and try again.`,
      );
    } else {
      setPinError(
        `That PIN does not match. ${data.remainingAttempts ?? 0} attempt${data.remainingAttempts === 1 ? "" : "s"} left.`,
      );
    }
    await sync();
  }, [active, geo.position, online, pin, showToast, sync]);

  const runRelease = useCallback(async () => {
    if (!active) return;
    setPendingAction("release");
    const result = await releaseOrderAction({
      orderId: active.orderId,
      reason: releaseReason,
    });
    setPendingAction(null);
    if (!result.ok) {
      setReleaseError(result.error.message);
      return;
    }
    setReleaseOpen(false);
    setReleaseReason("");
    snapshotRef.current = { ...snapshotRef.current, active: null };
    setSnapshot(snapshotRef.current);
    showToast({
      title: "Delivery released",
      description: "The order is back in the pool for another rider.",
      tone: "info",
    });
    await sync();
  }, [active, releaseReason, showToast, sync]);

  const runFailure = useCallback(async () => {
    if (!active) return;
    setPendingAction("failure");
    const result = await reportDeliveryFailedAction({
      orderId: active.orderId,
      outcome,
      reason: failureReason,
      latitude: geo.position?.latitude,
      longitude: geo.position?.longitude,
    });
    setPendingAction(null);
    if (!result.ok) {
      setFailureError(result.error.message);
      return;
    }
    setFailedOpen(false);
    setFailureReason("");
    snapshotRef.current = { ...snapshotRef.current, active: null };
    setSnapshot(snapshotRef.current);
    showToast({
      title: "Failed delivery recorded",
      description: "The manager will review the order and decide the next step.",
      tone: "info",
    });
    await sync();
  }, [active, failureReason, geo.position, outcome, showToast, sync]);

  const totalCash = snapshot.cash.outstandingCash;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-green-800 sm:text-3xl">
            Today&apos;s deliveries
          </h1>
          <p className="text-sm text-ink-secondary">
            {riderName} · one active delivery at a time · cash to hand over{" "}
            {formatUGX(totalCash)}
          </p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          isLoading={syncing}
          onClick={() => void sync()}
          leadingIcon={<RefreshCw aria-hidden="true" className="size-5" />}
        >
          Refresh
        </Button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {!online ? (
        <div
          role="alert"
          data-testid="rider-offline"
          className="flex items-start gap-3 rounded-2xl border border-status-danger bg-status-dangerSurface p-4 text-status-danger"
        >
          <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">No connection</p>
            <p className="text-sm">
              You can read your current delivery, but you cannot claim or mark it
              delivered. Completion always requires an online PIN check.
            </p>
          </div>
        </div>
      ) : null}

      <RiderShiftPanel
        shift={snapshot.shift}
        cash={snapshot.cash}
        hasActive={active !== null}
        pending={pendingAction === "shift-start"}
        onStart={(openingFloat) => void runStartShift(openingFloat)}
        onEnd={() => setEndOpen(true)}
      />

      {active ? (
        <RiderActiveDelivery
          order={active}
          online={online}
          geoStatus={geo.status}
          position={geo.position}
          pendingCount={geo.pendingCount}
          pendingAction={pendingAction}
          onStart={() => void runStart()}
          onOpenPin={() => {
            setPin("");
            setPinError(null);
            setPinOpen(true);
          }}
          onOpenRelease={() => {
            setReleaseReason("");
            setReleaseError(null);
            setReleaseOpen(true);
          }}
          onOpenFailed={() => {
            setOutcome("CUSTOMER_UNREACHABLE");
            setFailureReason("");
            setFailureError(null);
            setFailedOpen(true);
          }}
        />
      ) : (
        <section aria-labelledby="pool-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="pool-heading" className="text-xl font-extrabold text-green-800">
              Available deliveries
            </h2>
            <p className="text-sm text-ink-secondary">
              {snapshot.shift.isOpen
                ? "The pool refreshes every ten seconds. Claim only when you are at the pass."
                : "Start your shift before claiming."}
            </p>
          </div>
          <RiderPool
            pool={snapshot.pool}
            shiftOpen={snapshot.shift.isOpen}
            pendingOrderId={pendingAction === "claim" ? snapshot.pool[0]?.orderId ?? null : null}
            onClaim={(orderId) => void runClaim(orderId)}
          />
          {snapshot.pool.length === 0 ? (
            <EmptyState
              icon={<Bike aria-hidden="true" className="size-6" />}
              title="Nothing waiting right now"
              description="The kitchen will mark delivery orders ready here. Keep the screen open."
            />
          ) : null}
        </section>
      )}

      <Sheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        title="Handover PIN"
        description="Ask the customer for the 4-digit PIN shown in their tracker, then enter it here."
        footer={
          <p className="flex items-start gap-2 text-sm text-ink-secondary">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            The PIN is verified online. A delivery is never marked complete
            offline, and an old PIN cannot be queued for later.
          </p>
        }
      >
        <div className="flex flex-col gap-4">
          {!online ? (
            <p role="alert" className="rounded-xl bg-status-dangerSurface p-3 text-sm font-semibold text-status-danger">
              You are offline. Reconnect before verifying the handover PIN.
            </p>
          ) : null}
          <TextField
            data-testid="rider-pin-input"
            label="Customer handover PIN"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            pattern="[0-9]{4}"
            value={pin}
            error={pinError ?? undefined}
            hint="Four digits. The customer sees this only after the safety-seal instruction."
            onChange={(event) =>
              setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))
            }
          />
          <Button
            data-testid="rider-pin-submit"
            size="xl"
            fullWidth
            disabled={!online || pin.length !== 4}
            isLoading={pinBusy}
            onClick={() => void runVerifyPin()}
          >
            Verify PIN &amp; complete
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        title="Release this delivery?"
        description="The order returns to the pool for another rider. Give a short reason."
      >
        <div className="flex flex-col gap-4">
          <TextField
            label="Reason"
            value={releaseReason}
            error={releaseError ?? undefined}
            hint="At least five characters. The kitchen sees this."
            onChange={(event) => setReleaseReason(event.target.value)}
          />
          <Button
            size="xl"
            fullWidth
            isLoading={pendingAction === "release"}
            onClick={() => void runRelease()}
          >
            Release delivery
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={failedOpen}
        onClose={() => setFailedOpen(false)}
        title="Report failed delivery"
        description="This ends the delivery as failed. The manager will review it."
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="What happened?"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            {OUTCOMES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Reason"
            value={failureReason}
            error={failureError ?? undefined}
            hint="At least five characters. Do not include the handover PIN."
            onChange={(event) => setFailureReason(event.target.value)}
          />
          <Button
            variant="danger"
            size="xl"
            fullWidth
            isLoading={pendingAction === "failure"}
            onClick={() => void runFailure()}
            leadingIcon={<AlertTriangle aria-hidden="true" className="size-5" />}
          >
            Record failed delivery
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="End your shift?"
        description="Hand the expected cash to the manager. Riders cannot settle their own cash."
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-surface-inset p-3 text-sm text-ink">
            Expected cash:{" "}
            <strong className="text-green-900">
              {formatUGX(snapshot.cash.outstandingCash)}
            </strong>
            . The manager&apos;s ledger will show this amount until it is settled.
          </p>
          <Button
            size="xl"
            fullWidth
            isLoading={endBusy}
            onClick={() => void runEndShift()}
          >
            End shift
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
