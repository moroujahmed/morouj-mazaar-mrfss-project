import { redirect } from "next/navigation";

import {
  getStaffSession,
  homeForRole,
  type StaffProfile,
  type StaffRole,
} from "@/lib/auth/session";

export type AuthFailure = {
  ok: false;
  code: "AUTH_UNAUTHORIZED" | "ACCOUNT_INACTIVE";
};

export type AuthSuccess = { ok: true; profile: StaffProfile };

/**
 * Non-redirecting guard for Server Actions and route handlers.
 * Callers map the failure into the documented API envelope.
 */
export async function getAuthorizedProfile(
  allowed: readonly StaffRole[],
): Promise<AuthSuccess | AuthFailure> {
  const session = await getStaffSession();
  if (!session) return { ok: false, code: "AUTH_UNAUTHORIZED" };
  if (!session.profile.is_active) return { ok: false, code: "ACCOUNT_INACTIVE" };
  if (!allowed.includes(session.profile.role as StaffRole)) {
    return { ok: false, code: "AUTH_UNAUTHORIZED" };
  }
  return { ok: true, profile: session.profile };
}

/**
 * Page guard. Unauthenticated users go to the portal login; authenticated
 * users with the wrong role go to their own portal.
 */
export async function requirePageRole(
  allowed: readonly StaffRole[],
  loginPath: string,
): Promise<StaffProfile> {
  const session = await getStaffSession();

  if (!session) redirect(loginPath);
  if (!session.profile.is_active) redirect(loginPath);
  if (!allowed.includes(session.profile.role as StaffRole)) {
    redirect(homeForRole(session.profile.role as StaffRole));
  }

  return session.profile;
}
