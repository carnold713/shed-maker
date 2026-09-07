/**
 * Layout pattern generators (SPEC §23). Each produces a complete, valid
 * interior from (species, options) and grows the envelope to fit.
 */
import type { BuildingModel, Species } from "./schema";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { addZone, growToFitZones, type Rect } from "./zones";
import { syncExteriorWalls } from "./walls";

export type LayoutPattern = "centerAisle" | "shedRow" | "clear";

export interface LayoutOptions {
  species?: Species;
  /** Stall size along the ridge (bay direction), feet; defaults to the species minimum (walls off the post grid are flagged, not prevented). */
  stallFt?: number;
  /** Stall depth perpendicular to the ridge, feet; defaults to species minimum. */
  depthFt?: number;
  aisleFt?: number;
  /** Reserve this many bays at the start (south/west) for support rooms. */
  supportBays?: number;
}

function clearZones(model: BuildingModel): BuildingModel {
  return { ...model, zones: [] };
}

/**
 * Centre-aisle: stalls both sides of an aisle running along the ridge, one
 * stall per bay. Width becomes 2 × depth + aisle; length stays on the bay
 * module. Optionally the first bays on one side become tack + feed rooms.
 */
export function applyCenterAisle(model: BuildingModel, opts: LayoutOptions = {}): BuildingModel {
  if (model.footprint.kind !== "rect") return model;
  const species = opts.species ?? "horse";
  const preset = SPECIES_PRESETS[species];
  const bayNS = model.roof.ridgeAxis === "ns";
  const stall = opts.stallFt ?? preset.minPen[0];
  const depth = opts.depthFt ?? preset.minPen[1];
  const aisle = opts.aisleFt ?? preset.aisleRecommendedFt;
  const width = depth * 2 + aisle;
  const fp = model.footprint;
  const length = bayNS ? fp.dFt : fp.wFt;
  const bays = Math.max(1, Math.floor(length / stall + 1e-9));

  let m = clearZones(model);
  // Resize the cross-section to the layout, keep the length.
  m = syncExteriorWalls({ ...m, footprint: { kind: "rect", wFt: bayNS ? width : fp.wFt, dFt: bayNS ? fp.dFt : width } });

  const rectAlong = (i: number, side: 0 | 1 | "aisle"): Rect => {
    const a0 = i * stall;
    const across0 = side === 0 ? 0 : side === 1 ? depth + aisle : depth;
    const acrossW = side === "aisle" ? aisle : depth;
    return bayNS ? { x: across0, y: a0, w: acrossW, d: stall } : { x: a0, y: across0, w: stall, d: acrossW };
  };
  // Aisle runs the full length.
  m = addZone(m, { type: "aisle", rect: bayNS ? { x: depth, y: 0, w: aisle, d: bays * stall } : { x: 0, y: depth, w: bays * stall, d: aisle }, name: "Center aisle", autoGrow: false });
  const support = Math.min(opts.supportBays ?? 0, bays);
  for (let i = 0; i < bays; i++) {
    for (const side of [0, 1] as const) {
      if (side === 0 && i < support) {
        m = addZone(m, { type: i === 0 ? "tack" : "feed", rect: rectAlong(i, side), autoGrow: false });
        continue;
      }
      m = addZone(m, { type: "pen", species, rect: rectAlong(i, side), autoGrow: false });
    }
  }
  return growToFitZones(m);
}

/** Shed-row: one row of stalls along the length, each opening outside; no aisle. */
export function applyShedRow(model: BuildingModel, opts: LayoutOptions = {}): BuildingModel {
  if (model.footprint.kind !== "rect") return model;
  const species = opts.species ?? "horse";
  const preset = SPECIES_PRESETS[species];
  const bayNS = model.roof.ridgeAxis === "ns";
  const stall = opts.stallFt ?? preset.minPen[0];
  const depth = opts.depthFt ?? preset.minPen[1];
  const fp = model.footprint;
  const length = bayNS ? fp.dFt : fp.wFt;
  const bays = Math.max(1, Math.floor(length / stall + 1e-9));
  let m = clearZones(model);
  m = syncExteriorWalls({ ...m, footprint: { kind: "rect", wFt: bayNS ? depth : fp.wFt, dFt: bayNS ? fp.dFt : depth } });
  for (let i = 0; i < bays; i++) {
    const rect: Rect = bayNS ? { x: 0, y: i * stall, w: depth, d: stall } : { x: i * stall, y: 0, w: stall, d: depth };
    m = addZone(m, { type: "pen", species, rect, outsideAccess: true, autoGrow: false });
  }
  return growToFitZones(m);
}

export function applyLayout(model: BuildingModel, pattern: LayoutPattern, opts: LayoutOptions = {}): BuildingModel {
  switch (pattern) {
    case "centerAisle":
      return applyCenterAisle(model, opts);
    case "shedRow":
      return applyShedRow(model, opts);
    case "clear":
      return { ...clearZones(model), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
  }
}
