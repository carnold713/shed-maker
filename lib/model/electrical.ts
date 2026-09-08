/**
 * Electrical fixtures: placement commands and presets (ADR-0013). Circuits,
 * loads, wire sizes and routes are derived in lib/electrical/derive.ts.
 */
import type { BuildingModel, ElectricalFixture, FixtureKind, Zone } from "./schema";
import { nearestExteriorWall } from "./walls";
import { zoneRect } from "./zones";
import { lumensNeeded, lumensOf } from "@/lib/electrical/lighting";
import { newId } from "./ids";

export interface FixturePreset {
  kind: FixtureKind;
  label: string;
  short: string;
  hint: string;
  watts: number;
  volts: 120 | 240;
  /** Default mounting height above the floor, feet (lights clamp to the eave). */
  mountFt: number;
  /** Mounts on a wall (snaps to the nearest exterior wall) rather than the ceiling / floor. */
  wall: boolean;
  /** Price sku (rules/materials/prices). */
  sku: string;
}

export const FIXTURE_PRESETS: Record<FixtureKind, FixturePreset> = {
  light: { kind: "light", label: "LED strip light (4', 40 W)", short: "Light", hint: "Vapor-tight 4' LED strip; one lights a 12×12 stall, an aisle needs one per bay.", watts: 40, volts: 120, mountFt: 9, wall: false, sku: "elec.lightStrip" },
  floodlight: { kind: "floodlight", label: "Outdoor floodlight (50 W)", short: "Floodlight", hint: "Wall-mounted LED flood over a door or the lean-to.", watts: 50, volts: 120, mountFt: 9, wall: true, sku: "elec.flood" },
  outlet: { kind: "outlet", label: "GFCI outlet (20 A)", short: "Outlet", hint: "Weather-resistant GFCI duplex in a PVC box, 48\" up.", watts: 180, volts: 120, mountFt: 4, wall: true, sku: "elec.outletGfci" },
  switch: { kind: "switch", label: "Light switch", short: "Switch", hint: "Beside each door you walk through; 48\" up.", watts: 0, volts: 120, mountFt: 4, wall: true, sku: "elec.switch" },
  panel: { kind: "panel", label: "Sub-panel", short: "Panel", hint: "Breaker panel fed from the house. Keep 30\" wide × 36\" deep clear in front.", watts: 0, volts: 240, mountFt: 5, wall: true, sku: "elec.panel" },
  fan: { kind: "fan", label: "Circulation fan (24\", 150 W)", short: "Fan", hint: "Stall or aisle fan on its own 20 A circuit.", watts: 150, volts: 120, mountFt: 8, wall: false, sku: "elec.fan" },
  waterer: { kind: "waterer", label: "Heated waterer (500 W)", short: "Waterer", hint: "Automatic waterer with a heating element; GFCI, dedicated circuit.", watts: 500, volts: 120, mountFt: 1.5, wall: true, sku: "elec.waterer" },
  heater: { kind: "heater", label: "Unit heater (240 V, 5 kW)", short: "Heater", hint: "Electric unit heater for a tack or wash room; its own 2-pole breaker.", watts: 5000, volts: 240, mountFt: 7, wall: true, sku: "elec.heater" },
};

export const FIXTURE_KINDS = Object.keys(FIXTURE_PRESETS) as FixtureKind[];
/** Kinds offered by the plan tool (the panel is placed once, via its own button). */
export const PLACEABLE_FIXTURE_KINDS: FixtureKind[] = ["light", "outlet", "switch", "fan", "waterer", "heater", "floodlight", "panel"];

const GRID_FT = 0.5;
const WALL_SNAP_FT = 3;

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

function snap(v: number) {
  return Math.round(v / GRID_FT) * GRID_FT;
}

/** Ceiling fixtures hang just under the trusses; keep them at least 8' up in animal areas. */
export function defaultMountFt(model: BuildingModel, kind: FixtureKind): number {
  const p = FIXTURE_PRESETS[kind];
  if (kind === "light" || kind === "fan") return Math.max(7, Math.min(p.mountFt, model.eaveHeightFt - 0.5));
  return Math.min(p.mountFt, model.eaveHeightFt - 0.5);
}

/** Resolve a plan point for a fixture: wall devices snap onto the nearest exterior wall when close. */
function resolvePosition(model: BuildingModel, kind: FixtureKind, x: number, y: number, wallId?: string): { x: number; y: number; wallId?: string } {
  const p = FIXTURE_PRESETS[kind];
  if (p.wall) {
    const hit = wallId ? (() => { const w = model.walls.find((ww) => ww.id === wallId); return w ? nearestExteriorWall({ ...model, walls: [w] }, x, y) : null; })() : nearestExteriorWall(model, x, y);
    if (hit && (wallId || hit.dist <= WALL_SNAP_FT)) {
      const w = hit.wall;
      const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
      const u = Math.max(0.5, Math.min(len - 0.5, snap(hit.u)));
      const dx = (w.end.x - w.start.x) / len;
      const dy = (w.end.y - w.start.y) / len;
      return { x: w.start.x + dx * u, y: w.start.y + dy * u, wallId: w.id };
    }
  }
  const fp = model.footprint.kind === "rect" ? model.footprint : { wFt: 0, dFt: 0 };
  return { x: Math.max(0, Math.min(fp.wFt, snap(x))), y: Math.max(0, Math.min(fp.dFt, snap(y))) };
}

export interface AddFixtureInput {
  kind: FixtureKind;
  x: number;
  y: number;
  wallId?: string;
  watts?: number;
  mountFt?: number;
  label?: string;
  id?: string;
}

export function addFixture(model: BuildingModel, input: AddFixtureInput): BuildingModel {
  const p = FIXTURE_PRESETS[input.kind];
  // One panel per barn.
  if (input.kind === "panel" && model.electrical.fixtures.some((f) => f.kind === "panel")) return model;
  const pos = resolvePosition(model, input.kind, input.x, input.y, input.wallId);
  const fixture: ElectricalFixture = {
    id: input.id ?? newId("fx"),
    kind: input.kind,
    x: pos.x,
    y: pos.y,
    wallId: pos.wallId,
    mountFt: input.mountFt ?? defaultMountFt(model, input.kind),
    watts: input.watts ?? p.watts,
    volts: p.volts,
    label: input.label,
  };
  return touch({ ...model, electrical: { ...model.electrical, fixtures: [...model.electrical.fixtures, fixture] } });
}

export function updateFixture(model: BuildingModel, id: string, patch: Partial<Omit<ElectricalFixture, "id">>): BuildingModel {
  const idx = model.electrical.fixtures.findIndex((f) => f.id === id);
  if (idx < 0) return model;
  const cur = model.electrical.fixtures[idx];
  let next: ElectricalFixture = { ...cur, ...patch };
  if (patch.kind && patch.kind !== cur.kind) {
    const p = FIXTURE_PRESETS[patch.kind];
    next = { ...next, watts: patch.watts ?? p.watts, volts: p.volts, mountFt: patch.mountFt ?? defaultMountFt(model, patch.kind) };
    const pos = resolvePosition(model, patch.kind, next.x, next.y);
    next = { ...next, ...pos };
  }
  next.mountFt = Math.max(0, Math.min(model.eaveHeightFt, next.mountFt));
  next.watts = Math.max(0, next.watts);
  if (JSON.stringify(next) === JSON.stringify(cur)) return model;
  const fixtures = model.electrical.fixtures.slice();
  fixtures[idx] = next;
  return touch({ ...model, electrical: { ...model.electrical, fixtures } });
}

export function moveFixture(model: BuildingModel, id: string, x: number, y: number): BuildingModel {
  const cur = model.electrical.fixtures.find((f) => f.id === id);
  if (!cur) return model;
  const pos = resolvePosition(model, cur.kind, x, y);
  if (Math.abs(pos.x - cur.x) < 1e-9 && Math.abs(pos.y - cur.y) < 1e-9 && pos.wallId === cur.wallId) return model;
  return updateFixture(model, id, { x: pos.x, y: pos.y, wallId: pos.wallId });
}

export function removeFixture(model: BuildingModel, id: string): BuildingModel {
  if (!model.electrical.fixtures.some((f) => f.id === id)) return model;
  const fixtures = model.electrical.fixtures.filter((f) => f.id !== id).map((f) => (f.switchId === id ? { ...f, switchId: undefined } : f));
  return touch({ ...model, electrical: { ...model.electrical, fixtures } });
}

export function setElectricalService(model: BuildingModel, patch: Partial<BuildingModel["electrical"]["service"]>): BuildingModel {
  const service = { ...model.electrical.service, ...patch };
  if (JSON.stringify(service) === JSON.stringify(model.electrical.service)) return model;
  return touch({ ...model, electrical: { ...model.electrical, service } });
}

export function setWiringMethod(model: BuildingModel, wiring: BuildingModel["electrical"]["wiring"]): BuildingModel {
  if (model.electrical.wiring === wiring) return model;
  return touch({ ...model, electrical: { ...model.electrical, wiring } });
}

/**
 * Put the panel where an electrician would: on the exterior wall of a
 * utility / tack / feed room if there is one, else beside the first man
 * door, else 3' in from the south-west corner on the south wall.
 */
export function autoPlacePanel(model: BuildingModel): BuildingModel {
  if (model.footprint.kind !== "rect") return model;
  if (model.electrical.fixtures.some((f) => f.kind === "panel")) return model;
  const { wFt: W, dFt: D } = model.footprint;
  const room = model.zones.find((z) => ["utility", "tack", "feed", "office"].includes(z.type) && touchesExterior(z, W, D));
  if (room) {
    const r = zoneRect(room);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.d / 2;
    // Nearest exterior edge of the room.
    const cands: [number, number, number][] = [
      [cx, 0, r.y],
      [cx, D, D - (r.y + r.d)],
      [0, cy, r.x],
      [W, cy, W - (r.x + r.w)],
    ];
    const [x, y] = cands.sort((a, b) => a[2] - b[2])[0];
    return addFixture(model, { kind: "panel", x, y, label: `${room.name} panel` });
  }
  const door = model.openings.find((o) => o.type === "manDoor");
  const wall = door ? model.walls.find((w) => w.id === door.wallId) : undefined;
  if (door && wall) {
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
    const u = door.offsetFt + door.widthFt + 2.5 < len - 1 ? door.offsetFt + door.widthFt + 2.5 : Math.max(1, door.offsetFt - 2.5);
    const dx = (wall.end.x - wall.start.x) / len;
    const dy = (wall.end.y - wall.start.y) / len;
    return addFixture(model, { kind: "panel", x: wall.start.x + dx * u, y: wall.start.y + dy * u, wallId: wall.id });
  }
  return addFixture(model, { kind: "panel", x: 3, y: 0, wallId: "wall_ext_s" });
}

function touchesExterior(z: Zone, W: number, D: number) {
  const r = zoneRect(z);
  return r.x < 1e-6 || r.y < 1e-6 || Math.abs(r.x + r.w - W) < 1e-6 || Math.abs(r.y + r.d - D) < 1e-6;
}

/** Fixtures whose plan point lies inside a zone. */
export function fixturesInZone(model: BuildingModel, z: Zone, kind?: FixtureKind): ElectricalFixture[] {
  const r = zoneRect(z);
  return model.electrical.fixtures.filter((f) => (!kind || f.kind === kind) && f.x >= r.x - 1e-6 && f.x <= r.x + r.w + 1e-6 && f.y >= r.y - 1e-6 && f.y <= r.y + r.d + 1e-6);
}

/** How many more default LED strips a zone needs to hit its target (0 when lit). */
export function lightsNeededFor(model: BuildingModel, z: Zone): number {
  const r = zoneRect(z);
  const have = fixturesInZone(model, z, "light").reduce((s, f) => s + lumensOf(f.watts), 0);
  const need = lumensNeeded(z.type, r.w * r.d);
  const per = lumensOf(FIXTURE_PRESETS.light.watts);
  return Math.max(0, Math.ceil((need - have) / per - 1e-6));
}

/** Add evenly spaced LED strips down a zone's long axis until it meets its lighting target. */
export function autoLightZone(model: BuildingModel, zoneId: string): BuildingModel {
  const z = model.zones.find((zz) => zz.id === zoneId);
  if (!z) return model;
  const n = lightsNeededFor(model, z);
  if (n === 0) return model;
  const r = zoneRect(z);
  const along = r.w >= r.d ? "x" : "y";
  const existing = fixturesInZone(model, z, "light").length;
  const total = existing + n;
  let next = model;
  // Re-space everything: drop the zone's existing lights and lay out `total` evenly.
  for (const f of fixturesInZone(model, z, "light")) next = removeFixture(next, f.id);
  for (let i = 0; i < total; i++) {
    const t = (i + 0.5) / total;
    const x = along === "x" ? r.x + r.w * t : r.x + r.w / 2;
    const y = along === "y" ? r.y + r.d * t : r.y + r.d / 2;
    next = addFixture(next, { kind: "light", x, y, label: total > 1 ? `${z.name} ${i + 1}` : z.name });
  }
  return next;
}

/** Light every pen, aisle and room that is under target, then place a panel if there is none. */
export function autoLightAll(model: BuildingModel): BuildingModel {
  let next = model;
  for (const z of model.zones) next = autoLightZone(next, z.id);
  if (!next.electrical.fixtures.some((f) => f.kind === "panel")) next = autoPlacePanel(next);
  return next;
}
