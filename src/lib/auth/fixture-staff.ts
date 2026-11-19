import "server-only";

import { normalizePhoneE164 } from "./phone";
import type { FixtureSession, FixtureSessionRole } from "./fixture-token";

/**
 * Canonical fixture staff directory. It mirrors `scripts/staff.example.json`:
 * the same synthetic email is derived from the phone at runtime, but these
 * users exist only while `STAFF_FIXTURE=1` and never touch Supabase Auth.
 */
export type FixtureStaffMember = {
  userId: string;
  fullName: string;
  phone: string;
  pin: string;
  role: FixtureSessionRole;
  mustChangePin: boolean;
};

const STAFF: readonly FixtureStaffMember[] = [
  {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
    fullName: "Admin Kasule",
    phone: "+256700111000",
    pin: "246810",
    role: "ADMIN",
    mustChangePin: false,
  },
  {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
    fullName: "Chef Musa",
    phone: "+256700111001",
    pin: "135790",
    role: "KITCHEN",
    mustChangePin: false,
  },
  {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03",
    fullName: "Rider Juma",
    phone: "+256700111002",
    pin: "112233",
    role: "RIDER",
    mustChangePin: false,
  },
  {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04",
    fullName: "Rider David",
    phone: "+256700111003",
    pin: "445566",
    role: "RIDER",
    mustChangePin: false,
  },
];

export function listFixtureStaff(): readonly FixtureStaffMember[] {
  return STAFF;
}

export function findFixtureStaffByCredentials(
  phone: string,
  pin: string,
): FixtureStaffMember | null {
  const normalized = normalizePhoneE164(phone);
  if (!normalized) return null;
  return (
    STAFF.find(
      (member) => member.phone === normalized && member.pin === pin,
    ) ?? null
  );
}

export function toFixtureSession(member: FixtureStaffMember): Omit<
  FixtureSession,
  "exp"
> {
  return {
    userId: member.userId,
    fullName: member.fullName,
    phone: member.phone,
    role: member.role,
    mustChangePin: member.mustChangePin,
  };
}
