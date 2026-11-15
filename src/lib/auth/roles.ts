import type { Database } from "@/types/database.types";

export type StaffRole = Exclude<
  Database["public"]["Enums"]["user_role"],
  "CUSTOMER"
>;

export function isStaffRole(role: string): role is StaffRole {
  return role === "ADMIN" || role === "KITCHEN" || role === "RIDER";
}

export function homeForRole(role: StaffRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "KITCHEN":
      return "/kitchen";
    case "RIDER":
      return "/rider";
  }
}
