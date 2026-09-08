/**
 * Zones (SPEC §5.1, §18, §22) as axis-aligned rectangles on a 1' grid,
 * stored as 4-point polygons per the schema. Commands snap to the grid and
 * to the post-bay lines, and can grow the envelope when a zone lands outside.
 */
import type { BuildingModel, Species, Zone, ZoneType } from "./schema";
import { newId } from "./ids";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { syncExteriorWalls, wallLengthFt, EXTERIOR_WALL_IDS } from "./walls";
import { OPENING_PRESETS } from "./openings";
import type { Opening } from "./schema";

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  pen: "Stall",
  aisle: "Aisle",
  tack: "Tack room",
  feed: "Feed room",
  hay: "Hay & bedding",
  wash: "Wash bay",
  equipment: "Equipment bay",
  office: "Office",
  kidding: "Kidding pen",
  milking: "Milking parlour",
  utility: "Utility room",
  restroom: "Restroom",
  open: "Open area",
};

export const ZONE_COLORS: Record<ZoneType, string> = {
  pen: "#c8a27a",
  aisle: "#e6e2d8",
  tack: "#9fb7c9",
  feed: "#d9c37a",
  hay: "#d8c98a",
  wash: "#9cc4c9",
  equipment: "#b9b9c4",
  office: "#b4c4a8",
  kidding: "#cfb08a",
  milking: "#c6b7d1",
  utility: "#c0c0c0",
  restroom: "#c6d3d9",
  open: "#e5e5e0",
};

/** Room presets [w, d] feet (SPEC §22 support spaces). */
export const ROOM_PRESETS: Partial<Record<ZoneType, [number, number]>> = {
  tack: [12, 12],
  feed: [10, 12],
  hay: [12, 24],
  wash: [12, 12],
  equipment: [12, 24],
  office: [12, 12],
  utility: [8, 8],
  kidding: [5, 6],
  milking: [12, 12],
  restroom: [6, 8],
  open: [12, 12],
  aisle: [12, 36],
  pen: [12, 12],
};

export function zoneRect(z: Zone): Rect {
  const xs = z.polygon.map((p) => p.x);
  const ys = z.polygon.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, d: Math.max(...ys) - y };
}

export function rectPolygon(r: Rect) {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.d },
    { x: r.x, y: r.y + r.d },
  ];
}

export function rectsOverlap(a: Rect, b: Rect, eps = 1e-6): boolean {
  return a.x < b.x + b.w - eps && a.x + a.w > b.x + eps && a.y < b.y + b.d - eps && a.y + a.d > b.y + eps;
}

export function rectsShareEdge(a: Rect, b: Rect, eps = 1e-6): boolean {
  const vertical = (Math.abs(a.x + a.w - b.x) < eps || Math.abs(b.x + b.w - a.x) < eps) && a.y < b.y + b.d - eps && a.y + a.d > b.y + eps;
  const horizontal = (Math.abs(a.y + a.d - b.y) < eps || Math.abs(b.y + b.d - a.y) < eps) && a.x < b.x + b.w - eps && a.x + a.w > b.x + eps;
  return vertical || horizontal;
}

export const ZONE_GRID_FT = 1;
const SNAP_TOL_FT = 0.6;

function roundGrid(v: number) {
  return Math.round(v / ZONE_GRID_FT) * ZONE_GRID_FT;
}

/** Snap targets along an axis: grid, bay lines, the walls, and other zones' edges. */
export function snapCoordinate(model: BuildingModel, axis: "x" | "y", v: number, excludeZoneId?: string): number {
  if (model.footprint.kind !== "rect") return roundGrid(v);
  const { wFt: W, dFt: D } = model.footprint;
  const extent = axis === "x" ? W : D;
  const targets: number[] = [0, extent];
  const bayAxis = model.roof.ridgeAxis === "ns" ? "y" : "x";
  if (axis === bayAxis) for (let b = model.frame.bayFt; b < extent; b += model.frame.bayFt) targets.push(b);
  for (const z of model.zones) {
    if (z.id === excludeZoneId) continue;
    const r = zoneRect(z);
    targets.push(axis === "x" ? r.x : r.y, axis === "x" ? r.x + r.w : r.y + r.d);
  }
  let best = roundGrid(v);
  let bestDist = Math.abs(v - best);
  for (const t of targets) {
    const d = Math.abs(v - t);
    if (d < SNAP_TOL_FT && d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

export function snapRect(model: BuildingModel, r: Rect, excludeZoneId?: string): Rect {
  const x0 = snapCoordinate(model, "x", r.x, excludeZoneId);
  const y0 = snapCoordinate(model, "y", r.y, excludeZoneId);
  const x1 = snapCoordinate(model, "x", r.x + r.w, excludeZoneId);
  const y1 = snapCoordinate(model, "y", r.y + r.d, excludeZoneId);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.max(ZONE_GRID_FT, Math.abs(x1 - x0)), d: Math.max(ZONE_GRID_FT, Math.abs(y1 - y0)) };
}

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

/** Keep interior doors inside their edge after a resize (drop any that no longer fit). */
export function clampDoorsToRect(doors: Zone["doors"], r: Rect): Zone["doors"] {
  return doors.flatMap((d) => {
    const edgeLen = d.side === "n" || d.side === "s" ? r.w : r.d;
    if (d.widthFt > edgeLen - 0.5) return [];
    const offsetFt = Math.min(Math.max(0.25, d.offsetFt), edgeLen - d.widthFt - 0.25);
    return [offsetFt === d.offsetFt ? d : { ...d, offsetFt }];
  });
}

export function defaultZoneName(model: BuildingModel, type: ZoneType, species?: Species): string {
  const same = model.zones.filter((z) => z.type === type && (type !== "pen" || z.species === species)).length + 1;
  if (type === "pen") return `${species ? SPECIES_PRESETS[species].label : "Pen"} ${same}`;
  return same === 1 ? ZONE_TYPE_LABEL[type] : `${ZONE_TYPE_LABEL[type]} ${same}`;
}

export interface AddZoneInput {
  type: ZoneType;
  species?: Species;
  rect: Rect;
  name?: string;
  id?: string;
  headCount?: number;
  outsideAccess?: boolean;
  /** Extend the footprint when the zone lands outside it (SPEC §18.2). */
  autoGrow?: boolean;
}

export function defaultPenSize(species: Species): [number, number] {
  return SPECIES_PRESETS[species].minPen;
}

export function addZone(model: BuildingModel, input: AddZoneInput): BuildingModel {
  const species = input.type === "pen" || input.type === "kidding" ? (input.species ?? "horse") : undefined;
  const rect = snapRect(model, input.rect);
  const zone: Zone = {
    id: input.id ?? newId("zone"),
    name: input.name ?? defaultZoneName(model, input.type, species),
    type: input.type,
    species,
    headCount: input.headCount,
    polygon: rectPolygon(rect),
    flooring: input.type === "pen" || input.type === "kidding" ? "concreteMats" : input.type === "wash" ? "concrete" : "concrete",
    outsideAccess: input.outsideAccess ?? false,
    doors: [],
    autoDoor: true,
  };
  let next = touch({ ...model, zones: [...model.zones, zone] });
  if (input.autoGrow !== false) next = growToFitZones(next);
  return syncOutsideDoors(next);
}

export function updateZone(model: BuildingModel, id: string, patch: Partial<Omit<Zone, "id" | "polygon">> & { rect?: Rect; autoGrow?: boolean }): BuildingModel {
  const idx = model.zones.findIndex((z) => z.id === id);
  if (idx < 0) return model;
  const cur = model.zones[idx];
  const { rect, autoGrow, ...rest } = patch;
  const merged: Zone = { ...cur, ...rest };
  if (rect) {
    merged.polygon = rectPolygon(snapRect(model, rect, id));
    merged.doors = clampDoorsToRect(merged.doors, zoneRect(merged));
  }
  if (merged.type !== "pen" && merged.type !== "kidding") merged.species = undefined;
  else if (!merged.species) merged.species = "horse";
  const unchanged = JSON.stringify(merged) === JSON.stringify(cur);
  if (unchanged) return model;
  const zones = model.zones.slice();
  zones[idx] = merged;
  let next = touch({ ...model, zones });
  if (rect && autoGrow !== false) next = growToFitZones(next);
  return syncOutsideDoors(next);
}

export function moveZone(model: BuildingModel, id: string, x: number, y: number, opts: { autoGrow?: boolean } = {}): BuildingModel {
  const z = model.zones.find((zz) => zz.id === id);
  if (!z) return model;
  const r = zoneRect(z);
  // Snap the origin, keep the size.
  const sx = snapCoordinate(model, "x", Math.max(0, x), id);
  const sy = snapCoordinate(model, "y", Math.max(0, y), id);
  return updateZone(model, id, { rect: { x: sx, y: sy, w: r.w, d: r.d }, autoGrow: opts.autoGrow });
}

export function resizeZone(model: BuildingModel, id: string, rect: Rect, opts: { autoGrow?: boolean } = {}): BuildingModel {
  return updateZone(model, id, { rect: { ...rect, x: Math.max(0, rect.x), y: Math.max(0, rect.y) }, autoGrow: opts.autoGrow });
}

export function removeZone(model: BuildingModel, id: string): BuildingModel {
  if (!model.zones.some((z) => z.id === id)) return model;
  return syncOutsideDoors(touch({ ...model, zones: model.zones.filter((z) => z.id !== id) }));
}

export function duplicateZone(model: BuildingModel, id: string, direction: "e" | "w" | "n" | "s" = "e"): BuildingModel {
  const z = model.zones.find((zz) => zz.id === id);
  if (!z) return model;
  const r = zoneRect(z);
  const rect: Rect = direction === "e" ? { ...r, x: r.x + r.w } : direction === "w" ? { ...r, x: r.x - r.w } : direction === "n" ? { ...r, y: r.y + r.d } : { ...r, y: r.y - r.d };
  if (rect.x < 0 || rect.y < 0) return model;
  return addZone(model, { type: z.type, species: z.species, rect, headCount: z.headCount, outsideAccess: z.outsideAccess });
}

/** Repeat a zone `count` more times along a direction (SPEC §21.1 "Array"). */
export function arrayZone(model: BuildingModel, id: string, count: number, direction: "e" | "w" | "n" | "s" = "e"): BuildingModel {
  let m = model;
  let lastId = id;
  for (let i = 0; i < count; i++) {
    const before = m.zones.length;
    m = duplicateZone(m, lastId, direction);
    if (m.zones.length === before) break;
    lastId = m.zones[m.zones.length - 1].id;
  }
  return m;
}

/** Split a zone into `parts` equal pieces along its longer side (or the given axis). */
export function splitZone(model: BuildingModel, id: string, parts = 2, axis?: "x" | "y"): BuildingModel {
  const z = model.zones.find((zz) => zz.id === id);
  if (!z || parts < 2) return model;
  const r = zoneRect(z);
  const ax = axis ?? (r.w >= r.d ? "x" : "y");
  const zones = model.zones.filter((zz) => zz.id !== id);
  const pieces: Zone[] = [];
  for (let i = 0; i < parts; i++) {
    const rect: Rect = ax === "x" ? { x: r.x + (r.w * i) / parts, y: r.y, w: r.w / parts, d: r.d } : { x: r.x, y: r.y + (r.d * i) / parts, w: r.w, d: r.d / parts };
    pieces.push({ ...z, id: i === 0 ? z.id : newId("zone"), name: `${z.name}${i === 0 ? "" : ` ${String.fromCharCode(97 + i)}`}`, polygon: rectPolygon(rect) });
  }
  return syncOutsideDoors(touch({ ...model, zones: [...zones, ...pieces] }));
}

/** Bounding box of all zones, or null. */
export function zonesBounds(model: BuildingModel): Rect | null {
  if (model.zones.length === 0) return null;
  const rs = model.zones.map(zoneRect);
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.d));
  return { x, y, w: x1 - x, d: y1 - y };
}

function ceilTo(v: number, m: number) {
  return Math.ceil(v / m - 1e-9) * m;
}

/**
 * Envelope needed to contain the zones (SPEC §18.3 "tightest"): width on the
 * 2' module, length on the bay module, never smaller than the current
 * footprint unless `shrink` is set.
 */
export function envelopeForZones(model: BuildingModel, opts: { shrink?: boolean } = {}): { wFt: number; dFt: number } | null {
  if (model.footprint.kind !== "rect") return null;
  const b = zonesBounds(model);
  if (!b) return null;
  const needW = b.x + b.w;
  const needD = b.y + b.d;
  const bayNS = model.roof.ridgeAxis === "ns";
  const modW = bayNS ? 2 : model.frame.bayFt;
  const modD = bayNS ? model.frame.bayFt : 2;
  const cur = model.footprint;
  // Only round up when the interior needs more room; a footprint that already fits is left alone.
  const fit = (need: number, current: number, mod: number) => (need <= current + 1e-9 ? (opts.shrink ? Math.min(current, ceilTo(need, mod)) : current) : ceilTo(need, mod));
  return { wFt: Math.max(4, fit(needW, cur.wFt, modW)), dFt: Math.max(4, fit(needD, cur.dFt, modD)) };
}

/** Grow the footprint so every zone fits (never shrinks). */
export function growToFitZones(model: BuildingModel): BuildingModel {
  const env = envelopeForZones(model);
  if (!env || model.footprint.kind !== "rect") return model;
  if (env.wFt === model.footprint.wFt && env.dFt === model.footprint.dFt) return model;
  return syncOutsideDoors(touch(syncExteriorWalls({ ...model, footprint: { kind: "rect", wFt: env.wFt, dFt: env.dFt } })));
}

/** Shrink-wrap the footprint to the interior on the framing modules (SPEC §3.2 "derive envelope"). */
export function fitEnvelopeToZones(model: BuildingModel): BuildingModel {
  const env = envelopeForZones(model, { shrink: true });
  if (!env || model.footprint.kind !== "rect") return model;
  if (env.wFt === model.footprint.wFt && env.dFt === model.footprint.dFt) return model;
  return syncOutsideDoors(touch(syncExteriorWalls({ ...model, footprint: { kind: "rect", wFt: env.wFt, dFt: env.dFt } })));
}

/** Zones (or parts) outside the footprint. */
export function zonesOutside(model: BuildingModel): Zone[] {
  if (model.footprint.kind !== "rect") return [];
  const { wFt: W, dFt: D } = model.footprint;
  return model.zones.filter((z) => {
    const r = zoneRect(z);
    return r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > W + 1e-6 || r.y + r.d > D + 1e-6;
  });
}

// ---------------------------------------------------------------------------
// Outside access: a pen on an exterior wall gets a Dutch door that follows it.
// ---------------------------------------------------------------------------

/** Exterior wall side a zone touches and the door centre along that wall, or null. */
export function exteriorEdgeOf(model: BuildingModel, z: Zone): { side: "n" | "s" | "e" | "w"; centerFt: number } | null {
  if (model.footprint.kind !== "rect") return null;
  const { wFt: W, dFt: D } = model.footprint;
  const r = zoneRect(z);
  const eps = 1e-6;
  if (Math.abs(r.y) < eps) return { side: "s", centerFt: r.x + r.w / 2 };
  if (Math.abs(r.x + r.w - W) < eps) return { side: "e", centerFt: r.y + r.d / 2 };
  if (Math.abs(r.y + r.d - D) < eps) return { side: "n", centerFt: W - (r.x + r.w / 2) };
  if (Math.abs(r.x) < eps) return { side: "w", centerFt: D - (r.y + r.d / 2) };
  return null;
}

/**
 * Keep pen-linked exterior doors in sync with their pens: add for pens with
 * outside access on an exterior wall, move to stay centred, remove when the
 * pen loses access, moves inside, or is deleted. Idempotent.
 */
export function syncOutsideDoors(model: BuildingModel): BuildingModel {
  const keep: Opening[] = [];
  let changed = false;
  const linked = new Map(model.openings.filter((o) => o.zoneId).map((o) => [o.zoneId!, o]));
  for (const o of model.openings) if (!o.zoneId) keep.push(o);
  for (const z of model.zones) {
    const edge = z.outsideAccess ? exteriorEdgeOf(model, z) : null;
    const existing = linked.get(z.id);
    if (!edge) {
      if (existing) changed = true;
      continue;
    }
    const wallId = EXTERIOR_WALL_IDS[edge.side];
    const wall = model.walls.find((w) => w.id === wallId);
    if (!wall) continue;
    const preset = OPENING_PRESETS.dutchDoor;
    const width = existing?.widthFt ?? preset.widthFt;
    const len = wallLengthFt(wall);
    const offset = Math.min(Math.max(0, edge.centerFt - width / 2), Math.max(0, len - width));
    if (existing && existing.wallId === wallId && Math.abs(existing.offsetFt - offset) < 1e-6) {
      keep.push(existing);
      continue;
    }
    changed = true;
    keep.push(
      existing
        ? { ...existing, wallId, offsetFt: offset }
        : { id: newId("op"), wallId, type: "dutchDoor", offsetFt: offset, widthFt: width, heightFt: preset.heightFt, sillFt: 0, swing: "out", hardware: [], zoneId: z.id },
    );
  }
  for (const [zoneId] of linked) if (!model.zones.some((z) => z.id === zoneId)) changed = true;
  if (!changed) return model;
  return { ...model, openings: keep };
}

export function setOutsideAccess(model: BuildingModel, id: string, on: boolean): BuildingModel {
  return updateZone(model, id, { outsideAccess: on });
}
