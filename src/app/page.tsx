import { publicEnv } from "@/lib/public-env";

export default function HomePage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      <p className="rounded-full bg-green-100 px-4 py-1 text-sm font-medium text-green-800">
        Bazaar Flame &amp; Grill
      </p>
      <h1 className="text-balance text-4xl font-bold tracking-tight text-green-800 sm:text-5xl">
        Morouj Mazaar
      </h1>
      <p className="max-w-xl text-pretty text-lg text-ink-secondary">
        The ordering, kitchen display, rider dispatch, and cash reconciliation
        system is being built in phases. The storefront arrives in Phase 4.
      </p>
      <p className="text-sm text-ink-secondary">
        Support WhatsApp:{" "}
        <span className="font-mono">
          {publicEnv.supportWhatsApp || "not configured"}
        </span>
      </p>
    </main>
  );
}
