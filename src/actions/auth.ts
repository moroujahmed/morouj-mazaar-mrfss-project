"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import {
  staffAuthFailure,
  type StaffAuthResult,
  type StaffLogoutResult,
} from "@/lib/auth/action-result";
import {
  createFixtureSessionToken,
  FIXTURE_STAFF_COOKIE,
  FIXTURE_SESSION_HOURS,
  staffFixtureEnabled,
  verifyFixtureSessionToken,
} from "@/lib/auth/fixture-token";
import {
  findFixtureStaffByCredentials,
  toFixtureSession,
} from "@/lib/auth/fixture-staff";
import { normalizePhoneE164, staffEmailForPhone } from "@/lib/auth/phone";
import { getRateLimiter } from "@/lib/routing/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Staff sign-in/out (ADR-001).
 *
 * The visible credential is a phone number and a 6-digit PIN. In production
 * the phone maps to a synthetic address and Supabase Auth issues the JWT. The
 * Playwright suite (`STAFF_FIXTURE=1`) uses a signed, expiring cookie instead
 * so the portals work without a Supabase stack. Both paths share the same
 * rate-limit budget: five failed attempts per phone per fifteen minutes.
 */

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const loginSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  pin: z.string().regex(/^[0-9]{6}$/, "Enter the 6-digit PIN."),
});

async function setFixtureCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: FIXTURE_STAFF_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Playwright serves over http; fixture mode must not require TLS.
    secure: false,
    maxAge: FIXTURE_SESSION_HOURS * 60 * 60,
  });
}

async function enforceLoginLimit(phone: string): Promise<boolean> {
  try {
    const limit = await getRateLimiter().consumeWithLimit(
      `mrfss:rl:staff-login:${phone}`,
      LOGIN_MAX_ATTEMPTS,
      LOGIN_WINDOW_SECONDS,
    );
    return limit.allowed;
  } catch {
    return false;
  }
}

export async function staffLoginAction(
  payload: unknown,
): Promise<StaffAuthResult> {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return staffAuthFailure(
      "VALIDATION_ERROR",
      issue?.message,
      issue?.path.join("."),
    );
  }

  const phone = normalizePhoneE164(parsed.data.phone);
  if (!phone) {
    return staffAuthFailure(
      "VALIDATION_ERROR",
      "Enter a Ugandan mobile number, for example 0700 111 001.",
      "phone",
    );
  }

  if (!(await enforceLoginLimit(phone))) {
    return staffAuthFailure("RATE_LIMITED");
  }

  if (staffFixtureEnabled()) {
    const member = findFixtureStaffByCredentials(phone, parsed.data.pin);
    if (!member) return staffAuthFailure("AUTH_INVALID");

    const token = await createFixtureSessionToken(toFixtureSession(member));
    await setFixtureCookie(token);
    return { ok: true, data: { role: member.role } };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: staffEmailForPhone(phone),
      password: parsed.data.pin,
    });

    if (error || !data.user) {
      return staffAuthFailure("AUTH_INVALID");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      !profile.is_active ||
      profile.role === "CUSTOMER"
    ) {
      await supabase.auth.signOut();
      return staffAuthFailure("ACCOUNT_INACTIVE");
    }

    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);

    return {
      ok: true,
      data: { role: profile.role as "ADMIN" | "KITCHEN" | "RIDER" },
    };
  } catch {
    return staffAuthFailure("AUTH_UNAVAILABLE");
  }
}

export async function staffLogoutAction(): Promise<StaffLogoutResult> {
  try {
    if (staffFixtureEnabled()) {
      const store = await cookies();
      store.delete({ name: FIXTURE_STAFF_COOKIE, path: "/" });
      return { ok: true, data: { success: true } };
    }

    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    return { ok: true, data: { success: true } };
  } catch {
    return staffAuthFailure("AUTH_UNAVAILABLE");
  }
}

/** True when the incoming request already holds a valid fixture session. */
export async function hasFixtureStaffSession(): Promise<boolean> {
  if (!staffFixtureEnabled()) return false;
  const store = await cookies();
  return Boolean(
    await verifyFixtureSessionToken(store.get(FIXTURE_STAFF_COOKIE)?.value),
  );
}
