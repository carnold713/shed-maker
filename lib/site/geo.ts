/**
 * Placing the plan on the earth (ADR-0017). The building's footprint centre
 * sits at `site.lat/lng`; `site.orientationDeg` is how far the plan's +y
 * (north on the drawing) is turned clockwise from true north. Small-area
 * equirectangular maths is plenty for a barn: at 1,000' the error is well
 * under an inch.
 */
import type { BuildingModel } from "@/lib/model/schema";

export interface LatLng {
  lat: number;
  lng: number;
}

const FT_TO_M = 0.3048;
const M_PER_DEG_LAT = 111_320;

export interface SiteFrame {
  origin: LatLng;
  /** Clockwise from north, degrees. */
  orientationDeg: number;
  /** Plan point that sits on `origin` (the footprint centre). */
  centerFt: { x: number; y: number };
}

export function siteFrame(model: BuildingModel): SiteFrame | null {
  const { lat, lng, orientationDeg } = model.site;
  if (lat === undefined || lng === undefined) return null;
  const fp = model.footprint.kind === "rect" ? model.footprint : { wFt: 24, dFt: 36 };
  return { origin: { lat, lng }, orientationDeg, centerFt: { x: fp.wFt / 2, y: fp.dFt / 2 } };
}

/** Plan feet → metres east / north of the origin. */
export function planToEastNorth(frame: SiteFrame, p: { x: number; y: number }): { eastM: number; northM: number } {
  const t = (frame.orientationDeg * Math.PI) / 180;
  const x = (p.x - frame.centerFt.x) * FT_TO_M;
  const y = (p.y - frame.centerFt.y) * FT_TO_M;
  return { eastM: x * Math.cos(t) + y * Math.sin(t), northM: -x * Math.sin(t) + y * Math.cos(t) };
}

export function planToLatLng(frame: SiteFrame, p: { x: number; y: number }): LatLng {
  const { eastM, northM } = planToEastNorth(frame, p);
  const lat = frame.origin.lat + northM / M_PER_DEG_LAT;
  const lng = frame.origin.lng + eastM / (M_PER_DEG_LAT * Math.cos((frame.origin.lat * Math.PI) / 180));
  return { lat, lng };
}

export function latLngToPlan(frame: SiteFrame, ll: LatLng): { x: number; y: number } {
  const northM = (ll.lat - frame.origin.lat) * M_PER_DEG_LAT;
  const eastM = (ll.lng - frame.origin.lng) * M_PER_DEG_LAT * Math.cos((frame.origin.lat * Math.PI) / 180);
  const t = (frame.orientationDeg * Math.PI) / 180;
  const x = eastM * Math.cos(t) - northM * Math.sin(t);
  const y = eastM * Math.sin(t) + northM * Math.cos(t);
  return { x: x / FT_TO_M + frame.centerFt.x, y: y / FT_TO_M + frame.centerFt.y };
}

/** Bearing of a plan direction on the ground, degrees clockwise from north. */
export function planBearingDeg(frame: SiteFrame, dir: { x: number; y: number }): number {
  const t = (frame.orientationDeg * Math.PI) / 180;
  const east = dir.x * Math.cos(t) + dir.y * Math.sin(t);
  const north = -dir.x * Math.sin(t) + dir.y * Math.cos(t);
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

/** Metres per degree of longitude at this latitude. */
export function metresPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function formatLatLng(ll: LatLng): string {
  return `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
}

/** Parse "lat, lng" typed by hand. */
export function parseLatLng(s: string): LatLng | null {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
