/**
 * Drainage geometry (ADR-0016): drain grates at floor level and the
 * under-slab pipe network at its real fall, so the cutaway and the
 * foundation views show what goes in before the pour.
 */
import type { BuildingModel } from "@/lib/model/schema";
import { deriveDrainage } from "@/lib/plumbing/drainage";
import { planToWorld } from "./frame";
import type { BoxMember } from "./types";

export function drainageGeometry(model: BuildingModel): BoxMember[] {
  if (model.footprint.kind !== "rect" || model.drainage.drains.length === 0) return [];
  const d = deriveDrainage(model);
  const out: BoxMember[] = [];
  const dia = model.drainage.pipeDiaIn / 12;
  for (const dd of d.drains) {
    const dr = dd.drain;
    if (dr.kind === "trench") {
      const size: [number, number, number] = dr.axis === "x" ? [dr.lengthFt, 0.08, 0.6] : [0.6, 0.08, dr.lengthFt];
      out.push({ id: `drain_${dr.id}`, kind: "drain", layer: "drainage", entityId: dr.id, material: "device", center: planToWorld(dr.x, dr.y, 0.04), size, rotation: [0, 0, 0] });
      out.push({ id: `drainbody_${dr.id}`, kind: "drain", layer: "drainage", entityId: dr.id, material: "concrete", center: planToWorld(dr.x, dr.y, -0.35), size: dr.axis === "x" ? [dr.lengthFt, 0.7, 0.7] : [0.7, 0.7, dr.lengthFt], rotation: [0, 0, 0] });
    } else {
      out.push({ id: `drain_${dr.id}`, kind: "drain", layer: "drainage", entityId: dr.id, material: "device", center: planToWorld(dr.x, dr.y, 0.04), size: [0.75, 0.08, 0.75], rotation: [0, 0, 0] });
      out.push({ id: `drainbody_${dr.id}`, kind: "drain", layer: "drainage", entityId: dr.id, material: "pipe", center: planToWorld(dr.x, dr.y, -dd.invertIn / 24), size: [0.5, dd.invertIn / 12, 0.5], rotation: [0, 0, 0] });
    }
    // Pipe segments along this drain's path, falling toward the outlet.
    let cum = 0;
    for (let i = 1; i < dd.path.length; i++) {
      const a = dd.path[i - 1];
      const b = dd.path[i];
      const L = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (L < 0.05) continue;
      const invStart = dd.invertIn + cum * model.drainage.slopeInPerFt;
      const invEnd = invStart + L * model.drainage.slopeInPerFt;
      const yMid = -((invStart + invEnd) / 2) / 12 - dia / 2;
      const horizontal = Math.abs(a.y - b.y) < 1e-9;
      out.push({ id: `pipe_${dr.id}_${i}`, kind: "pipe", layer: "drainage", entityId: "drainage", material: "pipe", center: planToWorld((a.x + b.x) / 2, (a.y + b.y) / 2, yMid), size: horizontal ? [L, dia, dia] : [dia, dia, L], rotation: [0, 0, 0] });
      cum += L;
    }
  }
  if (d.outlet) {
    // Stub through the wall, 2' outside, at the leaving invert.
    const o = d.outlet;
    const horizontalWall = o.wallId === "wall_ext_n" || o.wallId === "wall_ext_s";
    const dirY = o.wallId === "wall_ext_n" ? 1 : o.wallId === "wall_ext_s" ? -1 : 0;
    const dirX = o.wallId === "wall_ext_e" ? 1 : o.wallId === "wall_ext_w" ? -1 : 0;
    out.push({ id: "pipe_outlet", kind: "pipe", layer: "drainage", entityId: "drain_outlet", material: "pipe", center: planToWorld(o.x + dirX * 1.2, o.y + dirY * 1.2, -o.invertIn / 12 - dia / 2), size: horizontalWall ? [dia, dia, 2.4] : [2.4, dia, dia], rotation: [0, 0, 0] });
  }
  for (const [i, c] of d.cleanouts.entries()) out.push({ id: `cleanout_${i}`, kind: "drain", layer: "drainage", entityId: "drainage", material: "device", center: planToWorld(c.x, c.y, 0.03), size: [0.35, 0.06, 0.35], rotation: [0, 0, 0] });
  return out;
}
