import type { BuildingModel, Opening } from "@/lib/model/schema";
import { deriveFraming, freeSegments, openingSpans, roofParams, wallFrame, wallLocalToWorld, type FramingSet } from "@/lib/framing";
import { wallRotation, type WallFrame } from "@/lib/framing/wallFrame";
import { ROOF_PANEL_THICK_FT } from "@/lib/framing/roofMath";
import { SLIDING_LEAF_OVERLAP_FT, SLIDING_LEAF_STANDOFF_FT, needsApron } from "@/lib/model/openings";
import { leanToHeights, leanToSpan } from "@/lib/model/leanTos";
import { planToWorld, eulerYX } from "./frame";
import { derivePartitions } from "@/lib/interior/partitions";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";
import { electricalGeometry } from "./electrical";
import { drainageGeometry } from "./drainage";
import { siteGeometry } from "./site";
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

  // ---- Slab, gravel base, lean-to pads, aprons (SPEC §4.3, §4.8). Finished floor is y = 0; grade is below it.
  if (model.foundation.slab.enabled) {
    const t = model.foundation.slab.thicknessIn / 12;
    const g = model.foundation.slab.gravelBaseIn / 12;
    boxes.push({ id: "slab", kind: "slab", layer: "slab", entityId: "foundation", material: "concrete", center: [W / 2, -t / 2, -D / 2], size: [W, t, D], rotation: [0, 0, 0] });
    boxes.push({ id: "gravel", kind: "gravel", layer: "slab", entityId: "foundation", material: "gravel", center: [W / 2, -t - g / 2, -D / 2], size: [W + 1, g, D + 1], rotation: [0, 0, 0] });
    for (const lt of model.leanTos) {
      if (!lt.slab) continue;
      const span = leanToSpan(model, lt);
      const wall = model.walls.find((w) => w.id === span.wallId);
      if (!wall) continue;
      const f = wallFrame(wall);
      boxes.push({ id: `slab_${lt.id}`, kind: "slab", layer: "slab", entityId: lt.id, material: "concrete", center: wallLocalToWorld(f, (span.u0 + span.u1) / 2, -t / 2, lt.depthFt / 2), size: [span.lengthFt, t, lt.depthFt], rotation: wallRotation(f) });
    }
    if (model.foundation.slab.aprons) {
      for (const o of model.openings) {
        if (!needsApron(o.type)) continue;
        const wall = model.walls.find((w) => w.id === o.wallId);
        if (!wall || wall.role !== "exterior") continue;
        // Skip if a lean-to pad already covers this wall.
        if (model.leanTos.some((lt) => lt.slab && leanToSpan(model, lt).wallId === wall.id)) continue;
        const f = wallFrame(wall);
        const depth = model.foundation.slab.apronDepthFt;
        const aw = o.widthFt + 2;
        boxes.push({ id: `apron_${o.id}`, kind: "apron", layer: "slab", entityId: o.id, material: "concrete", center: wallLocalToWorld(f, o.offsetFt + o.widthFt / 2, -t / 2 - 0.02, depth / 2), size: [aw, t, depth], rotation: wallRotation(f) });
      }
    }
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
  boxes.push(...electricalGeometry(model));
  boxes.push(...drainageGeometry(model));
  boxes.push(...siteGeometry(model));

  // ---- Lean-tos: roof plane, enclosure skins
  for (const lt of model.leanTos) {
    const span = leanToSpan(model, lt);
    const wall = model.walls.find((w) => w.id === span.wallId);
    if (!wall) continue;
    const f = wallFrame(wall);
    const { highFt, lowFt, theta } = leanToHeights(model, lt);
    const purlinTop = 3.5 / 12 / Math.cos(theta); // 2×4 purlins on edge over the rafters
    const ov = 1; // 12" overhang at the low edge
    const run = lt.depthFt + ov;
    const slopeLen = run / Math.cos(theta);
    const hMid = (highFt + (lowFt - ov * (lt.pitch / 12))) / 2 + purlinTop + roofThick / 2 / Math.cos(theta);
    boxes.push({
      id: `ltroof_${lt.id}`,
      kind: "roofPlane",
      layer: "roofing",
      entityId: lt.id,
      material: "roofing",
      center: wallLocalToWorld(f, (span.u0 + span.u1) / 2, hMid, run / 2),
      size: [span.lengthFt + 2 * 0.5, roofThick, slopeLen],
      rotation: eulerYX(wallRotation(f)[1], theta),
    });
    if (lt.enclosed) {
      const t = SIDING_THICK_FT;
      const D = lt.depthFt;
      const postTop = lowFt - 9.25 / 12;
      // Outer wall skin (full span) and two end skins, siding outside the posts.
      boxes.push({ id: `ltskin_${lt.id}_out`, kind: "leanToSkin", layer: "siding", entityId: lt.id, material: "siding", center: wallLocalToWorld(f, (span.u0 + span.u1) / 2, lowFt / 2, D + t / 2), size: [span.lengthFt, lowFt, t], rotation: wallRotation(f) });
      for (const [k, u] of [span.u0, span.u1].entries()) {
        const n0 = 0;
        const n1 = D;
        const hAvg = (highFt + lowFt) / 2;
        // End wall is a trapezoid: approximate with a box to the low height plus a sloped-top box is P1; use average height.
        boxes.push({ id: `ltskin_${lt.id}_end${k}`, kind: "leanToSkin", layer: "siding", entityId: lt.id, material: "siding", center: wallLocalToWorld(f, u + (k === 0 ? -t / 2 : t / 2), hAvg / 2, (n0 + n1) / 2), size: [t, hAvg, n1 - n0], rotation: wallRotation(f) });
      }
      void postTop;
    }
  }

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
  if (o.type === "rollUpDoor") {
    // Coil housing above the opening on the inside face, curtain in the opening plane.
    const n0 = -frameD + 0.5 / 12;
    out.push(mk(`${o.id}_leaf`, "doorLeaf", "door", u0 + jambT, u1 - jambT, h0, h1 - jambT, n0, n0 + 1 / 12));
    out.push(mk(`${o.id}_coil`, "coil", "trim", u0 - 0.5, u1 + 0.5, h1, h1 + 1.25, -frameD - 1.25, -frameD));
    return out;
  }
  // Hinged / overhead leaves sit in the opening plane.
  const n0 = -frameD + 0.5 / 12;
  if (o.type === "manDoor" && o.variant === "halfLight") {
    const split = h0 + (h1 - h0) * 0.55;
    out.push(mk(`${o.id}_leaf`, "doorLeaf", "door", u0 + jambT, u1 - jambT, h0, split, n0, n0 + leafT));
    out.push(mk(`${o.id}_leaf_top`, "doorLeaf", "door", u0 + jambT, u1 - jambT, split, h1 - jambT, n0, n0 + leafT));
    out.push(mk(`${o.id}_glass`, "glazing", "glass", u0 + jambT + 0.3, u1 - jambT - 0.3, split + 0.25, h1 - jambT - 0.3, n0 + leafT, n0 + leafT + 0.01));
  } else if (o.type === "doubleDoor") {
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

/** Finished-floor build-up over the slab by flooring type, feet. */
const FLOOR_THICKNESS_FT: Record<string, number> = { concreteMats: 0.75 / 12, wood: 1.5 / 12, gravel: 1 / 12, dirt: 1 / 12, concrete: 0.5 / 12 };

/** Partition thickness: 2×6 T&G kick-wall between posts ≈ 1½"; stud partitions 4½". */
const STALL_PARTITION_THICK_FT = 1.5 / 12;
const FULL_PARTITION_THICK_FT = 4.5 / 12;

export function interiorGeometry(model: BuildingModel): BoxMember[] {
  const out: BoxMember[] = [];
  // Zone floors sit ON the slab at their real thickness (¾" rubber mats,
  // 1½" T&G wood, a 1" wearing course for gravel / dirt). A paper-thin tint
  // coplanar with the slab z-fights at any distance; a concrete "floor" is
  // the slab itself and only needs a thin pick target.
  for (const z of model.zones) {
    const r = zoneRect(z);
    const material: BoxMember["material"] = z.flooring === "concreteMats" ? "mats" : z.flooring === "gravel" ? "gravel" : z.flooring === "dirt" ? "dirt" : z.flooring === "wood" ? "floorWood" : "concrete";
    const thick = FLOOR_THICKNESS_FT[z.flooring] ?? 0.0625;
    out.push({
      id: `floor_${z.id}`,
      kind: "floor",
      layer: "interior",
      entityId: z.id,
      material,
      center: planToWorld(r.x + r.w / 2, r.y + r.d / 2, thick / 2),
      size: [r.w, thick, r.d],
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
    // Doors by type (ADR-0014). Local frame: u along the partition, n across it
    // (+n toward the higher-coordinate side), h up.
    const placeN = (u0: number, u1: number, h0: number, h1: number, n: number, t: number, kind: BoxMember["kind"], material: BoxMember["material"], suffix: string, entityId: string): BoxMember => {
      const mid = (u0 + u1) / 2;
      const x = vertical ? cx + n : p.x0 + mid;
      const y = vertical ? p.y0 + mid : cy + n;
      return {
        id: `${p.id}_${suffix}`,
        kind,
        layer: "interior",
        entityId,
        material,
        center: planToWorld(x, y, (h0 + h1) / 2),
        size: vertical ? [t, h1 - h0, u1 - u0] : [u1 - u0, h1 - h0, t],
        rotation: [0, 0, 0],
      };
    };
    for (const [i, d] of p.doors.entries()) {
      const preset = INTERIOR_DOOR_PRESETS[d.type];
      const entity = d.auto ? d.zoneId : d.id;
      const h = Math.min(d.heightFt, p.topFt + 1);
      const u0 = d.u;
      const u1 = d.u + d.widthFt;
      const kick = Math.min(p.kickFt, h - 0.5);
      if (preset.leaf === "none") {
        if (p.kind === "full") out.push(placeN(u0 - 0.1, u1 + 0.1, h, Math.min(p.topFt, h + 0.6), 0, thick, "partition", "wood", `head${i}`, entity));
        continue;
      }
      if (!preset.hinged) {
        // Sliding leaf hangs on the aisle side and overlaps the jambs; track runs twice the width in the slide direction.
        const aisle = -d.zoneSide;
        const n = aisle * (thick / 2 + 0.06);
        const leaf0 = u0 - 0.125;
        const leaf1 = u1 + 0.125;
        if (preset.leaf === "solid") out.push(placeN(leaf0, leaf1, 0.1, h, n, 1.5 / 12, "stallDoor", "wood", `door${i}`, entity));
        else {
          out.push(placeN(leaf0, leaf1, 0.1, kick, n, 1.5 / 12, "stallDoor", "floorWood", `door${i}`, entity));
          if (h > kick + 0.05) out.push(placeN(leaf0, leaf1, kick, h, n, 1.5 / 12, "stallDoor", "grille", `doorTop${i}`, entity));
        }
        const trackLen = Math.min(p.lengthFt, d.widthFt * 2 + 0.25);
        const right = d.swing !== "slideLeft";
        const t0 = right ? Math.min(leaf0, p.lengthFt - trackLen) : Math.max(0, leaf1 - trackLen);
        out.push(placeN(t0, t0 + trackLen, h + 0.05, h + 0.3, n, 0.2, "track", "grille", `track${i}`, entity));
        continue;
      }
      if (preset.leaf === "stall") {
        // Hinged stall / Dutch door in the plane of the partition: solid to kick height, grille above.
        const gap = d.type === "dutch" ? 0.08 : 0;
        out.push(placeN(u0 + 0.05, u1 - 0.05, 0.1, kick - gap / 2, 0, 1.5 / 12, "stallDoor", "floorWood", `door${i}`, entity));
        if (h > kick + 0.05) out.push(placeN(u0 + 0.05, u1 - 0.05, kick + gap / 2, h, 0, 1.5 / 12, "stallDoor", "grille", `doorTop${i}`, entity));
        continue;
      }
      // Solid pre-hung wood / steel door with jambs and a head casing.
      out.push(placeN(u0 + 0.06, u1 - 0.06, 0.05, h - 0.05, 0, 1.375 / 12, "stallDoor", d.type === "manDoor" ? "door" : "wood", `door${i}`, entity));
      out.push(placeN(u0 - 0.06, u0 + 0.06, 0, h + 0.12, 0, thick + 0.08, "partition", "trim", `jambL${i}`, entity));
      out.push(placeN(u1 - 0.06, u1 + 0.06, 0, h + 0.12, 0, thick + 0.08, "partition", "trim", `jambR${i}`, entity));
      out.push(placeN(u0 - 0.06, u1 + 0.06, h, h + 0.12, 0, thick + 0.08, "partition", "trim", `head${i}`, entity));
    }
  }
  return out;
}
