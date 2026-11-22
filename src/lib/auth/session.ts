import { cookies } from "next/headers";

import {
  FIXTURE_STAFF_COOKIE,
  staffFixtureEnabled,
  verifyFixtureSessionToken,
} from "@/lib/auth/fixture-token";
import { findFixtureStaffById } from "@/lib/auth/fixture-staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type { StaffRole } from "@/lib/auth/roles";
export { homeForRole, isStaffRole } from "@/lib/auth/roles";

export type StaffProfile = Pick<
  ProfileRow,
  | "id"
  | "full_name"
  | "phone_number"
  | "role"
  | "is_active"
  | "must_change_pin"
  | "motorcycle_plate"
>;

export type StaffSession = {
  userId: string;
  profile: StaffProfile;
};

const PROFILE_COLUMNS =
  "id, full_name, phone_number, role, is_active, must_change_pin, motorcycle_plate";

/** Read the authenticated staff member and their profile, or null. */
export async function getStaffSession(): Promise<StaffSession | null> {
  // Test-only portal session; production always uses Supabase Auth.
  if (staffFixtureEnabled()) {
    const store = await cookies();
    const session = await verifyFixtureSessionToken(
      store.get(FIXTURE_STAFF_COOKIE)?.value,
    );
    if (!session) return null;

    return {
      userId: session.userId,
      profile: {
        id: session.userId,
        full_name: session.fullName,
        phone_number: session.phone,
        role: session.role,
        is_active: true,
        must_change_pin: session.mustChangePin,
        motorcycle_plate:
          findFixtureStaffById(session.userId)?.motorcyclePlate ?? null,
      },
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return { userId: user.id, profile };
}
