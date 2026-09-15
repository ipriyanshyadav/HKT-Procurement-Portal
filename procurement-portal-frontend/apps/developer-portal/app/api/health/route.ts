import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Minimal liveness endpoint for Docker HEALTHCHECK and uptime probes.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
