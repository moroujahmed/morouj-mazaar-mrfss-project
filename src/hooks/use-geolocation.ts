"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteTelemetryPoints,
  enqueueTelemetryPoint,
  readTelemetryQueue,
  type QueuedTelemetryPoint,
} from "@/lib/rider/telemetry-queue";

export type GeolocationStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

export type RiderPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  recordedAt: string;
};

export type TelemetrySendResult = "ok" | "retry" | "stale";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

/**
 * Foreground geolocation with an IndexedDB queue and Screen Wake Lock.
 *
 * Capture stops when the delivery ends or this tab is hidden; the queue is
 * flushed oldest-first. A point the server no longer accepts (`stale`) is
 * dropped with the rest of that order's queue, so a finished delivery is never
 * resurrected by an old position.
 */
export function useGeolocation({
  enabled,
  orderId,
  sendPoint,
}: {
  enabled: boolean;
  orderId: string | null;
  sendPoint: (point: QueuedTelemetryPoint) => Promise<TelemetrySendResult>;
}) {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [position, setPosition] = useState<RiderPosition | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const sendRef = useRef(sendPoint);
  sendRef.current = sendPoint;
  const flushing = useRef(false);

  const refreshPending = useCallback(async () => {
    if (!orderId) {
      setPendingCount(0);
      return;
    }
    try {
      setPendingCount((await readTelemetryQueue(orderId)).length);
    } catch {
      setPendingCount(0);
    }
  }, [orderId]);

  const flush = useCallback(async () => {
    if (!orderId || flushing.current || !navigator.onLine) {
      await refreshPending();
      return;
    }

    flushing.current = true;
    try {
      const rows = await readTelemetryQueue(orderId);
      for (const row of rows) {
        const result = await sendRef.current(row);
        if (result === "ok") {
          await deleteTelemetryPoints([row.key]);
          setPendingCount((count) => Math.max(0, count - 1));
          continue;
        }
        if (result === "stale") {
          await deleteTelemetryPoints(rows.map((entry) => entry.key));
          setPendingCount(0);
        }
        break;
      }
    } catch {
      // Keep the points for the next foreground flush.
    } finally {
      flushing.current = false;
      await refreshPending();
    }
  }, [orderId, refreshPending]);

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
    if (!enabled || !orderId) {
      setStatus("idle");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("This device does not expose location. Navigate manually.");
      return;
    }

    let cancelled = false;
    let wakeLock: WakeLockSentinelLike | null = null;
    let watchId: number | null = null;

    const requestWakeLock = async () => {
      const wakeLockApi = (navigator as WakeLockNavigator).wakeLock;
      if (!wakeLockApi) return;
      try {
        wakeLock = await wakeLockApi.request("screen");
        wakeLock.addEventListener("release", () => {
          wakeLock = null;
        });
      } catch {
        // Wake Lock is a convenience; the rider instruction covers the fallback.
      }
    };

    const releaseWakeLock = async () => {
      try {
        await wakeLock?.release();
      } catch {
        // Already released.
      }
      wakeLock = null;
    };

    setStatus("requesting");
    setError(null);

    watchId = navigator.geolocation.watchPosition(
      (fix) => {
        if (cancelled) return;
        const point: RiderPosition = {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
          accuracy: Number.isFinite(fix.coords.accuracy)
            ? fix.coords.accuracy
            : undefined,
          heading:
            fix.coords.heading !== null && Number.isFinite(fix.coords.heading)
              ? fix.coords.heading
              : undefined,
          speed:
            fix.coords.speed !== null && Number.isFinite(fix.coords.speed)
              ? fix.coords.speed
              : undefined,
          recordedAt: new Date(fix.timestamp || Date.now()).toISOString(),
        };

        setPosition(point);
        setStatus("active");

        void enqueueTelemetryPoint(orderId, point)
          .then((count) => {
            if (!cancelled) setPendingCount(count);
            return flush();
          })
          .catch(() => {
            // Storage may be unavailable in private mode; the next fix retries.
          });
      },
      (failure) => {
        if (cancelled) return;
        if (failure.code === failure.PERMISSION_DENIED) {
          setStatus("denied");
          setError(
            "Location permission is off. You can still call and navigate manually; the tracker will show a paused position.",
          );
        } else if (failure.code === failure.POSITION_UNAVAILABLE) {
          setStatus("unavailable");
          setError("Location is unavailable. Move into the open and try again.");
        } else {
          setStatus("error");
          setError("Location timed out. Keep this screen open and try again.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 20_000,
      },
    );

    void requestWakeLock();
    void refreshPending();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void flush();
    }, 15_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        void flush();
      } else {
        void releaseWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void releaseWakeLock();
    };
  }, [enabled, orderId, flush, refreshPending]);

  return {
    status,
    position,
    pendingCount,
    error,
    online,
    flush,
    refreshPending,
  };
}
