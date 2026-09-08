/**
 * Quick quantity summary for the dashboard cards (SPEC §7.8 preview). These
 * are rounded estimates derived from the framing set and geometry; the full
 * BOM with stock lengths, waste and stagger arrives in M4.
 */
import type { BuildingModel } from "@/lib/model/schema";
import type { FramingSet } from "@/lib/framing/types";
import type { Geometry } from "@/lib/geometry/types";
import { boardFeet, stockLength, type LumberSize } from "@/rules/materials/lumber";

export interface QuickQuantities {
  posts: number;
  /** Lumber board feet at stock lengths (no waste factor). */
  boardFeet: number;
  /** Lumber pieces by nominal size, e.g. { "2x6": 42 }. */
  pieces: Record<string, number>;
  /** Roof steel area, sq ft (plan area of roof planes). */
  roofSqFt: number;
  /** Wall siding area, sq ft (skins, openings subtracted). */
  sidingSqFt: number;
  /** Concrete, cubic yards: slab, pads, aprons, post collars. */
  concreteCuYd: number;
  /** Building floor area, sq ft. */
  floorSqFt: number;
  trussCount: number;
  openings: number;
  zones: number;
}

export function quickQuantities(model: BuildingModel, framing: FramingSet, geometry: Geometry): QuickQuantities {
  const pieces: Record<string, number> = {};
  let bf = 0;
  for (const m of framing.members) {
    if (m.kind === "footing") continue;
    const stock = stockLength(m.lengthFt);
    const nominal = m.nominal as LumberSize;
    pieces[nominal] = (pieces[nominal] ?? 0) + stock.pieces;
    bf += boardFeet(nominal, stock.stockFt * stock.pieces);
  }
  let roofSqFt = 0;
  let sidingSqFt = 0;
  let concreteCuFt = 0;
  for (const b of geometry.boxes) {
    if (b.kind === "roofPlane") roofSqFt += b.size[0] * b.size[2] * (b.size[0] > b.size[2] ? 1 : 1);
    if (b.kind === "wallSkin" || b.kind === "leanToSkin") sidingSqFt += b.size[0] * b.size[1] + (b.kind === "leanToSkin" && b.size[0] < b.size[2] ? b.size[2] * b.size[1] - b.size[0] * b.size[1] : 0);
    if (b.kind === "slab" || b.kind === "apron") concreteCuFt += b.size[0] * b.size[1] * b.size[2];
  }
  for (const p of geometry.polygons) if (p.kind === "gableEnd") sidingSqFt += polygonArea(p.vertices);
  concreteCuFt += framing.posts.reduce((a, p) => a + p.concreteCuFt, 0);
  const floorSqFt = model.footprint.kind === "rect" ? model.footprint.wFt * model.footprint.dFt : 0;
  return {
    posts: framing.posts.length,
    boardFeet: Math.round(bf),
    pieces,
    roofSqFt: Math.round(roofSqFt),
    sidingSqFt: Math.round(sidingSqFt),
    concreteCuYd: Math.round((concreteCuFt / 27) * 10) / 10,
    floorSqFt,
    trussCount: framing.trussSpec?.count ?? 0,
    openings: model.openings.length,
    zones: model.zones.length,
  };
}

/** Area of a planar polygon in 3D (Newell's method). */
function polygonArea(v: [number, number, number][]): number {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return Math.hypot(nx, ny, nz) / 2;
}

/**
 * Design progress checklist for the project panel: what a builder needs
 * before a bid conversation. Each step is derived from the model.
 */
export interface ProgressStep {
  id: string;
  label: string;
  done: boolean;
  hint: string;
}

export function designProgress(model: BuildingModel, errors: number): ProgressStep[] {
  const doors = model.openings.filter((o) => o.type !== "window").length;
  const windows = model.openings.filter((o) => o.type === "window").length;
  return [
    { id: "footprint", label: "Footprint & roof", done: model.footprint.kind === "rect" && model.footprint.wFt >= 8, hint: "Set size, eave and pitch" },
    { id: "frame", label: "Frame system", done: !!model.frame.system, hint: "Post-frame or stick-frame, bay spacing" },
    { id: "doors", label: "Doors", done: doors > 0, hint: "At least one door on an exterior wall" },
    { id: "windows", label: "Windows", done: windows > 0, hint: "Light and ventilation in stalls" },
    { id: "interior", label: "Interior layout", done: model.zones.length > 0, hint: "Pens, aisle, rooms" },
    { id: "site", label: "Site loads verified", done: model.site.verified.frost && model.site.verified.snow, hint: "Frost depth and snow load from your building department" },
    { id: "checks", label: "No blocking checks", done: errors === 0, hint: "Fix errors in the Check panel" },
  ];
}
