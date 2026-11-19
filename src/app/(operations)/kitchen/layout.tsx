import type { ReactNode } from "react";

/** Bare wrapper for both the login screen and the protected kitchen board. */
export default function KitchenRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="min-h-dvh bg-surface-inset">{children}</div>;
}
