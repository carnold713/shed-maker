import type { BuildingModel, Opening } from "@/lib/model/schema";
import { deriveFraming, freeSegments, openingSpans, roofParams, wallFrame, wallLocalToWorld, type FramingSet } from "@/lib/framing";
import { wallRotation, type WallFrame } from "@/lib/framing/wallFrame";
import { ROOF_PANEL_THICK_FT } from "@/lib/framing/roofMath";
import { SLIDING_LEAF_OVERLAP_FT, SLIDING_LEAF_STANDOFF_FT } from "@/lib/model/openings";
import { planToWorld } from "./frame";
import { derivePartitions } from "@/lib/interior/partitions";
import { zoneRect } from "@/lib/model/zones";
import type { BoxMember, Geometry, PolygonMember, Vec3 } from "./types";

export * from "./types";
export { planToWorld } from "./frame";
export { gableRiseFt } from "@/lib/framing/roofMath";

/** Siding thickness outside the wall line (steel rib), feet. */
export const SIDING_THICK_FT = 0.75 / 12;

/**
 * Derive renderable geometry for the building. Accepts a pre-computed
 * framing set so the caller can memoise both from the same model.
 */
export function deriveGeometry(model: BuildingModel, framing: FramingSet = deriveFraming(model)): Geometry {
  if (model.footprint.kind !== "rect") {
    throw new Error("Polygon footprints are not supported yet (P1)");
  }
  const { wFt: W, dFt: D } = model.footprint;
  const boxes: BoxMember[] = [];
  const polygons: PolygonMember[] = [];

  // ---- Slab
  if (model.foundation.slab.enabled) {
    const t = model.foundation.slab.thicknessIn / 12;
    boxes.push({ id: "slab", kind: "slab", layer: "slab", entityId: "foundation", material: "concrete", center: [W / 2, -t / 2, -D / 2], size: [W, t, D], rotation: [0, 0, 0] });
  }

  // ---- Framing members (already world-space boxes)
  for (const m of framing.members) {
    boxes.push({
      id: m.id,
      kind: "framing",
      layer: m.layer,
      entityId: m.id,
      ruleRef: m.ruleRef,
      material: m.kind === "footing" ? "concrete" : m.treatment === "none" ? "wood" : "ptWood",
      center: m.center,
      size: m.size,
      rotation: m.rotation,
    });
  }

  // ---- Wall skins (siding) with openings cut out
  for (const wall of model.walls) {
    if (wall.role !== "exterior") continue;
    const f = wallFrame(wall);
    const spans = openingSpans(model, wall.id);
    const H = wall.heightFt;
    const pieces = skinPieces(f.lengthFt, H, spans);
    for (const [i, p] of pieces.entries()) {
      boxes.push(skinBox(f, `skin_${wall.id}_${i}`, wall.id, p.u0, p.u1, p.h0, p.h1));
    }
    for (const s of spans) {
      const o = model.openings.find((x) => x.id === s.openingId)!;
      boxes.push(...openingGeometry(f, o));
    }
  }

  // ---- Roof on top of the trusses / purlins
  const rp = roofParams(model);
  const ridgeHeightFt = rp.ridgeHeightFt;
  const roofThick = ROOF_PANEL_THICK_FT;
  const halfSpan = rp.spanFt / 2;
  const along = rp.lengthFt + 2 * rp.ovG;
  const isShed = model.roof.form === "shed";
  // Shed high side is the west wall (ridge N–S) or the north wall (ridge E–W), ADR-0005.
  const planes: { from: number; to: number; sign: 1 | -1; id: string }[] = isShed
    ? [{ from: -rp.ovE, to: rp.spanFt + rp.ovE, sign: rp.ridgeNS ? -1 : 1, id: "roof_mono" }]
    : [
        { from: -rp.ovE, to: halfSpan, sign: 1, id: rp.ridgeNS ? "roof_w" : "roof_s" },
        { from: halfSpan, to: rp.spanFt + rp.ovE, sign: -1, id: rp.ridgeNS ? "roof_e" : "roof_n" },
      ];
  for (const pl of planes) {
    const slopeLen = (pl.to - pl.from) / Math.cos(rp.theta);
    const mid = (pl.from + pl.to) / 2;
    const distFromWall = pl.sign === 1 ? mid : rp.spanFt - mid;
    // Panel centreline sits half a panel above the purlin tops.
    const centerH = rp.datumAtWall + distFromWall * (rp.pitch / 12) + roofThick / 2 / Math.cos(rp.theta);
    const ang = pl.sign * rp.theta;
    boxes.push({
      id: pl.id,
      kind: "roofPlane",
      layer: "roofing",
      entityId: "roof",
      material: "roofing",
      center: rp.ridgeNS ? planToWorld(mid, rp.lengthFt / 2, centerH) : planToWorld(rp.lengthFt / 2, mid, centerH),
      size: rp.ridgeNS ? [slopeLen, roofThick, along] : [along, roofThick, slopeLen],
      rotation: rp.ridgeNS ? [0, 0, ang] : [ang, 0, 0],
    });
  }

  // ---- Gable-end infill above the eave on the gable walls (siding).
  if (!isShed) {
    const peak = rp.datumAtWall + gableRise(rp.spanFt, rp.pitch);
    const eaveTop = rp.datumAtWall;
    const H = model.eaveHeightFt;
    if (rp.ridgeNS) {
      polygons.push(
        gablePoly("gable_s", "wall_ext_s", [planToWorld(0, 0, H), planToWorld(W, 0, H), planToWorld(W, 0, eaveTop), planToWorld(W / 2, 0, peak), planToWorld(0, 0, eaveTop)]),
        gablePoly("gable_n", "wall_ext_n", [planToWorld(W, D, H), planToWorld(0, D, H), planToWorld(0, D, eaveTop), planToWorld(W / 2, D, peak), planToWorld(W, D, eaveTop)]),
      );
    } else {
      polygons.push(
        gablePoly("gable_w", "wall_ext_w", [planToWorld(0, D, H), planToWorld(0, 0, H), planToWorld(0, 0, eaveTop), planToWorld(0, D / 2, peak), planToWorld(0, D, eaveTop)]),
        gablePoly("gable_e", "wall_ext_e", [planToWorld(W, 0, H), planToWorld(W, D, H), planToWorld(W, D, eaveTop), planToWorld(W, D / 2, peak), planToWorld(W, 0, eaveTop)]),
      );
    }
  } else {
    // Shed roof: triangular infill on the two walls parallel to the slope.
    const highSide = rp.datumAtWall + rp.spanFt * (rp.pitch / 12);
    const H = model.eaveHeightFt;
    if (rp.ridgeNS) {
      polygons.push(
        gablePoly("gable_s", "wall_ext_s", [planToWorld(0, 0, H), planToWorld(W, 0, H), planToWorld(W, 0, rp.datumAtWall), planToWorld(0, 0, highSide)]),
        gablePoly("gable_n", "wall_ext_n", [planToWorld(W, D, H), planToWorld(0, D, H), planToWorld(0, D, highSide), planToWorld(W, D, rp.datumAtWall)]),
      );
    } else {
      polygons.push(
        gablePoly("gable_w", "wall_ext_w", [planToWorld(0, D, H), planToWorld(0, 0, H), planToWorld(0, 0, rp.datumAtWall), planToWorld(0, D, highSide)]),
        gablePoly("gable_e", "wall_ext_e", [planToWorld(W, 0, H), planToWorld(W, D, H), planToWorld(W, D, highSide), planToWorld(W, 0, rp.datumAtWall)]),
      );
    }
  }

  // ---- Interior: zone floors and partitions derived from zone edges (SPEC §5.3, §24)
  boxes.push(...interiorGeometry(model));

  const pad = Math.max(rp.ovE, rp.ovG) + 1;
  const embed = model.frame.post.foundation === "embedded" ? model.frame.post.embedIn / 12 : 0;
  return {
    boxes,
    polygons,
    bounds: { min: [-pad, -embed - 1, -D - pad], max: [W + pad, ridgeHeightFt + 1, pad] },
    ridgeHeightFt,
  };
}

function gableRise(spanFt: number, pitch: number) {
  return (spanFt / 2) * (pitch / 12);
}

function gablePoly(id: string, entityId: string, vertices: Vec3[]): PolygonMember {
  return { id, kind: "gableEnd", layer: "siding", entityId, material: "siding", vertices };
}

/** Rectangular pieces of a wall face not covered by openings (below sills, between, above heads). */
export function skinPieces(lengthFt: number, H: number, spans: ReturnType<typeof openingSpans>): { u0: number; u1: number; h0: number; h1: number }[] {
  // Horizontal bands split at every opening sill/head; within each band, free segments.
  const cuts = new Set<number>([0, H]);
  for (const s of spans) {
    cuts.add(Math.max(0, Math.min(H, s.h0)));
    cuts.add(Math.max(0, Math.min(H, s.h1)));
  }
  const levels = [...cuts].sort((a, b) => a - b);
  const out: { u0: number; u1: number; h0: number; h1: number }[] = [];
  for (let i = 0; i < levels.length - 1; i++) {
    const h0 = levels[i];
    const h1 = levels[i + 1];
    if (h1 - h0 < 1e-6) continue;
    for (const [u0, u1] of freeSegments(lengthFt, spans, h0, h1)) out.push({ u0, u1, h0, h1 });
  }
  // Merge vertically adjacent pieces with identical u-extents to keep the box count down.
  const merged: typeof out = [];
  for (const p of out.sort((a, b) => a.u0 - b.u0 || a.h0 - b.h0)) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.u0 - p.u0) < 1e-9 && Math.abs(last.u1 - p.u1) < 1e-9 && Math.abs(last.h1 - p.h0) < 1e-9) last.h1 = p.h1;
    else merged.push({ ...p });
  }
  return merged;
}

function skinBox(f: WallFrame, id: string, wallId: string, u0: number, u1: number, h0: number, h1: number): BoxMember {
  return {
    id,
    kind: "wallSkin",
    layer: "siding",
    entityId: wallId,
    material: "siding",
    center: wallLocalToWorld(f, (u0 + u1) / 2, (h0 + h1) / 2, SIDING_THICK_FT / 2),
    size: [u1 - u0, h1 - h0, SIDING_THICK_FT],
    rotation: wallRotation(f),
  };
}

/** Door leaves, frames, glazing for one opening, in the wall plane. */
function openingGeometry(f: WallFrame, o: Opening): BoxMember[] {
  const out: BoxMember[] = [];
  const u0 = o.offsetFt;
  const u1 = o.offsetFt + o.widthFt;
  const h0 = o.sillFt;
  const h1 = o.sillFt + o.heightFt;
  const jambT = 0.75 / 12;
  const frameD = 4.5 / 12; // jamb depth through the wall
  const mk = (id: string, kind: BoxMember["kind"], material: BoxMember["material"], a0: number, a1: number, b0: number, b1: number, n0: number, n1: number): BoxMember => ({
    id,
    kind,
    layer: "openings",
    entityId: o.id,
    material,
    center: wallLocalToWorld(f, (a0 + a1) / 2, (b0 + b1) / 2, (n0 + n1) / 2),
    size: [a1 - a0, b1 - b0, n1 - n0],
    rotation: wallRotation(f),
  });
  const kindFrame = o.type === "window" ? "windowFrame" : "doorFrame";
  // Jambs + head (frame)
  out.push(mk(`${o.id}_jamb_l`, kindFrame, "trim", u0, u0 + jambT, h0, h1, -frameD, SIDING_THICK_FT));
  out.push(mk(`${o.id}_jamb_r`, kindFrame, "trim", u1 - jambT, u1, h0, h1, -frameD, SIDING_THICK_FT));
  out.push(mk(`${o.id}_head`, kindFrame, "trim", u0, u1, h1 - jambT, h1, -frameD, SIDING_THICK_FT));
  if (o.type === "window") {
    out.push(mk(`${o.id}_sill`, kindFrame, "trim", u0, u1, h0, h0 + jambT, -frameD, SIDING_THICK_FT));
    out.push(mk(`${o.id}_glass`, "glazing", "glass", u0 + jambT, u1 - jambT, h0 + jambT, h1 - jambT, -frameD / 2 - 0.01, -frameD / 2 + 0.01));
    return out;
  }
  const leafT = o.type === "overheadDoor" ? 2 / 12 : 1.75 / 12;
  if (o.type === "slidingDoor" || o.type === "stallDoor") {
    // Exterior-hung leaf, wider than the opening, standing off the wall face (SPEC §19.3).
    const ov = SLIDING_LEAF_OVERLAP_FT;
    const n0 = SIDING_THICK_FT + SLIDING_LEAF_STANDOFF_FT;
    if (o.swing === "biParting") {
      const mid = (u0 + u1) / 2;
      out.push(mk(`${o.id}_leaf_l`, "doorLeaf", "door", u0 - ov, mid, 0.05, h1 + ov, n0, n0 + leafT));
      out.push(mk(`${o.id}_leaf_r`, "doorLeaf", "door", mid, u1 + ov, 0.05, h1 + ov, n0, n0 + leafT));
    } else {
      out.push(mk(`${o.id}_leaf`, "doorLeaf", "door", u0 - ov, u1 + ov, 0.05, h1 + ov, n0, n0 + leafT));
    }
    // Track above the opening.
    out.push(mk(`${o.id}_track`, "doorFrame", "trim", u0 - o.widthFt * (o.swing === "biParting" ? 0.5 : 1) - ov, u1 + (o.swing === "biParting" ? o.widthFt * 0.5 : 0) + ov, h1 + ov, h1 + ov + 0.2, SIDING_THICK_FT, n0 + leafT + 0.02));
    return out;
  }
  // Hinged / overhead leaves sit in the opening plane.
  const n0 = -frameD + 0.5 / 12;
  if (o.type === "doubleDoor") {
    const mid = (u0 + u1) / 2;
    out.push(mk(`${o.id}_leaf_l`, "doorLeaf", "door", u0 + jambT, mid, h0, h1 - jambT, n0, n0 + leafT));
    out.push(mk(`${o.id}_leaf_r`, "doorLeaf", "door", mid, u1 - jambT, h0, h1 - jambT, n0, n0 + leafT));
  } else if (o.type === "dutchDoor") {
    const split = h0 + (h1 - h0) * 0.5;
    out.push(mk(`${o.id}_leaf_bottom`, "doorLeaf", "door", u0 + jambT, u1 - jambT, h0, split - 0.01, n0, n0 + leafT));
    out.push(mk(`${o.id}_leaf_top`, "doorLeaf", "door", u0 + jambT, u1 - jambT, split + 0.01, h1 - jambT, n0, n0 + leafT));
  } else {
    out.push(mk(`${o.id}_leaf`, "doorLeaf", "door", u0 + jambT, u1 - jambT, h0, h1 - jambT, n0, n0 + leafT));
  }
  return out;
}

/** Partition thickness: 2×6 T&G kick-wall between posts ≈ 1½"; stud partitions 4½". */
const STALL_PARTITION_THICK_FT = 1.5 / 12;
const FULL_PARTITION_THICK_FT = 4.5 / 12;

export function interiorGeometry(model: BuildingModel): BoxMember[] {
  const out: BoxMember[] = [];
  // Floor tints per zone, a hair above the slab.
  for (const z of model.zones) {
    const r = zoneRect(z);
    const material: BoxMember["material"] = z.flooring === "concreteMats" ? "mats" : z.flooring === "gravel" ? "gravel" : z.flooring === "dirt" ? "dirt" : z.flooring === "wood" ? "floorWood" : "concrete";
    out.push({
      id: `floor_${z.id}`,
      kind: "floor",
      layer: "interior",
      entityId: z.id,
      material,
      center: planToWorld(r.x + r.w / 2, r.y + r.d / 2, 0.01),
      size: [r.w, 0.02, r.d],
      rotation: [0, 0, 0],
    });
  }
  for (const p of derivePartitions(model)) {
    const vertical = Math.abs(p.x1 - p.x0) < 1e-9; // runs along plan y
    const thick = p.kind === "full" ? FULL_PARTITION_THICK_FT : STALL_PARTITION_THICK_FT;
    const cx = (p.x0 + p.x1) / 2;
    const cy = (p.y0 + p.y1) / 2;
    // Split the length around doors.
    const segs: [number, number][] = [];
    let cursor = 0;
    for (const d of [...p.doors].sort((a, b) => a.u - b.u)) {
      if (d.u > cursor) segs.push([cursor, d.u]);
      cursor = d.u + d.widthFt;
    }
    if (cursor < p.lengthFt) segs.push([cursor, p.lengthFt]);
    const place = (u0: number, u1: number, h0: number, h1: number, kind: BoxMember["kind"], material: BoxMember["material"], suffix: string): BoxMember => {
      const mid = (u0 + u1) / 2;
      const x = vertical ? cx : p.x0 + mid;
      const y = vertical ? p.y0 + mid : cy;
      return {
        id: `${p.id}_${suffix}`,
        kind,
        layer: "interior",
        entityId: p.zones[0]?.id ?? p.zones[1]?.id ?? "interior",
        material,
        center: planToWorld(x, y, (h0 + h1) / 2),
        size: vertical ? [thick, h1 - h0, u1 - u0] : [u1 - u0, h1 - h0, thick],
        rotation: [0, 0, 0],
      };
    };
    for (const [i, [u0, u1]] of segs.entries()) {
      out.push(place(u0, u1, 0, p.kickFt, "partition", p.kind === "full" ? "wood" : "floorWood", `kick${i}`));
      if (p.topFt > p.kickFt + 1e-6) out.push(place(u0, u1, p.kickFt, p.topFt, "grille", "grille", `grille${i}`));
    }
    // Doors: sliding stall door leaf (solid to kick height, grille above), hung on the aisle side.
    for (const [i, d] of p.doors.entries()) {
      const leafW = d.widthFt + 0.25;
      const u0 = d.u - 0.125;
      const offsetN = thick / 2 + 0.05; // stands off the partition face
      const mid = u0 + leafW / 2;
      const x = vertical ? cx + offsetN : p.x0 + mid;
      const y = vertical ? p.y0 + mid : cy + offsetN;
      out.push({
        id: `${p.id}_door${i}`,
        kind: "stallDoor",
        layer: "interior",
        entityId: d.zoneId,
        material: "door",
        center: planToWorld(x, y, Math.min(p.topFt, 7) / 2),
        size: vertical ? [1.5 / 12, Math.min(p.topFt, 7), leafW] : [leafW, Math.min(p.topFt, 7), 1.5 / 12],
        rotation: [0, 0, 0],
      });
    }
  }
  return out;
}
