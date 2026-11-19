"use client";

import {
  AlertTriangle,
  Box,
  Clock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Timer,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  acceptOrderAction,
  bumpOrderAction,
  setBusyModeAction,
  setItemAvailabilityAction,
  setKitchenPausedAction,
} from "@/actions/kitchen";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  createKitchenChime,
  shouldChime,
  unacknowledgedTicketIds,
  type KitchenChime,
} from "@/lib/audio/chimes";
import { formatUGX } from "@/lib/currency";
import {
  kitchenBoardSchema,
  type KitchenBoard,
  type KitchenMenuItem,
  type KitchenTicket,
} from "@/lib/kitchen/types";
import { cn } from "@/lib/utils";

import { KitchenTicketCard, LATE_AFTER_MINUTES } from "./kitchen-ticket-card";

const POLL_MS = 10_000;
const CLOCK_MS = 30_000;
const BUSY_BUFFERS = [0, 10, 20, 30, 45, 60] as const;

type Filter = "all" | "delivery" | "dine-in";

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: "all", label: "All tickets" },
  { id: "delivery", label: "Delivery" },
  { id: "dine-in", label: "Dine-in" },
];

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kampala",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kampala",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function errorMessage(error: { message: string }): string {
  return error.message;
}

function ticketMinutes(ticket: KitchenTicket, reference: number): number {
  const placed = new Date(ticket.createdAt).getTime();
  if (Number.isNaN(placed)) return 0;
  return Math.max(0, Math.floor((reference - placed) / 60_000));
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-green-100 bg-surface p-4 shadow-card">
      <p className="text-sm font-semibold text-ink-secondary">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-green-800">{value}</p>
      <p className="text-xs text-ink-secondary">{detail}</p>
    </div>
  );
}

export function KitchenBoardClient({
  initialBoard,
}: {
  initialBoard: KitchenBoard;
}) {
  const { showToast } = useToast();

  const [board, setBoard] = useState<KitchenBoard>(initialBoard);
  const boardRef = useRef<KitchenBoard>(initialBoard);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<{
    orderId: string;
    action: "accept" | "bump";
  } | null>(null);
  const [settingsPending, setSettingsPending] = useState<
    "busy" | "pause" | null
  >(null);
  const [stockPendingId, setStockPendingId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [shiftStarted, setShiftStarted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const chimeRef = useRef<KitchenChime | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  const applyBoard = useCallback((next: KitchenBoard) => {
    const previousWaiting = new Set(
      unacknowledgedTicketIds(boardRef.current.tickets),
    );
    const added = unacknowledgedTicketIds(next.tickets).filter(
      (orderId) => !previousWaiting.has(orderId),
    );

    if (added.length > 0) {
      const numbers = next.tickets
        .filter((ticket) => added.includes(ticket.orderId))
        .map((ticket) => `#${ticket.orderNumber}`);
      setAnnouncement(
        `${
          added.length === 1
            ? "New order waiting for the kitchen"
            : `${added.length} new orders waiting for the kitchen`
        }: ${numbers.join(", ")}.`,
      );
    }

    boardRef.current = next;
    setBoard(next);
    setOnline(true);
    setLastSyncedAt(Date.now());
  }, []);

  const patchBoard = useCallback(
    (update: (current: KitchenBoard) => KitchenBoard) => {
      const next = update(boardRef.current);
      boardRef.current = next;
      setBoard(next);
    },
    [],
  );

  const sync = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);

    try {
      const response = await fetch("/api/kitchen/board", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });

      if (response.status === 401) {
        window.location.assign("/kitchen/login");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload: unknown = await response.json();
      const data =
        typeof payload === "object" && payload !== null && "data" in payload
          ? (payload as { data: unknown }).data
          : undefined;
      const parsed = kitchenBoardSchema.safeParse(data);
      if (!parsed.success) throw new Error("INVALID_BOARD");

      if (mounted.current) applyBoard(parsed.data);
    } catch {
      if (mounted.current) setOnline(false);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSyncing(false);
    }
  }, [applyBoard]);

  useEffect(() => {
    mounted.current = true;
    setNow(Date.now());

    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    chimeRef.current = createKitchenChime();
    return () => {
      chimeRef.current?.dispose();
      chimeRef.current = null;
    };
  }, []);

  // Poll every ten seconds while the tab is visible, and refresh immediately
  // when the connection or the tab returns. Polling is the fallback regardless
  // of Realtime availability, so the board never goes stale silently.
  useEffect(() => {
    let timer: number | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") void sync();
      }, POLL_MS);
    };
    const stop = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void sync();
        start();
      } else {
        stop();
      }
    };
    const onOffline = () => setOnline(false);
    const onOnline = () => void sync();

    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [sync]);

  // The chime repeats until every waiting ticket is acknowledged. `start()` is
  // idempotent, so a poll carrying the same waiting tickets does not replay it.
  useEffect(() => {
    const chime = chimeRef.current;
    if (!chime || !audioReady) return;

    if (shouldChime(board.tickets)) chime.start();
    else chime.stop();
  }, [board.tickets, audioReady]);

  const startShift = useCallback(async () => {
    const chime = chimeRef.current;
    const unlocked = chime ? await chime.unlock() : false;

    setShiftStarted(true);
    setAudioReady(unlocked);
    setAnnouncement(
      unlocked
        ? "Shift started. New-order chime is on."
        : "Shift started. Audio is unavailable on this device; the board still updates.",
    );

    if (!unlocked) {
      showToast({
        title: "Shift started",
        description:
          "Audio is unavailable on this device, so the new-order chime stays off.",
        tone: "info",
      });
    }
  }, [showToast]);

  const accept = useCallback(
    async (ticket: KitchenTicket) => {
      setPending({ orderId: ticket.orderId, action: "accept" });
      const result = await acceptOrderAction({ orderId: ticket.orderId });
      setPending(null);

      if (!result.ok) {
        showToast({
          title: `Order #${ticket.orderNumber} was not accepted`,
          description: errorMessage(result.error),
          tone: "error",
        });
        void sync();
        return;
      }

      patchBoard((current) => ({
        ...current,
        tickets: current.tickets.map((entry) =>
          entry.orderId === ticket.orderId
            ? {
                ...entry,
                status: "PREPARING" as const,
                acknowledgedAt:
                  entry.acknowledgedAt ?? new Date().toISOString(),
              }
            : entry,
        ),
      }));
      showToast({
        title: `Order #${ticket.orderNumber} accepted`,
        description: "Cooking started and the chime has stopped for this ticket.",
        tone: "success",
      });
      void sync();
    },
    [patchBoard, showToast, sync],
  );

  const bump = useCallback(
    async (ticket: KitchenTicket) => {
      setPending({ orderId: ticket.orderId, action: "bump" });
      const result = await bumpOrderAction({ orderId: ticket.orderId });
      setPending(null);

      if (!result.ok) {
        showToast({
          title: `Order #${ticket.orderNumber} was not bumped`,
          description: errorMessage(result.error),
          tone: "error",
        });
        void sync();
        return;
      }

      const status = result.data.status;
      patchBoard((current) => ({
        ...current,
        tickets:
          status === "DELIVERED"
            ? current.tickets.filter(
                (entry) => entry.orderId !== ticket.orderId,
              )
            : current.tickets.map((entry) =>
                entry.orderId === ticket.orderId
                  ? {
                      ...entry,
                      status: "READY_FOR_PICKUP" as const,
                      readyAt: entry.readyAt ?? new Date().toISOString(),
                    }
                  : entry,
              ),
      }));

      showToast({
        title:
          status === "DELIVERED"
            ? `Order #${ticket.orderNumber} served`
            : `Order #${ticket.orderNumber} ready for pickup`,
        description:
          status === "DELIVERED"
            ? "The dine-in ticket has left the board."
            : "A rider can now collect it at the pass.",
        tone: "success",
      });
      void sync();
    },
    [patchBoard, showToast, sync],
  );

  const printTicket = useCallback(
    (ticket: KitchenTicket) => {
      const opened = window.open(
        `/api/print/receipt/${ticket.orderId}`,
        "_blank",
      );
      if (!opened) {
        showToast({
          title: "Allow pop-ups to print dockets",
          description:
            "The browser blocked the print window. Allow pop-ups for this site and try again.",
          tone: "error",
        });
      }
    },
    [showToast],
  );

  const toggleBusy = useCallback(async () => {
    const current = boardRef.current.settings;
    const nextBusy = !current.isKitchenBusy;

    setSettingsPending("busy");
    patchBoard((boardState) => ({
      ...boardState,
      settings: { ...boardState.settings, isKitchenBusy: nextBusy },
    }));

    const result = await setBusyModeAction({
      busy: nextBusy,
      bufferMinutes: current.busyBufferMinutes,
    });
    setSettingsPending(null);

    if (!result.ok) {
      patchBoard((boardState) => ({
        ...boardState,
        settings: {
          ...boardState.settings,
          isKitchenBusy: current.isKitchenBusy,
        },
      }));
      showToast({
        title: "Busy mode was not changed",
        description: errorMessage(result.error),
        tone: "error",
      });
      return;
    }

    showToast({
      title: nextBusy ? "Busy mode on" : "Busy mode off",
      description: nextBusy
        ? `New orders receive ${current.busyBufferMinutes} extra minutes. Existing tickets keep their promised times.`
        : "New orders use the normal estimate.",
      tone: nextBusy ? "info" : "success",
    });
  }, [patchBoard, showToast]);

  const changeBuffer = useCallback(
    async (bufferMinutes: number) => {
      const current = boardRef.current.settings;

      setSettingsPending("busy");
      patchBoard((boardState) => ({
        ...boardState,
        settings: { ...boardState.settings, busyBufferMinutes: bufferMinutes },
      }));

      const result = await setBusyModeAction({
        busy: current.isKitchenBusy,
        bufferMinutes,
      });
      setSettingsPending(null);

      if (!result.ok) {
        patchBoard((boardState) => ({
          ...boardState,
          settings: {
            ...boardState.settings,
            busyBufferMinutes: current.busyBufferMinutes,
          },
        }));
        showToast({
          title: "The busy buffer was not changed",
          description: errorMessage(result.error),
          tone: "error",
        });
        return;
      }

      showToast({
        title: `Busy buffer set to ${bufferMinutes} min`,
        description: current.isKitchenBusy
          ? "New orders use the updated buffer."
          : "The buffer applies the next time busy mode is on.",
        tone: "success",
      });
    },
    [patchBoard, showToast],
  );

  const togglePaused = useCallback(async () => {
    const current = boardRef.current.settings;
    const nextPaused = !current.isKitchenPaused;

    setSettingsPending("pause");
    patchBoard((boardState) => ({
      ...boardState,
      settings: { ...boardState.settings, isKitchenPaused: nextPaused },
    }));

    const result = await setKitchenPausedAction({ paused: nextPaused });
    setSettingsPending(null);

    if (!result.ok) {
      patchBoard((boardState) => ({
        ...boardState,
        settings: {
          ...boardState.settings,
          isKitchenPaused: current.isKitchenPaused,
        },
      }));
      showToast({
        title: "Intake was not changed",
        description: errorMessage(result.error),
        tone: "error",
      });
      return;
    }

    showToast({
      title: nextPaused ? "New orders paused" : "New orders resumed",
      description: nextPaused
        ? "Checkout is closed for new orders. Existing tickets are unaffected."
        : "Customers can place new orders again.",
      tone: nextPaused ? "info" : "success",
    });
  }, [patchBoard, showToast]);

  const toggleItem = useCallback(
    async (item: KitchenMenuItem, soldOut: boolean) => {
      setStockPendingId(item.id);
      patchBoard((boardState) => ({
        ...boardState,
        items: boardState.items.map((entry) =>
          entry.id === item.id
            ? { ...entry, isAvailable: !soldOut }
            : entry,
        ),
      }));

      const result = await setItemAvailabilityAction({
        itemId: item.id,
        available: !soldOut,
      });
      setStockPendingId(null);

      if (!result.ok) {
        patchBoard((boardState) => ({
          ...boardState,
          items: boardState.items.map((entry) =>
            entry.id === item.id
              ? { ...entry, isAvailable: item.isAvailable }
              : entry,
          ),
        }));
        showToast({
          title: `${item.name} was not changed`,
          description: errorMessage(result.error),
          tone: "error",
        });
        return;
      }

      showToast({
        title: soldOut
          ? `${item.name} marked sold out`
          : `${item.name} is available again`,
        description: soldOut
          ? "The storefront hides it immediately; existing tickets keep their items."
          : "The storefront shows it again straight away.",
        tone: soldOut ? "info" : "success",
      });
    },
    [patchBoard, showToast],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, KitchenMenuItem[]>();
    for (const item of board.items) {
      const list = groups.get(item.categoryName);
      if (list) list.push(item);
      else groups.set(item.categoryName, [item]);
    }
    return [...groups.entries()];
  }, [board.items]);

  const filteredTickets = useMemo(() => {
    const sorted = [...board.tickets].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
    if (filter === "delivery") {
      return sorted.filter((ticket) => ticket.orderType === "DELIVERY");
    }
    if (filter === "dine-in") {
      return sorted.filter((ticket) => ticket.orderType === "DINE_IN");
    }
    return sorted;
  }, [board.tickets, filter]);

  const reference = now ?? Date.parse(board.fetchedAt);
  const oldestMinutes = board.tickets.reduce(
    (oldest, ticket) => Math.max(oldest, ticketMinutes(ticket, reference)),
    0,
  );
  const lateCount = board.tickets.filter(
    (ticket) =>
      ticket.status !== "READY_FOR_PICKUP" &&
      ticketMinutes(ticket, reference) > LATE_AFTER_MINUTES,
  ).length;
  const waitingCount = unacknowledgedTicketIds(board.tickets).length;
  const codDue = board.tickets.reduce(
    (sum, ticket) =>
      ticket.paymentMethod === "CASH_ON_DELIVERY" &&
      ticket.paymentStatus !== "PAID"
        ? sum + ticket.totalAmount
        : sum,
    0,
  );
  const soldOutCount = board.items.filter((item) => !item.isAvailable).length;
  const lastUpdate = lastSyncedAt ?? Date.parse(board.fetchedAt);
  const busyBusy = settingsPending === "busy";
  const pauseBusy = settingsPending === "pause";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-green-800 sm:text-3xl">
            Kitchen board
          </h1>
          <p className="text-sm text-ink-secondary">
            {dateFormat.format(new Date(reference))} · Kampala, EAT · Oldest
            ticket first
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="shift-status"
            className={cn(
              "inline-flex min-h-touch items-center gap-1.5 rounded-xl px-3 text-sm font-semibold",
              audioReady
                ? "bg-status-successSurface text-status-success"
                : "bg-status-warningSurface text-status-warning",
            )}
          >
            {audioReady ? (
              <Volume2 aria-hidden="true" className="size-4" />
            ) : (
              <VolumeX aria-hidden="true" className="size-4" />
            )}
            <span>
              {audioReady
                ? "Chime on — rings until accepted"
                : shiftStarted
                  ? "Chime off — audio unavailable"
                  : "Chime off — start your shift"}
            </span>
          </span>

          <Button
            data-testid="busy-toggle"
            variant={board.settings.isKitchenBusy ? "dark" : "secondary"}
            size="md"
            aria-pressed={board.settings.isKitchenBusy}
            isLoading={busyBusy}
            onClick={() => void toggleBusy()}
            leadingIcon={<Clock aria-hidden="true" className="size-4" />}
          >
            {board.settings.isKitchenBusy ? "Busy mode: on" : "Busy mode: off"}
          </Button>

          <label className="flex items-center gap-2 text-sm font-semibold text-green-800">
            <span className="sr-only">Busy buffer in minutes</span>
            <select
              data-testid="busy-buffer"
              aria-label="Busy buffer in minutes"
              value={board.settings.busyBufferMinutes}
              disabled={busyBusy}
              onChange={(event) =>
                void changeBuffer(Number(event.target.value))
              }
              className="min-h-touch rounded-xl border-2 border-green-800 bg-surface px-3 text-base font-semibold text-green-800"
            >
              {BUSY_BUFFERS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  +{minutes} min
                </option>
              ))}
            </select>
          </label>

          <Button
            data-testid="pause-toggle"
            variant={board.settings.isKitchenPaused ? "danger" : "secondary"}
            size="md"
            aria-pressed={board.settings.isKitchenPaused}
            isLoading={pauseBusy}
            onClick={() => void togglePaused()}
            leadingIcon={
              board.settings.isKitchenPaused ? (
                <PlayCircle aria-hidden="true" className="size-4" />
              ) : (
                <PauseCircle aria-hidden="true" className="size-4" />
              )
            }
          >
            {board.settings.isKitchenPaused
              ? "Resume new orders"
              : "Pause new orders"}
          </Button>

          <Button
            data-testid="open-stock"
            variant="secondary"
            size="md"
            onClick={() => setStockOpen(true)}
            leadingIcon={<Box aria-hidden="true" className="size-4" />}
          >
            86&apos;d items
            <span
              data-testid="stock-count"
              className="ml-1 rounded-full bg-surface-inset px-2 py-0.5 text-xs font-bold text-green-800"
            >
              {soldOutCount}
            </span>
          </Button>

          <Button
            data-testid="refresh-board"
            variant="secondary"
            size="md"
            isLoading={syncing}
            onClick={() => void sync()}
            leadingIcon={<RefreshCw aria-hidden="true" className="size-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {!shiftStarted ? (
        <section
          aria-labelledby="shift-heading"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-500 bg-status-warningSurface p-4"
        >
          <div>
            <h2
              id="shift-heading"
              className="text-base font-extrabold text-green-800"
            >
              Start your shift
            </h2>
            <p className="text-sm text-ink-secondary">
              Tap once to allow the new-order chime on this device. The board
              keeps updating with or without sound.
            </p>
          </div>
          <Button
            data-testid="shift-start"
            size="lg"
            onClick={() => void startShift()}
            leadingIcon={<Volume2 aria-hidden="true" className="size-5" />}
          >
            Start shift &amp; enable chime
          </Button>
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        {!online ? (
          <div
            role="alert"
            data-testid="offline-banner"
            className="flex items-start gap-3 rounded-2xl border border-status-danger bg-status-dangerSurface p-4 text-status-danger"
          >
            <WifiOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">Kitchen board offline</p>
              <p className="text-sm">
                Do not accept or bump tickets until the connection returns. The
                last confirmed queue stays visible.
              </p>
            </div>
          </div>
        ) : null}

        {board.settings.isKitchenBusy ? (
          <div
            role="status"
            data-testid="busy-banner"
            className="flex items-start gap-3 rounded-2xl border border-orange-500 bg-status-warningSurface p-4 text-status-warning"
          >
            <Timer aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">Busy mode is on</p>
              <p className="text-sm">
                New orders receive {board.settings.busyBufferMinutes} extra
                minutes. Existing tickets keep their promised times.
              </p>
            </div>
          </div>
        ) : null}

        {board.settings.isKitchenPaused ? (
          <div
            role="status"
            data-testid="paused-banner"
            className="flex items-start gap-3 rounded-2xl border border-status-danger bg-status-dangerSurface p-4 text-status-danger"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />
            <div>
              <p className="font-bold">New orders are paused</p>
              <p className="text-sm">
                Checkout is closed for new orders. Existing tickets keep their
                normal flow.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <section
        aria-label="Kitchen summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Stat
          label="Open tickets"
          value={String(board.tickets.length)}
          detail={
            waitingCount > 0
              ? `${waitingCount} waiting to accept`
              : "Nothing waiting to accept"
          }
        />
        <Stat
          label="Oldest ticket"
          value={`${oldestMinutes} min`}
          detail={`Target under ${LATE_AFTER_MINUTES} min`}
        />
        <Stat
          label="Late tickets"
          value={String(lateCount)}
          detail={lateCount > 0 ? "Escalate to the pass" : "All on time"}
        />
        <Stat
          label="COD due"
          value={formatUGX(codDue)}
          detail="Collect on handover"
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter tickets"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                "min-h-touch rounded-xl border-2 px-4 text-base font-semibold",
                filter === option.id
                  ? "border-green-800 bg-green-800 text-white"
                  : "border-green-800 bg-surface text-green-800 hover:bg-green-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p
          data-testid="board-updated"
          className="flex items-center gap-1.5 text-sm text-ink-secondary"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("size-4", syncing && "animate-spin")}
          />
          <span>
            {syncing
              ? "Refreshing…"
              : `Updated ${timeFormat.format(new Date(lastUpdate))} · polls every 10 seconds`}
          </span>
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div
        data-testid="kitchen-board"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {filteredTickets.length === 0 ? (
          <EmptyState
            className="md:col-span-2 xl:col-span-3"
            icon={<Clock aria-hidden="true" className="size-6" />}
            title={
              board.tickets.length === 0
                ? "No open tickets"
                : "No tickets match this filter"
            }
            description={
              board.tickets.length === 0
                ? "New orders appear here oldest-first. Keep this screen open; it refreshes every ten seconds."
                : "Choose another ticket type to see the rest of the queue."
            }
          />
        ) : (
          filteredTickets.map((ticket) => (
            <KitchenTicketCard
              key={ticket.orderId}
              ticket={ticket}
              now={now}
              pending={pending?.orderId === ticket.orderId ? pending.action : null}
              busy={pending !== null}
              onAccept={(selected) => void accept(selected)}
              onBump={(selected) => void bump(selected)}
              onPrint={printTicket}
            />
          ))
        )}
      </div>

      <Sheet
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        title="86'd items"
        description="Toggle an item when the kitchen runs out. The storefront hides it immediately."
        footer={
          <p className="text-sm text-ink-secondary">
            Every stock change is audited in production. Existing orders keep
            the items they were placed with.
          </p>
        }
      >
        <div data-testid="stock-sheet" className="flex flex-col gap-5">
          {groupedItems.map(([categoryName, items]) => {
            const headingId = `stock-category-${categoryName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`;
            return (
              <section
                key={categoryName}
                aria-labelledby={headingId}
                className="flex flex-col gap-2"
              >
                <h3
                  id={headingId}
                  className="text-sm font-bold uppercase tracking-wide text-ink-secondary"
                >
                  {categoryName}
                </h3>
                <ul className="flex flex-col divide-y divide-green-50">
                  {items.map((item) => {
                    const nameId = `stock-name-${item.id}`;
                    const stateId = `stock-state-${item.id}`;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="min-w-0">
                          <span
                            id={nameId}
                            className="block font-semibold text-green-900"
                          >
                            {item.name}
                          </span>
                          <span
                            id={stateId}
                            className="block text-sm text-ink-secondary"
                          >
                            {item.isAvailable
                              ? "Available"
                              : "Sold out — hidden on the storefront"}
                          </span>
                        </span>
                        <label className="inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-green-200 px-3">
                          <input
                            type="checkbox"
                            role="switch"
                            aria-labelledby={nameId}
                            aria-describedby={stateId}
                            checked={!item.isAvailable}
                            disabled={stockPendingId === item.id}
                            onChange={(event) =>
                              void toggleItem(item, event.target.checked)
                            }
                            className="size-5 accent-green-800"
                          />
                          <span className="text-sm font-semibold text-green-800">
                            Sold out
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
