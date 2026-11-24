import type { Metadata } from "next";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Clock,
  Inbox,
  Package,
  Utensils,
} from "lucide-react";

import { DesignSystemDemos } from "./demos";
import { DynamicMap } from "@/components/map/dynamic-map";
import { SiteFooter } from "@/components/storefront/site-footer";
import {
  Badge,
  Button,
  EmptyState,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextareaField,
  TextField,
} from "@/components/ui";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import {
  canonicalContrastPairs,
  contrastRatio,
  palette,
} from "@/lib/design-tokens";
import { formatUGX } from "@/lib/currency";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "Internal v2 token and component reference for Morouj Mazaar portals.",
  robots: { index: false, follow: false },
};

const swatches = [
  {
    name: "green-800",
    hex: "#173F35",
    role: "Primary brand and dark headers",
    className: "bg-green-800",
    text: "text-white",
  },
  {
    name: "green-900",
    hex: "#102E27",
    role: "Deep text and text on orange",
    className: "bg-green-900",
    text: "text-white",
  },
  {
    name: "orange-500",
    hex: "#F28C28",
    role: "Primary action",
    className: "bg-orange-500",
    text: "text-green-900",
  },
  {
    name: "orange-700",
    hex: "#A65A0F",
    role: "Orange text and links",
    className: "bg-orange-700",
    text: "text-white",
  },
  {
    name: "green-50",
    hex: "#F2F7F5",
    role: "Tinted cards and rows",
    className: "bg-green-50",
    text: "text-green-900",
  },
  {
    name: "surface-inset",
    hex: "#F2F4F3",
    role: "Page canvas",
    className: "bg-surface-inset",
    text: "text-green-900",
  },
  {
    name: "red-600",
    hex: "#C62828",
    role: "Errors and destructive actions",
    className: "bg-status-danger",
    text: "text-white",
  },
  {
    name: "success-700",
    hex: "#17603F",
    role: "Paid and delivered",
    className: "bg-status-success",
    text: "text-white",
  },
  {
    name: "warning-700",
    hex: "#8A4B00",
    role: "Attention states",
    className: "bg-status-warning",
    text: "text-white",
  },
] as const;

export default function DesignSystemPage() {
  return (
    <>
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6"
    >
      <header className="flex flex-col gap-3">
        <p className="text-eyebrow uppercase text-orange-700">Internal reference</p>
        <h1 className="text-4xl font-extrabold text-green-800">
          Design system v2
        </h1>
        <p className="max-w-2xl text-lg text-ink-secondary">
          Green and orange tokens, accessible primitives, and the verification
          evidence used by the four Morouj Mazaar portals. Orange actions always
          use green-900 text.
        </p>
      </header>

      <section aria-labelledby="palette-heading" className="flex flex-col gap-4">
        <h2 id="palette-heading" className="text-2xl font-extrabold">
          Palette
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {swatches.map((swatch) => (
            <li
              key={swatch.name}
              className={`rounded-xl border border-green-100 p-4 ${swatch.className} ${swatch.text}`}
            >
              <p className="font-mono text-sm font-semibold">{swatch.name}</p>
              <p className="font-mono text-sm">{swatch.hex}</p>
              <p className="mt-1 text-sm">{swatch.role}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="buttons-heading" className="flex flex-col gap-4">
        <h2 id="buttons-heading" className="text-2xl font-extrabold">
          Buttons
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Pay {formatUGX(35_000)}</Button>
          <Button variant="dark">Bump ticket</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="danger">Cancel order</Button>
          <Button disabled>Disabled</Button>
          <Button isLoading>Verifying PIN</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Button size="sm" variant="secondary">
            48 px
          </Button>
          <Button size="lg">52 px kitchen</Button>
          <Button size="xl">56 px rider</Button>
        </div>
      </section>

      <section aria-labelledby="badges-heading" className="flex flex-col gap-4">
        <h2 id="badges-heading" className="text-2xl font-extrabold">
          Status badges
        </h2>
        <p className="text-ink-secondary">
          Every status pairs colour with an icon and a word.
        </p>
        <div className="flex flex-wrap gap-3">
          <Badge tone="success" icon={<CheckCircle2 className="size-4" />}>
            Paid online
          </Badge>
          <Badge tone="danger" icon={<AlertTriangle className="size-4" />}>
            Collect {formatUGX(38_000)}
          </Badge>
          <Badge tone="warning" icon={<Clock className="size-4" />}>
            Cooking
          </Badge>
          <Badge tone="neutral" icon={<Package className="size-4" />}>
            Ready for pickup
          </Badge>
          <Badge tone="brand" icon={<Utensils className="size-4" />}>
            Admin
          </Badge>
          <Badge tone="orange" icon={<Bike className="size-4" />}>
            Rider assigned
          </Badge>
        </div>
      </section>

      <section aria-labelledby="forms-heading" className="flex flex-col gap-4">
        <h2 id="forms-heading" className="text-2xl font-extrabold">
          Form controls
        </h2>
        <div className="grid gap-6 rounded-2xl bg-surface p-5 shadow-card sm:grid-cols-2">
          <TextField
            label="Customer phone"
            hint="E.164 format, for example +256700111000."
            placeholder="+2567..."
            inputMode="tel"
            autoComplete="tel"
          />
          <TextField
            label="Delivery area"
            error="Choose an area within 15 km."
            defaultValue="Beyond the radius"
            required
          />
          <SelectField label="Payment method" defaultValue="cod">
            <option value="momo">MTN MoMo</option>
            <option value="airtel">Airtel Money</option>
            <option value="cod">Cash on delivery</option>
          </SelectField>
          <TextareaField
            label="Kitchen note"
            hint="Visible only to kitchen and admin staff."
            placeholder="No chilli, please."
          />
        </div>
      </section>

      <section aria-labelledby="table-heading" className="flex flex-col gap-4">
        <h2 id="table-heading" className="text-2xl font-extrabold">
          Data table
        </h2>
        <Table
          caption="Sample live orders with status, payment and total."
          containerLabel="Sample orders"
        >
          <TableHead>
            <TableRow>
              <TableHeaderCell>Order</TableHeaderCell>
              <TableHeaderCell>Area</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Total</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono font-semibold">#1042</TableCell>
              <TableCell>Nakasero · 1.562 km</TableCell>
              <TableCell>
                <Badge tone="brand" icon={<Package className="size-4" />}>
                  Claimed
                </Badge>
              </TableCell>
              <TableCell className="font-mono">{formatUGX(35_000)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono font-semibold">#1045</TableCell>
              <TableCell>Ntinda · 8.093 km</TableCell>
              <TableCell>
                <Badge tone="warning" icon={<Clock className="size-4" />}>
                  Preparing
                </Badge>
              </TableCell>
              <TableCell className="font-mono">{formatUGX(38_000)}</TableCell>
            </TableRow>
            <TableEmpty colSpan={4}>
              Older orders appear after the current pipeline.
            </TableEmpty>
          </TableBody>
        </Table>
      </section>

      <section aria-labelledby="states-heading" className="flex flex-col gap-4">
        <h2 id="states-heading" className="text-2xl font-extrabold">
          Empty, loading, and overlay states
        </h2>
        <EmptyState
          icon={<Inbox className="size-7" />}
          title="No orders yet"
          description="New delivery and dine-in orders appear here as soon as payment is confirmed."
          action={<Button variant="secondary">Refresh orders</Button>}
        />
        <div className="grid gap-6 rounded-2xl bg-surface p-5 shadow-card sm:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold text-green-900">Text skeleton</p>
            <SkeletonText lines={3} />
          </div>
          <div>
            <p className="mb-2 font-semibold text-green-900">Card skeleton</p>
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
        <DesignSystemDemos />
      </section>

      <section aria-labelledby="map-heading" className="flex flex-col gap-4">
        <h2 id="map-heading" className="text-2xl font-extrabold">
          Map with text fallback
        </h2>
        <div className="h-72 overflow-hidden rounded-2xl bg-surface p-4 shadow-card">
          <DynamicMap
            center={[0.3136, 32.5811]}
            zoom={13}
            ariaLabel="Map showing the restaurant and the active delivery"
            fallback="Restaurant: Bazaar Flame & Grill, Kampala. Active delivery: Nakasero, 1.562 km, ETA 12 minutes."
            markers={[
              {
                id: "restaurant",
                lat: 0.3136,
                lng: 32.5811,
                label: "Bazaar Flame & Grill",
                kind: "restaurant",
              },
              {
                id: "destination",
                lat: 0.315,
                lng: 32.582,
                label: "Nakasero delivery",
                kind: "destination",
              },
              {
                id: "rider",
                lat: 0.314,
                lng: 32.5815,
                label: "Rider Juma",
                kind: "rider",
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="contrast-heading" className="flex flex-col gap-4">
        <h2 id="contrast-heading" className="text-2xl font-extrabold">
          Contrast evidence
        </h2>
        <p className="text-ink-secondary">
          Measured with the WCAG 2.x relative-luminance formula. The forbidden
          white-on-orange pair stays below the 4.5:1 AA floor.
        </p>
        <Table
          caption="Canonical foreground and background contrast pairs with measured ratios."
          containerLabel="Contrast pairs"
        >
          <TableHead>
            <TableRow>
              <TableHeaderCell>Pair</TableHeaderCell>
              <TableHeaderCell>Ratio</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {canonicalContrastPairs.map((pair) => {
              const ratio = contrastRatio(
                palette[pair.foreground],
                palette[pair.background],
              );
              return (
                <TableRow key={pair.label}>
                  <TableCell>{pair.label}</TableCell>
                  <TableCell className="font-mono">
                    {ratio.toFixed(2)}:1
                  </TableCell>
                  <TableCell>
                    {pair.forbidden ? (
                      <Badge
                        tone="danger"
                        icon={<AlertTriangle className="size-4" />}
                      >
                        Forbidden
                      </Badge>
                    ) : (
                      <Badge
                        tone="success"
                        icon={<CheckCircle2 className="size-4" />}
                      >
                        {pair.minRatio >= 7 ? "AA / AAA" : "AA"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

    </main>
    <SiteFooter />
    </>
  );
}
