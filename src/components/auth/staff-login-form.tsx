"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { staffLoginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { homeForRole } from "@/lib/auth/roles";

type Portal = "admin" | "kitchen" | "rider";

const PORTAL_LABEL: Record<Portal, string> = {
  admin: "Admin hub",
  kitchen: "Kitchen board",
  rider: "Rider portal",
};

export function StaffLoginForm({
  portal,
  hint,
}: {
  portal: Portal;
  hint?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<{ phone?: string; pin?: string }>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});

    startTransition(async () => {
      const result = await staffLoginAction({ phone, pin });
      if (!result.ok) {
        setError(result.error.message);
        if (result.error.field === "phone") setFields({ phone: result.error.message });
        if (result.error.field === "pin") setFields({ pin: result.error.message });
        return;
      }

      // Read `?next=` in the submit handler rather than with useSearchParams:
      // the login pages stay statically prerenderable and need no Suspense
      // boundary, while the redirect target is still validated below.
      const requested = new URLSearchParams(window.location.search).get("next");
      const safeNext =
        requested &&
        requested.startsWith(`/${portal}/`) &&
        !requested.startsWith("//")
          ? requested
          : null;

      router.replace(safeNext ?? homeForRole(result.data.role));
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-2xl border border-green-100 bg-surface p-6 shadow-card">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-orange-700">
          Staff sign-in
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-green-800">
          {PORTAL_LABEL[portal]}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {hint ??
            "Use the phone number and 6-digit PIN issued to you by the restaurant."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Phone number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          placeholder="0700 111 001"
          value={phone}
          error={fields.phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />

        <TextField
          label="6-digit PIN"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="[0-9]{6}"
          maxLength={6}
          value={pin}
          error={fields.pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))
          }
          required
        />

        {error ? (
          <p role="alert" className="rounded-xl bg-status-dangerSurface p-3 text-sm font-semibold text-status-danger">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={pending}
          leadingIcon={<LogIn aria-hidden="true" className="size-5" />}
        >
          Sign in
        </Button>
      </form>

      <p className="text-sm text-ink-secondary">
        Forgotten your PIN? Ask the restaurant administrator to reset it. Five
        incorrect attempts lock sign-in for 15 minutes.
      </p>

      <div className="border-t border-green-100 pt-4 text-sm text-ink-secondary">
        <p className="mb-2 font-semibold text-green-900">Other staff portals</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {portal !== "kitchen" ? <Link href="/kitchen/login" className="font-medium text-green-800 underline underline-offset-4 hover:text-green-900">Kitchen staff</Link> : null}
          {portal !== "rider" ? <Link href="/rider/login" className="font-medium text-green-800 underline underline-offset-4 hover:text-green-900">Delivery staff</Link> : null}
          {portal !== "admin" ? <Link href="/admin/login" className="font-medium text-green-800 underline underline-offset-4 hover:text-green-900">Manager / Admin</Link> : null}
          <Link href="/" className="font-medium text-green-800 underline underline-offset-4 hover:text-green-900">Back to website</Link>
        </div>
      </div>
    </div>
  );
}
