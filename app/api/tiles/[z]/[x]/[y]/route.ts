/**
 * Satellite basemap tiles for the Site step (ADR-0017). With GOOGLE_MAPS_API_KEY
 * set the tiles come from the Google Map Tiles API (satellite) through a
 * server-side session so the key never reaches the browser; otherwise Esri
 * World Imagery, which needs no key. Either way the browser only ever sees
 * /api/tiles/{z}/{x}/{y}.
 */
import { NextResponse } from "next/server";
import { tileProvider } from "../../../provider";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await ctx.params;
  const zi = Number(z);
  const xi = Number(x);
  const yi = Number(y.replace(/\.(png|jpg|jpeg)$/i, ""));
  if (![zi, xi, yi].every(Number.isInteger) || zi < 0 || zi > 23) return new NextResponse("bad tile", { status: 400 });
  try {
    const url = await tileProvider.tileUrl(zi, xi, yi);
    const upstream = await fetch(url, { headers: tileProvider.headers, cache: "no-store" });
    if (!upstream.ok) return new NextResponse("no tile", { status: upstream.status === 404 ? 404 : 502 });
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new NextResponse("tile provider unavailable", { status: 502 });
  }
}
