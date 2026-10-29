#!/usr/bin/env node
/**
 * Provision staff Supabase Auth users and profiles.
 *
 * Usage:
 *   node scripts/seed-staff.mjs
 *   STAFF_SEED_FILE=scripts/staff.local.json node scripts/seed-staff.mjs
 *
 * Required environment:
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   STAFF_EMAIL_DOMAIN (default: staff.bazaareats.com)
 *   STAFF_RESET_PASSWORDS=true (default: false; only set for deliberate rotation)
 *
 * Security:
 *   - The service-role key is never written to disk or logged.
 *   - Staff PINs are sent only to Supabase Auth as passwords.
 *   - Never commit a real staff file. Use scripts/staff.example.json as a template.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const EMAIL_DOMAIN = process.env.STAFF_EMAIL_DOMAIN || "staff.bazaareats.com";
const SEED_FILE = resolve(process.env.STAFF_SEED_FILE || "scripts/staff.example.json");
const RESET_PASSWORDS = process.env.STAFF_RESET_PASSWORDS === "true";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!/^[a-z0-9.-]+$/i.test(EMAIL_DOMAIN)) {
  console.error("STAFF_EMAIL_DOMAIN is not a valid domain.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

function fail(message, details) {
  console.error(`ERROR: ${message}`);
  if (details) console.error(details);
  process.exitCode = 1;
}

function digits(phone) {
  return phone.replace(/\D/g, "");
}

function syntheticEmail(phone) {
  return `${digits(phone)}@${EMAIL_DOMAIN}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function listUsers() {
  const { response, body } = await request("/auth/v1/admin/users?page=1&per_page=1000");
  if (!response.ok) {
    throw new Error(`Could not list auth users: ${response.status} ${JSON.stringify(body)}`);
  }
  return body?.users || [];
}

async function createUser(staff, email) {
  const { response, body } = await request("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: staff.pin,
      email_confirm: true,
      user_metadata: {
        full_name: staff.full_name,
        role: staff.role,
      },
      app_metadata: {
        role: staff.role,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not create ${email}: ${response.status} ${JSON.stringify(body)}`);
  }
  return body?.user || body;
}

async function updateUser(userId, staff, email) {
  const body = {
    email_confirm: true,
    user_metadata: {
      full_name: staff.full_name,
      role: staff.role,
    },
    app_metadata: {
      role: staff.role,
    },
  };
  if (RESET_PASSWORDS) body.password = staff.pin;

  const { response, body: result } = await request(`/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Could not update ${email}: ${response.status} ${JSON.stringify(result)}`);
  }
  return result?.user || result;
}

async function upsertProfile(userId, staff) {
  const { response, body } = await request("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id: userId,
      full_name: staff.full_name,
      phone_number: staff.phone,
      role: staff.role,
      motorcycle_plate: staff.motorcycle_plate ?? null,
      is_active: staff.is_active !== false,
      must_change_pin: staff.must_change_pin !== false,
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not upsert profile for ${staff.phone}: ${response.status} ${JSON.stringify(body)}`);
  }
}

function validateStaff(staff, index) {
  const label = `staff[${index}]`;
  if (!staff || typeof staff !== "object") throw new Error(`${label} must be an object`);
  if (!staff.full_name || String(staff.full_name).trim().length < 2) {
    throw new Error(`${label}.full_name is required`);
  }
  if (!/^\+256[0-9]{9}$/.test(staff.phone || "")) {
    throw new Error(`${label}.phone must be E.164 Uganda format, e.g. +256700111000`);
  }
  if (!/^[0-9]{6}$/.test(String(staff.pin || ""))) {
    throw new Error(`${label}.pin must be exactly 6 digits`);
  }
  if (!["ADMIN", "KITCHEN", "RIDER"].includes(staff.role)) {
    throw new Error(`${label}.role must be ADMIN, KITCHEN, or RIDER`);
  }
  if (staff.role === "RIDER" && !staff.motorcycle_plate) {
    throw new Error(`${label}.motorcycle_plate is required for RIDER`);
  }
}

async function main() {
  const raw = await readFile(SEED_FILE, "utf8");
  const staffList = JSON.parse(raw);
  if (!Array.isArray(staffList) || staffList.length === 0) {
    throw new Error("Staff seed file must contain a non-empty array.");
  }
  staffList.forEach(validateStaff);

  const users = await listUsers();
  const byEmail = new Map(users.map((user) => [String(user.email || "").toLowerCase(), user]));

  for (const staff of staffList) {
    const email = syntheticEmail(staff.phone).toLowerCase();
    let user = byEmail.get(email);

    if (!user) {
      user = await createUser(staff, email);
      console.log(`created  ${staff.role.padEnd(7)} ${staff.full_name} <${email}>`);
    } else {
      user = await updateUser(user.id, staff, email);
      console.log(`updated  ${staff.role.padEnd(7)} ${staff.full_name} <${email}>${RESET_PASSWORDS ? " (password reset)" : ""}`);
    }

    if (!user?.id) {
      throw new Error(`Auth API did not return a user id for ${email}`);
    }

    await upsertProfile(user.id, staff);
    console.log(`profile  ${staff.role.padEnd(7)} ${staff.phone}`);
  }

  console.log("\nStaff provisioning complete.");
  if (!RESET_PASSWORDS) {
    console.log("Existing passwords were left unchanged. Set STAFF_RESET_PASSWORDS=true only for deliberate rotation.");
  }
}

main().catch((error) => fail(error.message, error.stack));
