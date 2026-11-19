/**
 * Signed fixture-only staff session.
 *
 * Playwright runs the production server without a Supabase stack, so the
 * kitchen/rider/admin portals cannot mint a real Supabase JWT. This module
 * signs an opaque, expiring cookie with HMAC-SHA256 (Web Crypto, available in
 * both the Node and Edge runtimes) and is selected only when
 * `STAFF_FIXTURE=1`. Production never sets that flag, and the fallback secret
 * is a documented test value, not a credential.
 */

export const FIXTURE_STAFF_COOKIE = "mrfss_staff_fixture";

export const FIXTURE_SESSION_HOURS = 12;

export type FixtureSessionRole = "ADMIN" | "KITCHEN" | "RIDER";

export type FixtureSession = {
  userId: string;
  fullName: string;
  phone: string;
  role: FixtureSessionRole;
  mustChangePin: boolean;
  /** Unix epoch seconds. */
  exp: number;
};

const DEFAULT_SECRET = "mrfss-playwright-staff-fixture-secret";

export function staffFixtureEnabled(): boolean {
  return process.env.STAFF_FIXTURE === "1";
}

function secret(): string {
  return process.env.STAFF_FIXTURE_SECRET || DEFAULT_SECRET;
}

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function signature(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return encode(String.fromCharCode(...new Uint8Array(digest)));
}

export async function createFixtureSessionToken(
  session: Omit<FixtureSession, "exp">,
  now = Date.now(),
): Promise<string> {
  const payload = encode(
    JSON.stringify({
      ...session,
      exp: Math.floor(now / 1_000) + FIXTURE_SESSION_HOURS * 60 * 60,
    } satisfies FixtureSession),
  );
  return `${payload}.${await signature(payload)}`;
}

function isSession(value: unknown): value is FixtureSession {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.fullName === "string" &&
    typeof candidate.phone === "string" &&
    (candidate.role === "ADMIN" ||
      candidate.role === "KITCHEN" ||
      candidate.role === "RIDER") &&
    typeof candidate.mustChangePin === "boolean" &&
    typeof candidate.exp === "number"
  );
}

export async function verifyFixtureSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<FixtureSession | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const provided = token.slice(separator + 1);
  const expected = await signature(payload);
  if (provided.length !== expected.length) return null;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  if (mismatch !== 0) return null;

  const decoded = decode(payload);
  if (!decoded) return null;

  try {
    const parsed: unknown = JSON.parse(decoded);
    if (!isSession(parsed)) return null;
    if (parsed.exp * 1_000 <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}
