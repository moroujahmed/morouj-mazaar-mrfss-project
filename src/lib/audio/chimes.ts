import type { KitchenTicket } from "@/lib/kitchen/types";

/**
 * Kitchen chime.
 *
 * Browsers only allow audio after a user gesture, so the board asks the cook
 * to start their shift and calls `unlock()` from that click. Until a ticket is
 * acknowledged the chime repeats; acknowledging (or bumping) the last waiting
 * ticket stops it. `start()` only runs while unlocked, so no sound is queued or
 * attempted after a reload without the gesture.
 */

type OscillatorLike = {
  type: string;
  frequency: { setValueAtTime: (value: number, at: number) => void };
  connect: (destination: unknown) => void;
  start: (at: number) => void;
  stop: (at: number) => void;
};

type GainLike = {
  gain: {
    setValueAtTime: (value: number, at: number) => void;
    exponentialRampToValueAtTime: (value: number, at: number) => void;
  };
  connect: (destination: unknown) => void;
};

export type AudioContextLike = {
  currentTime: number;
  state: string;
  destination: unknown;
  resume: () => Promise<void>;
  close: () => Promise<void>;
  createOscillator: () => OscillatorLike;
  createGain: () => GainLike;
};

export type KitchenChime = {
  unlock: () => Promise<boolean>;
  isUnlocked: () => boolean;
  start: () => void;
  stop: () => void;
  playOnce: () => void;
  dispose: () => void;
};

export type KitchenChimeOptions = {
  intervalMs?: number;
  createContext?: () => AudioContextLike | null;
};

const REPEAT_MS = 4_000;

function defaultContext(): AudioContextLike | null {
  if (typeof window === "undefined") return null;
  const globalWindow = window as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const Context = globalWindow.AudioContext ?? globalWindow.webkitAudioContext;
  return Context ? new Context() : null;
}

export function createKitchenChime(
  options: KitchenChimeOptions = {},
): KitchenChime {
  const interval = options.intervalMs ?? REPEAT_MS;
  const createContext = options.createContext ?? defaultContext;

  let context: AudioContextLike | null = null;
  let unlocked = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function tone(frequency: number, startAt: number): void {
    if (!context) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const end = startAt + 0.22;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(end + 0.02);
    } catch {
      // Audio must never break the ticket board.
    }
  }

  function playOnce(): void {
    if (!unlocked || !context) return;
    const now = context.currentTime;
    tone(880, now);
    tone(1_174, now + 0.18);
  }

  async function unlock(): Promise<boolean> {
    try {
      if (!context) context = createContext();
      if (!context) return false;
      if (context.state === "suspended") await context.resume();
      unlocked = true;
      // A short confirmation tone proves the shift gesture took effect.
      tone(660, context.currentTime);
      return true;
    } catch {
      return false;
    }
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start(): void {
    if (!unlocked || !context) return;
    // The board re-evaluates this on every poll. Only begin a repetition cycle
    // once, otherwise each poll would add an extra chime on top of the timer.
    if (timer !== null) return;
    playOnce();
    timer = setInterval(playOnce, interval);
  }

  function dispose(): void {
    stop();
    const current = context;
    context = null;
    unlocked = false;
    if (current) void current.close().catch(() => undefined);
  }

  return {
    unlock,
    isUnlocked: () => unlocked,
    start,
    stop,
    playOnce,
    dispose,
  };
}

/** Tickets that still need attention: CONFIRMED_UNPAID without acknowledgement. */
export function unacknowledgedTicketIds(tickets: KitchenTicket[]): string[] {
  return tickets
    .filter((ticket) => ticket.status === "CONFIRMED_UNPAID")
    .filter((ticket) => !ticket.acknowledgedAt)
    .map((ticket) => ticket.orderId);
}

export function shouldChime(tickets: KitchenTicket[]): boolean {
  return unacknowledgedTicketIds(tickets).length > 0;
}
