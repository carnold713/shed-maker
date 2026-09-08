/**
 * Which satellite imagery the Site step shows (ADR-0017).
 *
 * - GOOGLE_MAPS_API_KEY set → Google Map Tiles API, satellite. A session
 *   token is created server-side (POST createSession) and cached until it
 *   expires; tiles are fetched with the key on the server and relayed.
 *   Google's terms want their attribution shown next to the map; the meta
 *   endpoint hands the client the text to show.
 * - Otherwise → Esri World Imagery (free, attribution required, ~zoom 19).
 */

export interface TileMeta {
  provider: "google" | "esri";
  attribution: string;
  maxNativeZoom: number;
}

const key = process.env.GOOGLE_MAPS_API_KEY;

let googleSession: { token: string; expiresAt: number } | null = null;

async function getGoogleSession(): Promise<string> {
  if (googleSession && googleSession.expiresAt > Date.now() + 60_000) return googleSession.token;
  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key!)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapType: "satellite", language: "en-US", region: "US" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`createSession ${res.status}`);
  const data = (await res.json()) as { session: string; expiry: string };
  googleSession = { token: data.session, expiresAt: Number(data.expiry) * 1000 };
  return googleSession.token;
}

export const tileProvider = {
  meta(): TileMeta {
    return key
      ? { provider: "google", attribution: "Imagery ©Google", maxNativeZoom: 21 }
      : { provider: "esri", attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community", maxNativeZoom: 19 };
  },
  headers: { "User-Agent": "BarnDesigner/0.1 (site plan basemap)" },
  async tileUrl(z: number, x: number, y: number): Promise<string> {
    if (key) {
      const session = await getGoogleSession();
      return `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`;
    }
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  },
};
