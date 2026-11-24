import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { GET } from "@/app/api/health/route";

describe("health endpoint", () => {
  it("returns status, an ISO timestamp, and the app version", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["status", "time", "version"]);
    expect(body.status).toBe("ok");
    expect(body.version).toBe(packageJson.version);
    expect(Number.isNaN(Date.parse(String(body.time)))).toBe(false);
  });

  it("exposes no secrets or database details", async () => {
    const body = (await (await GET()).json()) as Record<string, unknown>;
    const serialized = JSON.stringify(body).toLowerCase();

    for (const forbidden of [
      "supabase",
      "service_role",
      "secret",
      "password",
      "postgres",
      "flutterwave",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
