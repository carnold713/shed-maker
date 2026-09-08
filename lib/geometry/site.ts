/**
 * Runs and fences in 3D (ADR-0017): a grass patch per run, posts at the
 * preset spacing, rails or mesh between them by fence kind, and a steel
 * frame at each gate. World: x east, y up, z south (plan +y == world -z).
 */
import type { BuildingModel, Fence, Run } from "@/lib/model/schema";
import { FENCE_PRESETS, runEdges, type RunEdge } from "@/lib/model/runs";
import { fenceSegments } from "@/lib/model/fences";
import type { BoxMember, Vec3 } from "./types";

const POST_FT = 4 / 12;
const GATE_POST_FT = 6 / 12;

function box(id: string, kind: BoxMember["kind"], material: BoxMember["material"], entityId: string, center: Vec3, size: Vec3): BoxMember {
  return { id, kind, layer: "site", entityId, material, center, size, rotation: [0, 0, 0] };
}

/** Box along an edge from u0 to u1 (feet from the edge's west/south end) between heights h0 and h1, `t` thick. */
function alongEdge(e: RunEdge, id: string, kind: BoxMember["kind"], material: BoxMember["material"], entityId: string, u0: number, u1: number, h0: number, h1: number, t: number): BoxMember {
  const horizontal = e.side === "n" || e.side === "s";
  const x0 = Math.min(e.x0, e.x1);
  const y0 = Math.min(e.y0, e.y1);
  const len = u1 - u0;
  const h = (h0 + h1) / 2;
  return horizontal ? box(id, kind, material, entityId, [x0 + u0 + len / 2, h, -y0], [len, h1 - h0, t]) : box(id, kind, material, entityId, [x0, h, -(y0 + u0 + len / 2)], [t, h1 - h0, len]);
}

function post(e: RunEdge, id: string, entityId: string, u: number, h: number, size: number): BoxMember {
  const horizontal = e.side === "n" || e.side === "s";
  const x0 = Math.min(e.x0, e.x1);
  const y0 = Math.min(e.y0, e.y1);
  const c: Vec3 = horizontal ? [x0 + u, (h + 0.3) / 2, -y0] : [x0, (h + 0.3) / 2, -(y0 + u)];
  return box(id, "fencePost", "ptWood", entityId, c, [size, h + 0.3, size]);
}

function runGeometry(model: BuildingModel, r: Run): BoxMember[] {
  const out: BoxMember[] = [];
  const preset = FENCE_PRESETS[r.fence.kind];
  const h = r.fence.heightFt;
  // Ground patch just above the ground plane.
  out.push(box(`ground_${r.id}`, "ground", "grass", r.id, [r.rect.x + r.rect.w / 2, 0.02, -(r.rect.y + r.rect.d / 2)], [r.rect.w, 0.04, r.rect.d]));
  for (const e of runEdges(model, r)) {
    if (e.onBuilding) continue;
    const gates = r.gates.filter((g) => g.side === e.side).sort((a, b) => a.offsetFt - b.offsetFt);
    // Posts: both ends and every spacing between; gate posts heavier at each gate jamb.
    const n = Math.max(1, Math.ceil(e.lengthFt / preset.postSpacingFt));
    for (let i = 0; i <= n; i++) {
      const u = Math.min(e.lengthFt, (i * e.lengthFt) / n);
      if (gates.some((g) => u > g.offsetFt - 0.2 && u < g.offsetFt + g.widthFt + 0.2)) continue;
      out.push(post(e, `post_${r.id}_${e.side}_${i}`, r.id, u, h, POST_FT));
    }
    for (const g of gates) {
      out.push(post(e, `gpost_${r.id}_${g.id}_a`, r.id, g.offsetFt, h + 0.3, GATE_POST_FT));
      out.push(post(e, `gpost_${r.id}_${g.id}_b`, r.id, g.offsetFt + g.widthFt, h + 0.3, GATE_POST_FT));
      // Gate: a steel tube frame set a little off the ground.
      out.push(alongEdge(e, `gate_${r.id}_${g.id}`, "gate", "steel", r.id, g.offsetFt + 0.1, g.offsetFt + g.widthFt - 0.1, 0.3, Math.min(h, 5) , 0.12));
    }
    // Infill between gates.
    const spans: [number, number][] = [];
    let c = 0;
    for (const g of gates) {
      if (g.offsetFt > c + 0.05) spans.push([c, g.offsetFt]);
      c = g.offsetFt + g.widthFt;
    }
    if (e.lengthFt > c + 0.05) spans.push([c, e.lengthFt]);
    spans.forEach(([u0, u1], k) => {
      const id = `fence_${r.id}_${e.side}_${k}`;
      if (preset.material === "board") {
        const rails = preset.rails ?? 3;
        for (let i = 0; i < rails; i++) {
          const top = h - 0.15 - i * ((h - 1) / (rails - 1 || 1)) * 0.85;
          out.push(alongEdge(e, `${id}_rail${i}`, "fenceRail", "ptWood", r.id, u0, u1, top - 0.46, top, 0.125));
        }
      } else if (preset.material === "strand") {
        const strands = preset.rails ?? 5;
        for (let i = 0; i < strands; i++) {
          const y = 0.8 + ((h - 0.8) * i) / Math.max(1, strands - 1);
          out.push(alongEdge(e, `${id}_strand${i}`, "fenceRail", "wire", r.id, u0, u1, y - 0.02, y + 0.02, 0.04));
        }
      } else if (r.fence.kind === "pipePanel") {
        for (let i = 0; i < 5; i++) {
          const y = 0.9 + ((h - 0.9) * i) / 4;
          out.push(alongEdge(e, `${id}_rail${i}`, "fenceRail", "steel", r.id, u0, u1, y - 0.08, y + 0.08, 0.16));
        }
      } else {
        // Woven, welded, chain link, hardware cloth: a translucent mesh panel.
        out.push(alongEdge(e, `${id}_mesh`, "fencePanel", "mesh", r.id, u0, u1, 0.1, h, 0.03));
      }
      if (r.fence.topRail && preset.material !== "board") out.push(alongEdge(e, `${id}_top`, "fenceRail", "ptWood", r.id, u0, u1, h - 0.46, h, 0.125));
    });
  }
  return out;
}

/** A box along a straight fence segment at any angle: centre at the midpoint, length along the run, yaw from the plan angle. */
function alongSeg(seg: { a: { x: number; y: number }; b: { x: number; y: number }; lengthFt: number; angle: number }, id: string, kind: BoxMember["kind"], material: BoxMember["material"], entityId: string, t0: number, t1: number, h0: number, h1: number, t: number): BoxMember {
  const u0 = t0 / seg.lengthFt;
  const u1 = t1 / seg.lengthFt;
  const mx = seg.a.x + (seg.b.x - seg.a.x) * ((u0 + u1) / 2);
  const my = seg.a.y + (seg.b.y - seg.a.y) * ((u0 + u1) / 2);
  return { id, kind, layer: "site", entityId, material, center: [mx, (h0 + h1) / 2, -my], size: [t1 - t0, h1 - h0, t], rotation: [0, seg.angle, 0] };
}

function fenceGeometry(f: Fence): BoxMember[] {
  const out: BoxMember[] = [];
  const preset = FENCE_PRESETS[f.kind];
  const h = f.heightFt;
  const postAt = (p: { x: number; y: number }, id: string, size: number, hh: number) => box(id, "fencePost", "ptWood", f.id, [p.x, (hh + 0.3) / 2, -p.y], [size, hh + 0.3, size]);
  f.points.forEach((p, i) => out.push(postAt(p, `fpost_${f.id}_c${i}`, POST_FT * 1.25, h)));
  for (const seg of fenceSegments(f)) {
    const gates = f.gates.filter((g) => g.seg === seg.i).sort((a, b) => a.offsetFt - b.offsetFt);
    const n = Math.max(1, Math.ceil(seg.lengthFt / preset.postSpacingFt));
    for (let i = 1; i < n; i++) {
      const u = (i * seg.lengthFt) / n;
      if (gates.some((g) => u > g.offsetFt - 0.2 && u < g.offsetFt + g.widthFt + 0.2)) continue;
      out.push(postAt({ x: seg.a.x + (seg.b.x - seg.a.x) * (u / seg.lengthFt), y: seg.a.y + (seg.b.y - seg.a.y) * (u / seg.lengthFt) }, `fpost_${f.id}_${seg.i}_${i}`, POST_FT, h));
    }
    for (const g of gates) {
      const at = (u: number) => ({ x: seg.a.x + (seg.b.x - seg.a.x) * (u / seg.lengthFt), y: seg.a.y + (seg.b.y - seg.a.y) * (u / seg.lengthFt) });
      out.push(postAt(at(g.offsetFt), `fgpost_${f.id}_${g.id}_a`, GATE_POST_FT, h + 0.3));
      out.push(postAt(at(g.offsetFt + g.widthFt), `fgpost_${f.id}_${g.id}_b`, GATE_POST_FT, h + 0.3));
      out.push(alongSeg(seg, `fgate_${f.id}_${g.id}`, "gate", "steel", f.id, g.offsetFt + 0.1, g.offsetFt + g.widthFt - 0.1, 0.3, Math.min(h, 5), 0.12));
    }
    const spans: [number, number][] = [];
    let c = 0;
    for (const g of gates) {
      if (g.offsetFt > c + 0.05) spans.push([c, g.offsetFt]);
      c = g.offsetFt + g.widthFt;
    }
    if (seg.lengthFt > c + 0.05) spans.push([c, seg.lengthFt]);
    spans.forEach(([u0, u1], k) => {
      const id = `ffence_${f.id}_${seg.i}_${k}`;
      if (preset.material === "board") {
        const rails = preset.rails ?? 3;
        for (let i = 0; i < rails; i++) {
          const top = h - 0.15 - i * ((h - 1) / (rails - 1 || 1)) * 0.85;
          out.push(alongSeg(seg, `${id}_rail${i}`, "fenceRail", "ptWood", f.id, u0, u1, top - 0.46, top, 0.125));
        }
      } else if (preset.material === "strand") {
        const strands = preset.rails ?? 5;
        for (let i = 0; i < strands; i++) {
          const y = 0.8 + ((h - 0.8) * i) / Math.max(1, strands - 1);
          out.push(alongSeg(seg, `${id}_strand${i}`, "fenceRail", "wire", f.id, u0, u1, y - 0.02, y + 0.02, 0.04));
        }
      } else if (f.kind === "pipePanel") {
        for (let i = 0; i < 5; i++) {
          const y = 0.9 + ((h - 0.9) * i) / 4;
          out.push(alongSeg(seg, `${id}_rail${i}`, "fenceRail", "steel", f.id, u0, u1, y - 0.08, y + 0.08, 0.16));
        }
      } else out.push(alongSeg(seg, `${id}_mesh`, "fencePanel", "mesh", f.id, u0, u1, 0.1, h, 0.03));
      if (f.topRail && preset.material !== "board") out.push(alongSeg(seg, `${id}_top`, "fenceRail", "ptWood", f.id, u0, u1, h - 0.46, h, 0.125));
    });
  }
  return out;
}

export function siteGeometry(model: BuildingModel): BoxMember[] {
  if (model.footprint.kind !== "rect" || (model.runs.length === 0 && model.fences.length === 0)) return [];
  return [...model.runs.flatMap((r) => runGeometry(model, r)), ...model.fences.flatMap(fenceGeometry)];
}
