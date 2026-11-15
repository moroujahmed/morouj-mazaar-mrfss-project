import { describe, expect, it } from "vitest";

import {
  normalizePhoneE164,
  staffEmailForPhone,
} from "@/lib/auth/phone";
import { homeForRole, isStaffRole } from "@/lib/auth/roles";

describe("normalizePhoneE164", () => {
  it("keeps canonical Ugandan E.164 numbers", () => {
    expect(normalizePhoneE164("+256700111000")).toBe("+256700111000");
  });

  it("converts local and international Ugandan forms", () => {
    expect(normalizePhoneE164("0700111000")).toBe("+256700111000");
    expect(normalizePhoneE164("256700111000")).toBe("+256700111000");
    expect(normalizePhoneE164(" 0700 111 000 ")).toBe("+256700111000");
    expect(normalizePhoneE164("+256 700 111 000")).toBe("+256700111000");
  });

  it("accepts other E.164 numbers", () => {
    expect(normalizePhoneE164("+447700900123")).toBe("+447700900123");
  });

  it("rejects junk", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("abc")).toBeNull();
    expect(normalizePhoneE164("12345")).toBeNull();
  });
});

describe("staffEmailForPhone", () => {
  it("builds the synthetic staff address", () => {
    expect(staffEmailForPhone("0700111000", "staff.moroujmazaar.com")).toBe(
      "256700111000@staff.moroujmazaar.com",
    );
  });

  it("rejects an invalid phone instead of inventing an inbox", () => {
    expect(() => staffEmailForPhone("not-a-phone")).toThrow("INVALID_PHONE");
  });
});

describe("roles", () => {
  it("recognizes staff roles only", () => {
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("KITCHEN")).toBe(true);
    expect(isStaffRole("RIDER")).toBe(true);
    expect(isStaffRole("CUSTOMER")).toBe(false);
    expect(isStaffRole("nope")).toBe(false);
  });

  it("maps roles to their portal home", () => {
    expect(homeForRole("ADMIN")).toBe("/admin");
    expect(homeForRole("KITCHEN")).toBe("/kitchen");
    expect(homeForRole("RIDER")).toBe("/rider");
  });
});
