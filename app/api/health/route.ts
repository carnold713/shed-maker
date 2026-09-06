import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { isClerkConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Railway healthcheck. Reports DB connectivity when configured. */
export async function GET() {
  let db: "ok" | "error" | "none" = "none";
  if (hasDatabase()) {
    try {
      const { prisma } = await import("@/lib/db");
      await prisma.$queryRaw`SELECT 1`;
      db = "ok";
    } catch {
      db = "error";
    }
  }
  const ok = db !== "error";
  return NextResponse.json(
    { ok, db, auth: isClerkConfigured() ? "clerk" : "dev", time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
