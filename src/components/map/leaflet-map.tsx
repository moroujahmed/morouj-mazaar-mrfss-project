"use client";

import L, {
  type LayerGroup,
  type Map as LeafletMapInstance,
  type Marker,
} from "leaflet";
import { useEffect, useId, useRef } from "react";

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
  /**
   * Called when the customer taps the map or releases the destination pin.
   * The coordinate fields below the map provide the keyboard-accessible path.
   */
  onPick?: (lat: number, lng: number) => void;
  /** Draggable destination pin. Requires `onPick`. */
  destination?: readonly [number, number] | null;
};

const markerColour: Record<MapMarkerKind, string> = {
  restaurant: "#173F35",
  destination: "#A65A0F",
  rider: "#F28C28",
};

function destinationIcon(): L.DivIcon {
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  dot.style.cssText = [
    "display:block",
    "width:24px",
    "height:24px",
    "border-radius:9999px",
    "background:#A65A0F",
    "border:3px solid #FFFFFF",
    "box-shadow:0 1px 5px rgba(0,0,0,0.45)",
  ].join(";");

  return L.divIcon({
    className: "mrfss-destination-pin",
    html: dot,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/**
 * Leaflet is client-only. The parent wrapper loads this module with
 * `ssr: false`, and every screen also renders the text fallback below the map.
 * MapTiler requires a restricted key; development falls back to OSM tiles.
 */
export function LeafletMap({
  center,
  zoom = 14,
  markers = [],
  className,
  ariaLabel,
  fallback,
  onPick,
  destination,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const fallbackId = useId();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [center[0], center[1]],
      zoom,
      zoomControl: true,
      attributionControl: true,
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
    } else if (process.env.NODE_ENV !== "production") {
      // Development and local browser tests only. Production uses MapTiler;
      // OSM's public tile service must never carry production traffic.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
    }

    map.on("click", (event: L.LeafletMouseEvent) => {
      pickRef.current?.(event.latlng.lat, event.latlng.lng);
    });

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      destinationMarkerRef.current = null;
    };
    // The map is created once; centre/zoom updates are handled by the effect below.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center[0], center[1]], zoom);
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!destination) {
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      return;
    }

    if (!destinationMarkerRef.current) {
      const marker = L.marker([destination[0], destination[1]], {
        icon: destinationIcon(),
        draggable: true,
        keyboard: false,
        alt: "Delivery destination pin",
        title: "Delivery destination",
      }).addTo(map);

      marker.bindTooltip("Delivery destination");
      marker.on("dragend", () => {
        const point = marker.getLatLng();
        pickRef.current?.(point.lat, point.lng);
      });
      destinationMarkerRef.current = marker;
      return;
    }

    destinationMarkerRef.current.setLatLng([destination[0], destination[1]]);
  }, [destination]);

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
        aria-describedby={fallback ? fallbackId : undefined}
        className="h-full min-h-56 w-full rounded-xl bg-green-100"
      />
      {fallback ? (
        <figcaption id={fallbackId} className="text-sm text-ink-secondary">
          {fallback}
        </figcaption>
      ) : null}
    </figure>
  );
}
