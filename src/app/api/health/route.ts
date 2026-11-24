import packageJson from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness endpoint for the uptime monitor (`docs/OPERATIONS_RUNBOOK.md` §5.1).
 * It exposes no secrets, database details, or environment information.
 */
export function GET(): Response {
  return Response.json(
    {
      status: "ok",
      time: new Date().toISOString(),
      version: packageJson.version,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
