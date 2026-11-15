"use client";

import L, { type LayerGroup, type Map as LeafletMapInstance } from "leaflet";
import { useEffect, useRef } from "react";

import { publicEnv } from "@/lib/public-env";
import { cn } from "@/lib/utils";

export type MapMarkerKind = "restaurant" | "destination" | "rider";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind?: MapMarkerKind;
};

export type LeafletMapProps = {
  center: readonly [number, number];
  zoom?: number;
  markers?: readonly MapMarker[];
  className?: string;
  /** Accessible name for the map region. */
  ariaLabel: string;
  /** Visible text fallback with area, distance and ETA. */
  fallback?: string;
};

const markerColour: Record<MapMarkerKind, string> = {
  restaurant: "#173F35",
  destination: "#A65A0F",
  rider: "#F28C28",
};

/**
 * Leaflet is client-only. The parent wrapper loads this module with
 * `ssr: false`, and every screen also renders the text fallback below the map.
 * Tile requests fail closed to the styled well when no MapTiler key exists.
 */
export function LeafletMap({
  center,
  zoom = 14,
  markers = [],
  className,
  ariaLabel,
  fallback,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [center[0], center[1]],
      zoom,
      zoomControl: true,
      attributionControl: Boolean(publicEnv.maptilerKey),
    });

    if (publicEnv.maptilerKey) {
      L.tileLayer(
        `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${publicEnv.maptilerKey}`,
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      ).addTo(map);
    }

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
    // The map is created once; centre/zoom updates are handled by the effect below.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center[0], center[1]], zoom);
  }, [center, zoom]);

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const marker of markers) {
      const colour = markerColour[marker.kind ?? "destination"];
      const circle = L.circleMarker([marker.lat, marker.lng], {
        radius: marker.kind === "rider" ? 11 : 9,
        weight: marker.kind === "rider" ? 4 : 2,
        color: "#FFFFFF",
        fillColor: colour,
        fillOpacity: 1,
      });

      // Build the tooltip node directly so customer text is never parsed as HTML.
      circle.bindTooltip(() => {
        const node = document.createElement("span");
        node.textContent = marker.label;
        return node;
      });

      circle.addTo(layer);
    }
  }, [markers]);

  return (
    <figure className={cn("m-0 flex flex-col gap-2", className)}>
      <div
        ref={containerRef}
        role="region"
        aria-label={ariaLabel}
        className="h-full min-h-56 w-full rounded-xl bg-green-100"
      />
      {fallback ? (
        <figcaption className="text-sm text-ink-secondary">{fallback}</figcaption>
      ) : null}
    </figure>
  );
}
