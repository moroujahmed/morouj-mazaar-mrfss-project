"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Bike,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DynamicMap } from "@/components/map/dynamic-map";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField, TextareaField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/hooks/use-cart";
import { useCartHydration } from "@/hooks/use-cart-hydration";
import { formatDistanceMetres, formatUGX } from "@/lib/currency";
import { normalizeUgPhone } from "@/lib/phone";
import {
  destinationSchema,
  type Coordinates,
} from "@/lib/routing/coordinates";
import { distanceResponseSchema } from "@/lib/routing/contract";
import {
  buildDeliveryQuote,
  buildOrderTotals,
  minimumOrderValue,
  movRemaining,
  type DeliveryQuote,
  type FulfilmentMode,
} from "@/lib/routing/quote";
import { cartItemCount, cartSubtotal, lineTotal, lineUnitPrice } from "@/lib/storefront/cart";
import { formatStoreTime, type StoreStatus } from "@/lib/storefront/store-status";
import type {
  DineInTable,
  StorefrontMenu,
} from "@/lib/storefront/types";
import { cn } from "@/lib/utils";

export type CheckoutClientProps = {
  menu: StorefrontMenu;
  storeStatus: StoreStatus;
  table: DineInTable | null;
  tableToken: string | null;
};

type DistanceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "out-of-bounds";

type PaymentMethod = "MTN" | "AIRTEL" | "CARD" | "COD";

const PAYMENT_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
  icon: typeof Smartphone;
}> = [
  {
    value: "MTN",
    label: "MTN Mobile Money",
    description: "Approve the prompt on your phone.",
    icon: Smartphone,
  },
  {
    value: "AIRTEL",
    label: "Airtel Money",
    description: "Approve the prompt on your phone.",
    icon: Smartphone,
  },
  {
    value: "CARD",
    label: "Card",
    description: "Visa or Mastercard through the secure checkout.",
    icon: CreditCard,
  },
  {
    value: "COD",
    label: "Cash on delivery",
    description: "Pay the rider when your food arrives.",
    icon: Banknote,
  },
];

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

export function CheckoutClient({
  menu,
  storeStatus,
  table,
  tableToken,
}: CheckoutClientProps) {
  const { settings, items } = menu;
  const { showToast } = useToast();
  const dineIn = table !== null;
  const mode: FulfilmentMode = dineIn ? "dine-in" : "delivery";

  const lines = useCart((state) => state.lines);
  const removeLine = useCart((state) => state.removeLine);

  const hydrated = useCartHydration(items, (result) => {
    if (result.unavailable > 0) {
      showToast({
        title: "Some items are sold out",
        description: "Remove the sold-out lines before placing your order.",
        tone: "error",
      });
    }
  });

  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "error">(
    "idle",
  );
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  const [distanceStatus, setDistanceStatus] =
    useState<DistanceStatus>("idle");
  const [distanceMessage, setDistanceMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [method, setMethod] = useState<PaymentMethod>("MTN");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressDetails, setAddressDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    address: false,
  });

  const subtotal = cartSubtotal(lines);
  const itemCount = cartItemCount(lines);
  const unavailableLines = lines.filter((line) => line.unavailable);
  const overQuantity = lines.find(
    (line) => line.quantity > settings.maxItemQuantity,
  );
  const totals = buildOrderTotals({
    subtotal,
    fee: quote?.fee ?? 0,
    settings,
    mode,
  });
  const remaining = movRemaining(subtotal, settings, mode);
  const minimum = minimumOrderValue(settings, mode);
  const totalReady = dineIn || quote !== null;

  const normalizedPhone = normalizeUgPhone(phone);
  const nameError =
    touched.name && name.trim().length < 2
      ? "Enter the name the rider should ask for."
      : undefined;
  const phoneError =
    touched.phone && normalizedPhone === null
      ? "Enter a Ugandan number, for example 0772 123 456."
      : undefined;
  const addressError =
    !dineIn && touched.address && addressDetails.trim().length < 3
      ? "Add a building, floor, or landmark so the rider can find you."
      : undefined;

  const contactReady =
    name.trim().length >= 2 &&
    normalizedPhone !== null &&
    (dineIn || addressDetails.trim().length >= 3) &&
    notes.length <= 500;

  const lat = destination?.lat ?? null;
  const lng = destination?.lng ?? null;

  useEffect(() => {
    if (dineIn || lat === null || lng === null) {
      setQuote(null);
      setDistanceStatus("idle");
      setDistanceMessage(null);
      return;
    }

    const controller = new AbortController();
    setDistanceStatus("loading");
    setDistanceMessage(null);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
        });
        const response = await fetch(`/api/distance?${params.toString()}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        const parsed = distanceResponseSchema.safeParse(
          await response.json(),
        );
        if (!parsed.success) {
          setQuote(null);
          setDistanceStatus("unavailable");
          setDistanceMessage(
            "We cannot calculate the route right now. Retry in a moment.",
          );
          return;
        }

        if (!parsed.data.success) {
          setQuote(null);
          setDistanceStatus(
            parsed.data.error.code === "DISTANCE_OUT_OF_BOUNDS"
              ? "out-of-bounds"
              : "unavailable",
          );
          setDistanceMessage(parsed.data.error.message);
          return;
        }

        const nextQuote = buildDeliveryQuote(
          parsed.data.data.distanceM,
          parsed.data.data.durationSeconds,
          settings,
        );
        setQuote(nextQuote);
        setDistanceStatus(
          nextQuote.withinDeliveryArea ? "ready" : "out-of-bounds",
        );
      } catch {
        if (controller.signal.aborted) return;
        setQuote(null);
        setDistanceStatus("unavailable");
        setDistanceMessage(
          "We cannot calculate the route right now. Retry in a moment.",
        );
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [dineIn, lat, lng, retryKey, settings]);

  useEffect(() => {
    if (method === "COD" && quote && !quote.codAvailable) {
      setMethod("MTN");
    }
  }, [method, quote]);

  function pickPin(nextLat: number, nextLng: number) {
    const roundedLat = roundCoordinate(nextLat);
    const roundedLng = roundCoordinate(nextLng);
    setDestination({ lat: roundedLat, lng: roundedLng });
    setLatInput(String(roundedLat));
    setLngInput(String(roundedLng));
    setCoordinateError(null);
  }

  function applyCoordinates() {
    const trimmedLat = latInput.trim();
    const trimmedLng = lngInput.trim();
    if (!trimmedLat || !trimmedLng) {
      setCoordinateError("Enter both latitude and longitude.");
      return;
    }

    const parsed = destinationSchema.safeParse({
      lat: Number(trimmedLat),
      lng: Number(trimmedLng),
    });
    if (!parsed.success) {
      setCoordinateError(
        "Enter a latitude between -90 and 90 and a longitude between -180 and 180.",
      );
      return;
    }

    pickPin(parsed.data.lat, parsed.data.lng);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      setGeoMessage(
        "Location is not available on this device. Tap the map or enter coordinates.",
      );
      return;
    }

    setGeoStatus("requesting");
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pickPin(position.coords.latitude, position.coords.longitude);
        setGeoStatus("idle");
        setGeoMessage("Location found. Adjust the pin if it is not exact.");
      },
      (error) => {
        setGeoStatus("error");
        setGeoMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Tap the map or enter coordinates instead."
            : "We could not get your location. Tap the map or enter coordinates instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  const blockers: string[] = [];
  if (!hydrated) {
    blockers.push("Loading your saved cart…");
  } else if (lines.length === 0) {
    blockers.push("Your cart is empty.");
  } else if (unavailableLines.length > 0) {
    blockers.push("Remove the sold-out items before continuing.");
  } else if (!storeStatus.open) {
    blockers.push(
      `We are closed. Orders open at ${formatStoreTime(storeStatus.opensAt)}.`,
    );
  } else if (settings.isKitchenPaused) {
    blockers.push(
      "The kitchen has paused new orders. Please try again in a few minutes.",
    );
  } else if (lines.length > settings.maxCartLines) {
    blockers.push(
      `Your cart can hold at most ${settings.maxCartLines} different lines.`,
    );
  } else if (overQuantity) {
    blockers.push(
      `You can order at most ${settings.maxItemQuantity} of one item.`,
    );
  } else if (subtotal > settings.maxCartValue) {
    blockers.push(
      `Your cart cannot exceed ${formatUGX(settings.maxCartValue)}.`,
    );
  } else if (!dineIn) {
    if (!destination) {
      blockers.push("Choose your delivery pin on the map.");
    } else if (distanceStatus === "loading") {
      blockers.push("Calculating your delivery fee…");
    } else if (distanceStatus === "unavailable") {
      blockers.push(
        "We cannot calculate the route right now. Retry in a moment.",
      );
    } else if (distanceStatus === "out-of-bounds") {
      blockers.push(
        `This address is outside our ${settings.maxDeliveryRadiusKm} km delivery area. Choose another pin or dine in.`,
      );
    } else if (remaining > 0) {
      blockers.push(
        `Add ${formatUGX(remaining)} more to reach the ${formatUGX(minimum)} minimum order.`,
      );
    } else if (method === "COD" && quote && !quote.codAvailable) {
      blockers.push(
        "Cash on delivery is not available for this address. Pay online or choose another pin.",
      );
    }
  } else if (remaining > 0) {
    blockers.push(
      `Add ${formatUGX(remaining)} more to reach the ${formatUGX(minimum)} dine-in minimum.`,
    );
  }

  if (blockers.length === 0 && !contactReady) {
    blockers.push(
      dineIn
        ? "Add your name and phone number to continue."
        : "Add your name, phone number, and delivery details to continue.",
    );
  }

  const blockedReason = blockers[0] ?? null;
  const editHref = dineIn && tableToken
    ? `/?table=${encodeURIComponent(tableToken)}`
    : "/";

  const mapCenter: readonly [number, number] = destination
    ? [destination.lat, destination.lng]
    : [settings.restaurantLat, settings.restaurantLng];
  const mapMarkers = useMemo(
    () => [
      {
        id: "restaurant",
        lat: settings.restaurantLat,
        lng: settings.restaurantLng,
        label: settings.restaurantName,
        kind: "restaurant" as const,
      },
    ],
    [settings.restaurantLat, settings.restaurantLng, settings.restaurantName],
  );

  const mapFallback = destination
    ? quote
      ? `Restaurant to pin: ${formatDistanceMetres(quote.distanceM)} · about ${Math.max(1, Math.ceil(quote.durationSeconds / 60))} min drive.`
      : "Pin set. We are calculating the road distance."
    : `No pin yet. Tap the map or use the latitude and longitude fields. Distances are measured from ${settings.restaurantName}.`;

  if (hydrated && lines.length === 0) {
    return (
      <div className="min-h-dvh bg-surface-inset">
        <CheckoutHeader editHref={editHref} />
        <main
          id="main-content"
          className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6"
        >
          {dineIn ? <DineInBanner table={table} /> : null}
          <EmptyState
            icon={<ShoppingBag className="size-7" />}
            title="Your cart is empty"
            description="Add a dish from the menu before checking out."
            action={
              <Link href={editHref} className={buttonClasses({ size: "lg" })}>
                Browse the menu
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-inset pb-24">
      <CheckoutHeader editHref={editHref} />

      <main
        id="main-content"
        className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div className="flex flex-col gap-6">
          {dineIn ? (
            <DineInBanner table={table} />
          ) : tableToken ? (
            <div
              role="status"
              className="flex flex-col gap-1 rounded-2xl border-2 border-status-warning bg-status-warningSurface p-4 text-status-warning"
            >
              <p className="font-extrabold">This table link is not active</p>
              <p className="text-sm">
                Your order will be treated as delivery. Ask a member of staff
                for a new table QR code if you are dining in.
              </p>
            </div>
          ) : null}

          {!storeStatus.open ? (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-2xl border-2 border-status-warning bg-status-warningSurface p-4 text-status-warning"
            >
              <p className="flex items-center gap-2 font-extrabold">
                <Clock aria-hidden="true" className="size-5" />
                Ordering is closed
              </p>
              <p className="text-sm">
                {storeStatus.reason === "manual"
                  ? "The restaurant has paused new orders. Your cart is saved."
                  : `We reopen at ${formatStoreTime(storeStatus.opensAt)}. Your cart is saved for later.`}
              </p>
            </div>
          ) : null}

          {storeStatus.open && settings.isKitchenPaused ? (
            <div
              role="alert"
              className="flex flex-col gap-1 rounded-2xl border-2 border-status-warning bg-status-warningSurface p-4 text-status-warning"
            >
              <p className="font-extrabold">The kitchen has paused new orders</p>
              <p className="text-sm">
                Your cart is saved. Checkout stays disabled until the kitchen
                resumes.
              </p>
            </div>
          ) : null}

          {!dineIn ? (
            <section
              aria-labelledby="delivery-heading"
              className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-surface p-4 shadow-card sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2
                    id="delivery-heading"
                    className="text-xl font-extrabold text-green-800"
                  >
                    Delivery pin
                  </h2>
                  <p className="text-sm text-ink-secondary">
                    Tap the map or drag the orange pin to your exact delivery
                    spot.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={useMyLocation}
                  isLoading={geoStatus === "requesting"}
                  leadingIcon={<Navigation aria-hidden="true" className="size-4" />}
                >
                  Use my location
                </Button>
              </div>

              <DynamicMap
                center={mapCenter}
                zoom={14}
                markers={mapMarkers}
                destination={
                  destination ? [destination.lat, destination.lng] : null
                }
                onPick={pickPin}
                ariaLabel="Delivery destination map"
                fallback={mapFallback}
                className="h-72"
              />

              {geoMessage ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="flex items-start gap-2 text-sm font-semibold text-ink-secondary"
                >
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {geoMessage}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Latitude"
                  value={latInput}
                  onChange={(event) => {
                    setLatInput(event.target.value);
                    setCoordinateError(null);
                  }}
                  inputMode="decimal"
                  autoComplete="off"
                  hint="Decimal degrees, for example 0.3245"
                />
                <TextField
                  label="Longitude"
                  value={lngInput}
                  onChange={(event) => {
                    setLngInput(event.target.value);
                    setCoordinateError(null);
                  }}
                  inputMode="decimal"
                  autoComplete="off"
                  hint="Decimal degrees, for example 32.5782"
                  error={coordinateError ?? undefined}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="soft" onClick={applyCoordinates}>
                  Use these coordinates
                </Button>
                {destination ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDestination(null);
                      setLatInput("");
                      setLngInput("");
                      setCoordinateError(null);
                      setGeoMessage(null);
                    }}
                  >
                    Clear pin
                  </Button>
                ) : null}
              </div>

              <DistancePanel
                status={distanceStatus}
                message={distanceMessage}
                quote={quote}
                settings={settings}
                onRetry={() => setRetryKey((value) => value + 1)}
              />
            </section>
          ) : null}

          <section
            aria-labelledby="contact-heading"
            className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-surface p-4 shadow-card sm:p-6"
          >
            <div>
              <h2
                id="contact-heading"
                className="text-xl font-extrabold text-green-800"
              >
                {dineIn ? "Your details" : "Contact and delivery details"}
              </h2>
              <p className="text-sm text-ink-secondary">
                We only use these details to prepare and hand over this order.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouched((state) => ({ ...state, name: true }))}
                autoComplete="name"
                required
                error={nameError}
              />
              <TextField
                label="Phone number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                onBlur={() => setTouched((state) => ({ ...state, phone: true }))}
                inputMode="tel"
                autoComplete="tel"
                hint="Ugandan mobile number"
                required
                error={phoneError}
              />
            </div>

            {!dineIn ? (
              <TextField
                label="Building, floor, or landmark"
                value={addressDetails}
                onChange={(event) => setAddressDetails(event.target.value)}
                onBlur={() =>
                  setTouched((state) => ({ ...state, address: true }))
                }
                autoComplete="street-address"
                hint="For example: Nakasero, Plot 12, ground floor"
                required
                error={addressError}
              />
            ) : null}

            <TextareaField
              label="Notes for the kitchen (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              hint={`${notes.length}/500 characters`}
              rows={3}
            />
          </section>

          <section
            aria-labelledby="payment-heading"
            className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-surface p-4 shadow-card sm:p-6"
          >
            <div>
              <h2
                id="payment-heading"
                className="text-xl font-extrabold text-green-800"
              >
                Payment method
              </h2>
              <p className="text-sm text-ink-secondary">
                {dineIn
                  ? "Pay at the table when your order is served."
                  : "Digital payments are confirmed before the kitchen starts. Cash is collected on delivery."}
              </p>
            </div>

            <fieldset className="grid gap-2">
              <legend className="sr-only">Choose a payment method</legend>
              {PAYMENT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const codBlocked =
                  option.value === "COD" &&
                  quote !== null &&
                  !quote.codAvailable;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors",
                      method === option.value
                        ? "border-green-800 bg-green-50"
                        : "border-green-100 bg-surface hover:border-green-700",
                      codBlocked && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={option.value}
                      checked={method === option.value}
                      disabled={codBlocked}
                      onChange={() => setMethod(option.value)}
                      className="mt-1 size-5 shrink-0 accent-green-800"
                    />
                    <Icon
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-green-800"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-green-900">
                        {option.label}
                      </span>
                      <span className="text-sm text-ink-secondary">
                        {codBlocked
                          ? `Unavailable beyond ${settings.codMaxRadiusKm} km. Choose another method.`
                          : option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {method === "COD" && quote ? (
              <p className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
                <Banknote aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Have {formatUGX(totals.total)} ready. The rider may send a
                6-digit code to confirm the handover.
              </p>
            ) : null}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <section
            aria-labelledby="summary-heading"
            className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-surface p-4 shadow-card sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="summary-heading"
                className="text-xl font-extrabold text-green-800"
              >
                Order summary
              </h2>
              <Badge tone="neutral">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </Badge>
            </div>

            <ul className="flex flex-col divide-y divide-green-100">
              {lines.map((line) => {
                const details = [
                  ...line.comboSelections.map((selection) => selection.name),
                  ...line.modifiers.map((modifier) => modifier.name),
                ].join(" · ");
                return (
                  <li key={line.key} className="flex flex-col gap-1 py-3 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-green-900">
                        {line.quantity} × {line.name}
                      </p>
                      <p className="tabular shrink-0 font-mono text-sm font-semibold text-green-900">
                        {formatUGX(lineTotal(line))}
                      </p>
                    </div>
                    {details ? (
                      <p className="text-sm text-ink-secondary">{details}</p>
                    ) : null}
                    <p className="text-sm text-ink-secondary">
                      {formatUGX(lineUnitPrice(line))} each
                    </p>
                    {line.unavailable ? (
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge
                          tone="danger"
                          icon={<AlertTriangle className="size-4" />}
                        >
                          Sold out
                        </Badge>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="inline-flex min-h-touch items-center gap-1 rounded-lg px-2 text-sm font-semibold text-status-danger hover:bg-status-dangerSurface"
                        >
                          <X aria-hidden="true" className="size-4" />
                          Remove
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <dl className="flex flex-col gap-2 border-t border-green-100 pt-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-secondary">Items and modifiers</dt>
                <dd className="tabular font-mono font-semibold text-green-900">
                  {formatUGX(totals.itemsSubtotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-secondary">
                  {dineIn ? "Packaging (dine-in)" : "Packaging"}
                </dt>
                <dd className="tabular font-mono font-semibold text-green-900">
                  {formatUGX(totals.packagingFee)}
                </dd>
              </div>
              {!dineIn ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-secondary">Delivery</dt>
                  <dd className="tabular font-mono font-semibold text-green-900">
                    {distanceStatus === "loading"
                      ? "Calculating…"
                      : quote
                        ? formatUGX(totals.deliveryFee)
                        : "Set your pin"}
                  </dd>
                </div>
              ) : null}
            </dl>

            {!dineIn && quote && quote.fee === 0 ? (
              <Badge tone="success" icon={<CheckCircle2 className="size-4" />}>
                Free delivery · {formatDistanceMetres(quote.distanceM)}
              </Badge>
            ) : null}

            {!dineIn && quote && quote.fee > 0 ? (
              <p className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
                {formatDistanceMetres(quote.distanceM)} total ·{" "}
                {quote.excessKm} billable km beyond the free{" "}
                {settings.freeDeliveryRadiusKm} km ×{" "}
                {formatUGX(settings.ratePerExcessKm)}.
              </p>
            ) : null}

            {remaining > 0 ? (
              <div
                role="status"
                className="flex flex-col gap-1 rounded-xl bg-status-warningSurface p-3 text-sm font-semibold text-status-warning"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle aria-hidden="true" className="size-4" />
                  Below the {formatUGX(minimum)} minimum
                </span>
                <span>
                  Add {formatUGX(remaining)} more to continue.
                </span>
              </div>
            ) : null}

            <div className="flex items-end justify-between gap-2 border-t border-green-100 pt-3">
              <span className="text-base font-semibold text-green-900">
                Total
              </span>
              <span
                aria-live="polite"
                className="tabular font-mono text-2xl font-extrabold text-green-900"
              >
                {totalReady ? formatUGX(totals.total) : "Delivery pending"}
              </span>
            </div>

            <Button
              size="xl"
              fullWidth
              disabled={Boolean(blockedReason)}
              aria-describedby="checkout-status"
              onClick={() =>
                showToast({
                  title: "Order submission is coming next",
                  description:
                    "Your cart and delivery quote are saved on this device. Payment and order confirmation are enabled in the next build step.",
                  tone: "info",
                })
              }
              leadingIcon={<ShieldCheck aria-hidden="true" className="size-5" />}
            >
              {totalReady
                ? `Place order · ${formatUGX(totals.total)}`
                : "Place order"}
            </Button>

            {blockedReason ? (
              <p
                id="checkout-status"
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 rounded-xl bg-status-warningSurface p-3 text-sm font-semibold text-status-warning"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                {blockedReason}
              </p>
            ) : (
              <p id="checkout-status" className="sr-only">
                All checkout details are complete.
              </p>
            )}

            <Link
              href={editHref}
              className={buttonClasses({ variant: "ghost", fullWidth: true })}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Edit cart
            </Link>
          </section>

          <p className="flex items-start gap-2 px-1 text-sm text-ink-secondary">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Prices, fees, and the minimum order are recalculated on the server
            before an order is accepted.
          </p>
        </aside>
      </main>
    </div>
  );
}

function CheckoutHeader({ editHref }: { editHref: string }) {
  return (
    <header className="border-b border-green-100 bg-surface">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href={editHref}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-green-800 underline underline-offset-4 hover:bg-green-50"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to menu
        </Link>
        <p className="text-eyebrow uppercase text-orange-700">Secure checkout</p>
      </div>
    </header>
  );
}

function DineInBanner({ table }: { table: DineInTable | null }) {
  if (!table) return null;
  return (
    <div className="flex flex-col gap-1 rounded-2xl border-2 border-green-800 bg-green-50 p-4 text-green-900">
      <p className="flex items-center gap-2 font-extrabold">
        <UtensilsCrossed aria-hidden="true" className="size-5" />
        Dine-in · Table {table.tableNumber}
      </p>
      <p className="text-sm">
        {table.label}. No delivery or packaging fee, and the delivery minimum
        does not apply.
      </p>
      <p className="text-sm text-ink-secondary">
        Order for collection at your table. Payment is settled when you are
        served.
      </p>
    </div>
  );
}

function DistancePanel({
  status,
  message,
  quote,
  settings,
  onRetry,
}: {
  status: DistanceStatus;
  message: string | null;
  quote: DeliveryQuote | null;
  settings: StorefrontMenu["settings"];
  onRetry: () => void;
}) {
  if (status === "idle") {
    return (
      <p className="rounded-xl bg-surface-inset p-3 text-sm text-ink-secondary">
        Choose a pin to see the road distance, delivery fee, and ETA. We never
        estimate a delivery fee from a straight line.
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl bg-surface-inset p-3 text-sm font-semibold text-ink-secondary"
      >
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Calculating the road distance…
      </p>
    );
  }

  if (status === "unavailable") {
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-xl bg-status-warningSurface p-3 text-sm font-semibold text-status-warning"
      >
        <span className="flex items-start gap-2">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {message ?? "We cannot calculate the route right now. Retry in a moment."}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leadingIcon={<RefreshCw aria-hidden="true" className="size-4" />}
        >
          Retry distance
        </Button>
      </div>
    );
  }

  if (status === "out-of-bounds") {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-xl bg-status-dangerSurface p-3 text-sm font-semibold text-status-danger"
      >
        <Bike aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {message ??
          `This address is outside our ${settings.maxDeliveryRadiusKm} km delivery area. Choose another pin or dine in.`}
      </p>
    );
  }

  if (!quote) {
    return (
      <p className="rounded-xl bg-surface-inset p-3 text-sm text-ink-secondary">
        Waiting for the route.
      </p>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-1 rounded-xl p-3 text-sm font-semibold",
        quote.fee === 0
          ? "bg-green-50 text-green-900"
          : "bg-orange-50 text-green-900",
      )}
    >
      <span className="flex items-center gap-2">
        <Bike aria-hidden="true" className="size-4" />
        {formatDistanceMetres(quote.distanceM)} · about{" "}
        {Math.max(1, Math.ceil(quote.durationSeconds / 60))} min drive
      </span>
      <span>
        {quote.fee === 0
          ? `Free delivery: inside the ${settings.freeDeliveryRadiusKm} km zone.`
          : `Delivery ${formatUGX(quote.fee)}: ${quote.excessKm} billable km beyond the free ${settings.freeDeliveryRadiusKm} km.`}
      </span>
      <span className="font-normal text-ink-secondary">
        {quote.codAvailable
          ? `Cash on delivery available within ${settings.codMaxRadiusKm} km.`
          : `Cash on delivery is unavailable beyond ${settings.codMaxRadiusKm} km.`}
      </span>
    </div>
  );
}
