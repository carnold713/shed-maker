/**
 * Electrical geometry (ADR-0013): fixture bodies and the wire runs derived
 * by lib/electrical, so the 3D view shows how power gets from the panel to
 * every light and outlet — conduit along the girts at the wiring belt,
 * across the truss chords, and dropping to each device.
 */
import type { BuildingModel, ElectricalFixture } from "@/lib/model/schema";
import { deriveElectrical } from "@/lib/electrical/derive";
import { planToWorld } from "./frame";
import type { BoxMember, Vec3 } from "./types";

/** Wall devices and runs sit this far inside the plan wall line (on the girts). */
const WALL_INSET_FT = 0.35;
const WIRE_FT = 0.09;

/** Offset a perimeter point inward so runs and devices sit on the inside face of the girts. */
function insetPoint(W: number, D: number, p: { x: number; y: number }): { x: number; y: number } {
  const eps = 1e-6;
  let { x, y } = p;
  if (Math.abs(y) < eps) y = WALL_INSET_FT;
  else if (Math.abs(y - D) < eps) y = D - WALL_INSET_FT;
  if (Math.abs(x) < eps) x = WALL_INSET_FT;
  else if (Math.abs(x - W) < eps) x = W - WALL_INSET_FT;
  return { x, y };
}

function fixtureBox(model: BuildingModel, f: ElectricalFixture, W: number, D: number): BoxMember {
  const alongZ = f.rotationDeg % 180 === 90;
  const wall = f.wallId ? model.walls.find((w) => w.id === f.wallId) : undefined;
  const yaw = wall ? Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) : f.facing === "y" ? Math.PI / 2 : 0;
  const rot: Vec3 = [0, yaw, 0];
  const inside = wall ? insetPoint(W, D, f) : f;
  const base = { id: `fx_${f.id}`, kind: "fixture" as const, layer: "electrical" as const, entityId: f.id, rotation: rot };
  switch (f.kind) {
    case "light":
      return { ...base, material: "fixture", center: planToWorld(f.x, f.y, f.mountFt), size: alongZ ? [0.45, 0.25, 4] : [4, 0.25, 0.45], rotation: [0, 0, 0] };
    case "floodlight": {
      // Outside face of the wall, tilted look is overkill: a small wall pack.
      const out = wall ? { x: 2 * f.x - inside.x, y: 2 * f.y - inside.y } : f;
      return { ...base, material: "fixture", center: planToWorld(out.x, out.y, f.mountFt), size: [0.7, 0.45, 0.35] };
    }
    case "gooseneck": {
      // Arm and shade on the outside face; the shade is the visible bit.
      const out = wall ? { x: 2 * f.x - inside.x, y: 2 * f.y - inside.y } : f;
      return { ...base, material: "device", center: planToWorld(out.x, out.y, f.mountFt - 0.35), size: [1.1, 0.4, 1.1] };
    }
    case "lantern": {
      const out = wall ? { x: 2 * f.x - inside.x, y: 2 * f.y - inside.y } : f;
      return { ...base, material: "fixture", center: planToWorld(out.x, out.y, f.mountFt), size: [0.5, 0.9, 0.35] };
    }
    case "outlet":
    case "switch":
      return { ...base, material: "device", center: planToWorld(inside.x, inside.y, f.mountFt), size: [0.4, 0.45, 0.2] };
    case "panel":
      return { ...base, material: "device", center: planToWorld(inside.x, inside.y, f.mountFt), size: [1.2, 2.5, 0.35] };
    case "fan":
      return { ...base, material: "device", center: planToWorld(f.x, f.y, f.mountFt), size: [2, 0.6, 2], rotation: [0, 0, 0] };
    case "waterer":
      return { ...base, material: "device", center: planToWorld(inside.x, inside.y, 0.6), size: [1.5, 1.2, 1.2] };
    case "heater":
      return { ...base, material: "device", center: planToWorld(inside.x, inside.y, f.mountFt), size: [1.5, 1, 1] };
  }
}

export function electricalGeometry(model: BuildingModel): BoxMember[] {
  if (model.footprint.kind !== "rect" || model.electrical.fixtures.length === 0) return [];
  const { wFt: W, dFt: D } = model.footprint;
  const out: BoxMember[] = model.electrical.fixtures.map((f) => fixtureBox(model, f, W, D));
  const e = deriveElectrical(model);
  const h = e.routeHeightFt;
  // Runs: one thin box per polyline segment at the wiring-belt height, then a drop to each device.
  e.routes.forEach((r, ri) => {
    const pts = r.points.map((p) => insetPoint(W, D, p));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.05) continue;
      const yaw = Math.atan2(b.y - a.y, b.x - a.x);
      out.push({ id: `wire_${r.circuitId}_${ri}_${i}`, kind: "wire", layer: "electrical", entityId: r.kind === "switchLeg" && r.switchId ? r.switchId : r.circuitId, material: "wire", center: planToWorld((a.x + b.x) / 2, (a.y + b.y) / 2, h), size: [len, WIRE_FT, WIRE_FT], rotation: [0, yaw, 0] });
    }
  });
  for (const f of model.electrical.fixtures) {
    const p = f.wallId ? insetPoint(W, D, f) : f;
    const top = Math.max(h, f.mountFt);
    const bottom = Math.min(h, f.kind === "waterer" ? 1 : f.mountFt);
    if (top - bottom < 0.1) continue;
    out.push({ id: `drop_${f.id}`, kind: "wire", layer: "electrical", entityId: f.id, material: "wire", center: planToWorld(p.x, p.y, (top + bottom) / 2), size: [WIRE_FT, top - bottom, WIRE_FT], rotation: [0, 0, 0] });
  }
  return out;
}
