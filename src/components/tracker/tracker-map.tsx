"use client";

import { Radio } from "lucide-react";
import { useEffect, useState } from "react";

import { DynamicMap, type MapMarker } from "@/components/map/dynamic-map";
import { formatDistanceMetres } from "@/lib/currency";
import type { TrackerSnapshot } from "@/lib/orders/tracker";

const STALE_AFTER_MS = 2 * 60 * 1_000;

function relativeSeen(
  updatedAt: string | null | undefined,
  now: number | null,
): string {
  if (now === null) return "Position updates while this screen is open.";
  if (!updatedAt) return "Waiting for the rider's first position.";
  const time = new Date(updatedAt).getTime();
  if (Number.isNaN(time)) return "Rider position time is unavailable.";
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  if (minutes < 1) return "Live position updated just now.";
  if (minutes === 1) return "Last seen 1 minute ago.";
  return `Last seen ${minutes} minutes ago.`;
}

export function TrackerMap({ snapshot }: { snapshot: TrackerSnapshot }) {
  // `Date.now()` must not decide the first paint: the server and the hydrating
  // client can straddle a minute or the stale threshold. Render neutral copy
  // until mounted, then recompute on every polled snapshot.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (
    snapshot.status !== "OUT_FOR_DELIVERY" ||
    snapshot.orderType !== "DELIVERY"
  ) {
    return null;
  }

  const riderLat = snapshot.rider?.latitude;
  const riderLng = snapshot.rider?.longitude;
  const destinationLat = snapshot.destinationLatitude;
  const destinationLng = snapshot.destinationLongitude;

  const riderPosition =
    typeof riderLat === "number" && typeof riderLng === "number"
      ? ([riderLat, riderLng] as const)
      : null;
  const destinationPosition =
    typeof destinationLat === "number" && typeof destinationLng === "number"
      ? ([destinationLat, destinationLng] as const)
      : null;

  const center = riderPosition ?? destinationPosition;

  const markers: MapMarker[] = [];
  if (destinationPosition) {
    markers.push({
      id: "destination",
      lat: destinationPosition[0],
      lng: destinationPosition[1],
      label: "Delivery pin",
      kind: "destination",
    });
  }
  if (riderPosition) {
    markers.push({
      id: "rider",
      lat: riderPosition[0],
      lng: riderPosition[1],
      label: "Your rider",
      kind: "rider",
    });
  }

  const updatedAt = snapshot.rider?.updatedAt;
  const now = mounted ? Date.now() : null;
  const stale =
    now !== null &&
    (!updatedAt ||
      Number.isNaN(new Date(updatedAt).getTime()) ||
      now - new Date(updatedAt).getTime() > STALE_AFTER_MS);

  const fallbackParts = [
    snapshot.deliveryArea ?? "Your delivery area",
    snapshot.roadDistanceM != null
      ? formatDistanceMetres(snapshot.roadDistanceM)
      : null,
    snapshot.estimatedTravelMinutes != null
      ? `about ${snapshot.estimatedTravelMinutes} min drive`
      : null,
    relativeSeen(updatedAt, now),
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="map-heading"
      className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-5 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="map-heading" className="text-lg font-extrabold text-green-800">
          Live rider location
        </h2>
        <p
          className={
            stale
              ? "flex items-center gap-1.5 text-sm font-semibold text-status-warning"
              : "flex items-center gap-1.5 text-sm font-semibold text-status-success"
          }
        >
          <Radio aria-hidden="true" className="size-4" />
          {stale ? "Position may be stale" : "Live"}
        </p>
      </div>

      {center ? (
        <DynamicMap
          center={center}
          zoom={14}
          markers={markers}
          ariaLabel="Map showing the rider and delivery pin"
          fallback={fallbackParts.join(" · ")}
          className="min-h-56"
        />
      ) : (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-3 text-sm text-ink-secondary"
        >
          {relativeSeen(updatedAt, now)} Keep this screen open for live
          tracking.
        </p>
      )}

      <p className="text-sm text-ink-secondary">
        {stale
          ? `${relativeSeen(updatedAt, now)} SMS updates continue if the map pauses.`
          : "Keep this screen open for live tracking."}
      </p>
    </section>
  );
}
