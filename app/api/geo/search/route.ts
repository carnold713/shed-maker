/**
 * Address → coordinates for the Site step (ADR-0017). Google Geocoding when
 * GOOGLE_MAPS_API_KEY is set, otherwise OpenStreetMap's Nominatim (free;
 * one request a second, a real User-Agent, results © OpenStreetMap
 * contributors). Only ever returns {label, lat, lng} rows.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Hit {
  label: string;
  lat: number;
  lng: number;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ hits: [] as Hit[] });
  const key = process.env.GOOGLE_MAPS_API_KEY;
  try {
    if (key) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`, { cache: "no-store" });
      const data = (await res.json()) as { results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
      const hits: Hit[] = (data.results ?? []).slice(0, 5).map((r) => ({ label: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng }));
      return NextResponse.json({ hits, provider: "google" });
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "BarnDesigner/0.1 (site plan address search)", "Accept-Language": "en" },
      cache: "no-store",
    });
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const hits: Hit[] = (Array.isArray(data) ? data : []).map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
    return NextResponse.json({ hits, provider: "osm" });
  } catch {
    return NextResponse.json({ hits: [] as Hit[], error: "Address lookup is unavailable right now. Paste coordinates instead." }, { status: 200 });
  }
}
