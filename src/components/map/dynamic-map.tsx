"use client";

import "leaflet/dist/leaflet.css";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { LeafletMapProps } from "./leaflet-map";

export type { LeafletMapProps, MapMarker, MapMarkerKind } from "./leaflet-map";

/**
 * Browser-only map entry point. Leaflet touches `window` at import time, so
 * the implementation is loaded with `ssr: false` while the layout keeps a
 * stable skeleton height during hydration.
 */
const LeafletMap = dynamic(
  () => import("./leaflet-map").then((module) => module.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div role="status" className="h-full min-h-56 w-full">
        <span className="sr-only">Loading map</span>
        <Skeleton className="h-full min-h-56 w-full rounded-xl" />
      </div>
    ),
  },
);

export function DynamicMap(props: LeafletMapProps) {
  return <LeafletMap {...props} />;
}
