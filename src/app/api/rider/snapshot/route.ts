import { NextResponse } from "next/server";

import { getAuthorizedProfile } from "@/lib/auth/guards";
import { loadRiderSnapshot } from "@/lib/rider/snapshot";

/**
 * Rider polling snapshot: safe pool summaries, the rider's own active order,
 * shift state, and cash summary. No PIN, no other rider's customer data.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthorizedProfile(["RIDER"]);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: { code: auth.code, message: "Sign in again." } },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const snapshot = await loadRiderSnapshot(auth.profile.id);
    return NextResponse.json(
      { ok: true, data: snapshot },
      {
        headers: {
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The rider portal is unavailable right now.",
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
