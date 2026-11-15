import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Morouj Mazaar — Bazaar Flame & Grill",
    template: "%s | Morouj Mazaar",
  },
  description:
    "Order from Bazaar Flame & Grill for delivery, pickup, or dine-in at the food court.",
  applicationName: "Morouj Mazaar",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#173F35",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
