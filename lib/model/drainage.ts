/**
 * Floor drainage: drains and the outlet are placed here (ADR-0016). Pipe
 * runs, slopes, inverts and cleanouts are derived in lib/plumbing/drainage.
 */
import type { BuildingModel, Drain, DrainKind, DrainOutlet, Zone } from "./schema";
import { nearestExteriorWall } from "./walls";
import { zoneRect } from "./zones";
import { newId } from "./ids";

export interface DrainPreset {
  kind: DrainKind;
  label: string;
  short: string;
  hint: string;
  /** Outlet pipe invert below the finished floor, inches (body + deep-seal trap / catch basin). */
  trapDepthIn: number;
  sku: string;
}

export const DRAIN_PRESETS: Record<DrainKind, DrainPreset> = {
  floor: { kind: "floor", label: "Floor drain (4\")", short: "Floor drain", hint: "Round grate with a deep-seal trap and sediment bucket; the slab slopes to it from up to 20' away.", trapDepthIn: 10, sku: "drain.floor4" },
  trench: { kind: "trench", label: "Trench drain", short: "Trench drain", hint: "Channel with a hoof-rated grate, cast into the slab; catches a whole wash bay or a door threshold.", trapDepthIn: 12, sku: "drain.trench.lf" },
};

export const OUTLET_LABEL: Record<DrainOutlet["kind"], string> = {
  daylight: "To daylight (pipe ends on the downhill ground)",
  dryWell: "To a dry well (stone pit 10' from the building)",
  septic: "To a septic / holding tank",
  storm: "To a storm drain",
};

export const OUTLET_ID = "drain_outlet";
const GRID_FT = 0.5;

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}
function snap(v: number) {
  return Math.round(v / GRID_FT) * GRID_FT;
}
function clampInside(model: BuildingModel, x: number, y: number, marginFt = 1) {
  const fp = model.footprint.kind === "rect" ? model.footprint : { wFt: 24, dFt: 36 };
  return { x: Math.max(marginFt, Math.min(fp.wFt - marginFt, snap(x))), y: Math.max(marginFt, Math.min(fp.dFt - marginFt, snap(y))) };
}

export interface AddDrainInput {
  kind: DrainKind;
  x: number;
  y: number;
  lengthFt?: number;
  axis?: "x" | "y";
  label?: string;
  id?: string;
}

export function addDrain(model: BuildingModel, input: AddDrainInput): BuildingModel {
  const pos = clampInside(model, input.x, input.y);
  const zone = zoneAt(model, pos.x, pos.y);
  let lengthFt = input.lengthFt ?? 4;
  let axis = input.axis ?? "x";
  if (input.kind === "trench" && zone && input.lengthFt === undefined) {
    // Span the zone's short side by default.
    const r = zoneRect(zone);
    axis = r.w <= r.d ? "x" : "y";
    lengthFt = Math.max(2, (axis === "x" ? r.w : r.d) - 1);
  }
  const drain: Drain = { id: input.id ?? newId("drain"), kind: input.kind, x: pos.x, y: pos.y, lengthFt: Math.max(1, snap(lengthFt)), axis, label: input.label ?? (zone ? `${zone.name} ${input.kind === "trench" ? "trench" : "drain"}` : undefined) };
  return touch({ ...model, drainage: { ...model.drainage, drains: [...model.drainage.drains, drain] } });
}

export function updateDrain(model: BuildingModel, id: string, patch: Partial<Omit<Drain, "id">>): BuildingModel {
  const idx = model.drainage.drains.findIndex((d) => d.id === id);
  if (idx < 0) return model;
  const cur = model.drainage.drains[idx];
  const next: Drain = { ...cur, ...patch };
  if (patch.x !== undefined || patch.y !== undefined) Object.assign(next, clampInside(model, next.x, next.y));
  next.lengthFt = Math.max(1, snap(next.lengthFt));
  if (JSON.stringify(next) === JSON.stringify(cur)) return model;
  const drains = model.drainage.drains.slice();
  drains[idx] = next;
  return touch({ ...model, drainage: { ...model.drainage, drains } });
}

export function moveDrain(model: BuildingModel, id: string, x: number, y: number): BuildingModel {
  return updateDrain(model, id, { x, y });
}

export function removeDrain(model: BuildingModel, id: string): BuildingModel {
  if (!model.drainage.drains.some((d) => d.id === id)) return model;
  return touch({ ...model, drainage: { ...model.drainage, drains: model.drainage.drains.filter((d) => d.id !== id) } });
}

/** Put (or move) the outlet on an exterior wall; `x,y` snaps to the nearest wall when given. */
export function setOutlet(model: BuildingModel, input: Partial<DrainOutlet> & { x?: number; y?: number }): BuildingModel {
  let wallId = input.wallId ?? model.drainage.outlet?.wallId;
  let offsetFt = input.offsetFt ?? model.drainage.outlet?.offsetFt;
  if (input.x !== undefined && input.y !== undefined) {
    const hit = nearestExteriorWall(model, input.x, input.y);
    if (!hit) return model;
    wallId = hit.wall.id;
    offsetFt = hit.u;
  }
  if (!wallId || offsetFt === undefined) return model;
  const wall = model.walls.find((w) => w.id === wallId);
  if (!wall) return model;
  const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  const outlet: DrainOutlet = { kind: input.kind ?? model.drainage.outlet?.kind ?? "daylight", wallId, offsetFt: Math.max(1, Math.min(len - 1, snap(offsetFt))) };
  if (JSON.stringify(outlet) === JSON.stringify(model.drainage.outlet)) return model;
  return touch({ ...model, drainage: { ...model.drainage, outlet } });
}

export function removeOutlet(model: BuildingModel): BuildingModel {
  if (!model.drainage.outlet) return model;
  const { outlet: _drop, ...rest } = model.drainage;
  void _drop;
  return touch({ ...model, drainage: rest });
}

export function setDrainageOptions(model: BuildingModel, patch: Partial<Pick<BuildingModel["drainage"], "pipeDiaIn" | "slopeInPerFt" | "siteFallIn">>): BuildingModel {
  const drainage = { ...model.drainage, ...patch };
  if (JSON.stringify(drainage) === JSON.stringify(model.drainage)) return model;
  return touch({ ...model, drainage });
}

/** Plan position of the outlet on its wall. */
export function outletPoint(model: BuildingModel): { x: number; y: number; wallId: string } | null {
  const o = model.drainage.outlet;
  if (!o) return null;
  const w = model.walls.find((x) => x.id === o.wallId);
  if (!w) return null;
  const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
  const u = Math.min(len, o.offsetFt);
  return { x: w.start.x + ((w.end.x - w.start.x) / len) * u, y: w.start.y + ((w.end.y - w.start.y) / len) * u, wallId: w.id };
}

export function zoneAt(model: BuildingModel, x: number, y: number): Zone | null {
  for (const z of model.zones) {
    const r = zoneRect(z);
    if (x >= r.x - 1e-6 && x <= r.x + r.w + 1e-6 && y >= r.y - 1e-6 && y <= r.y + r.d + 1e-6) return z;
  }
  return null;
}

export function drainsInZone(model: BuildingModel, z: Zone): Drain[] {
  const r = zoneRect(z);
  return model.drainage.drains.filter((d) => d.x >= r.x - 1e-6 && d.x <= r.x + r.w + 1e-6 && d.y >= r.y - 1e-6 && d.y <= r.y + r.d + 1e-6);
}

/** Outlet on the exterior wall nearest the drains' centroid (daylight), if there is none. */
export function autoOutlet(model: BuildingModel): BuildingModel {
  if (model.drainage.outlet || model.drainage.drains.length === 0) return model;
  const n = model.drainage.drains.length;
  const cx = model.drainage.drains.reduce((s, d) => s + d.x, 0) / n;
  const cy = model.drainage.drains.reduce((s, d) => s + d.y, 0) / n;
  return setOutlet(model, { x: cx, y: cy, kind: "daylight" });
}

/** A trench drain across every wash bay that has none, then an outlet. */
export function autoDrainWashBays(model: BuildingModel): BuildingModel {
  let next = model;
  for (const z of model.zones) {
    if (z.type !== "wash" || drainsInZone(next, z).length > 0) continue;
    const r = zoneRect(z);
    next = addDrain(next, { kind: "trench", x: r.x + r.w / 2, y: r.y + r.d / 2, label: `${z.name} trench` });
  }
  return autoOutlet(next);
}
