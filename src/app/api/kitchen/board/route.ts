import { NextResponse } from "next/server";

import { getAuthorizedProfile } from "@/lib/auth/guards";
import { loadKitchenBoard } from "@/lib/kitchen/board";

/**
 * Kitchen board polling. Returns the same snapshot as the server render:
 * active tickets only, no phone numbers, handover PINs, or payment references.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthorizedProfile(["KITCHEN", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: { code: auth.code, message: "Sign in again." } },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const board = await loadKitchenBoard();
    return NextResponse.json(
      { ok: true, data: board },
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
          message: "The kitchen board is unavailable right now.",
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
