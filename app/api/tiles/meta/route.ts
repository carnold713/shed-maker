import { NextResponse } from "next/server";
import { tileProvider } from "../provider";

export const runtime = "nodejs";

/** Which imagery the Site step is showing and the attribution to print beside it. */
export async function GET() {
  return NextResponse.json(tileProvider.meta(), { headers: { "Cache-Control": "public, max-age=300" } });
}
