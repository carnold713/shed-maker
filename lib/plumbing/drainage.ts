/**
 * Floor drainage derivation (ADR-0016): from placed drains and an outlet,
 * work out where the slab slopes, the under-slab pipe network, its fall and
 * inverts, where cleanouts go, and whether the outlet can daylight. Pure.
 *
 * Basis: IPC 2021 704.1 (horizontal drain slope: ¼"/ft ≤ 2½", ⅛"/ft 3"–6"),
 * 708.1 (cleanouts at the upstream end, at changes of direction > 45°,
 * every 100'), 1002.1/1002.4 (every drain trapped; trap primer or deep
 * seal where it may dry), 412 (floor drains); barn floors ⅛"–¼" per ft to
 * drains, wash racks ¼"/ft (MWPS-1, extension guidance).
 */
import type { BuildingModel, Drain, Zone } from "@/lib/model/schema";
import { zoneRect, type Rect } from "@/lib/model/zones";
import { DRAIN_PRESETS, outletPoint, zoneAt } from "@/lib/model/drainage";

export interface Pt {
  x: number;
  y: number;
}

export interface DrainDerived {
  drain: Drain;
  zone: Zone | null;
  /** Area of slab that slopes to this drain. */
  catchment: Rect;
  /** Slab slope in that area, inches per foot. */
  slabSlopeInPerFt: number;
  /** Farthest point of the catchment from the drain, feet, and the rise there. */
  farthestFt: number;
  highPointIn: number;
  /** Pipe invert at the drain, inches below the finished floor (positive down). */
  invertIn: number;
  /** Pipe path from this drain to the outlet and its length. */
  path: Pt[];
  runFt: number;
}

export interface Cleanout {
  x: number;
  y: number;
  why: "head" | "bend" | "distance";
}

export interface DrainageDerived {
  drains: DrainDerived[];
  outlet: {
    x: number;
    y: number;
    wallId: string;
    kind: BuildingModel["drainage"]["outlet"] extends infer O ? (O extends { kind: infer K } ? K : never) : never;
    /** Pipe invert leaving the building, inches below the finished floor. */
    invertIn: number;
    /** Ground surface at the outlet point, inches below the finished floor. */
    groundIn: number;
    /** Extra ground fall needed to daylight the pipe with its crown clear, inches (0 = fine). */
    fallNeededIn: number;
    daylightOk: boolean;
  } | null;
  /** Every pipe segment once (trunk + laterals), for drawing and takeoff. */
  segments: { a: Pt; b: Pt }[];
  pipe: { diaIn: number; totalFt: number; bends: number; slopeInPerFt: number };
  cleanouts: Cleanout[];
  /** What the concrete crew needs to know, in order. */
  notes: string[];
}

const CATCHMENT_HALF_FT = 12; // a lone drain serves a 24' × 24' area
const WASH_SLOPE = 0.25;
const FLOOR_SLOPE = 0.125;
const CROWN_CLEAR_IN = 2; // pipe crown clear of the ground at a daylight outlet

function manhattan(a: Pt, b: Pt) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
function len(p: Pt[]) {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += manhattan(p[i - 1], p[i]);
  return s;
}
function dedupe(p: Pt[]) {
  return p.filter((q, i) => i === 0 || manhattan(q, p[i - 1]) > 1e-9);
}

/** Path from a drain to the outlet: the leg perpendicular to the outlet wall comes last, so the pipe leaves square through the wall. */
function pathToOutlet(from: Pt, outlet: { x: number; y: number; wallId: string }): Pt[] {
  const wallIsNS = outlet.wallId === "wall_ext_n" || outlet.wallId === "wall_ext_s";
  return dedupe(wallIsNS ? [from, { x: outlet.x, y: from.y }, { x: outlet.x, y: outlet.y }] : [from, { x: from.x, y: outlet.y }, { x: outlet.x, y: outlet.y }]);
}

/** Nearest point on an axis-aligned polyline, and the path from `from` to it (straight when perpendicular, else an L). */
function joinTo(from: Pt, poly: Pt[]): { path: Pt[]; join: Pt; along: number } | null {
  let best: { path: Pt[]; join: Pt; along: number; d: number } | null = null;
  let cum = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const horizontal = Math.abs(a.y - b.y) < 1e-9;
    const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
    const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
    const c = horizontal ? from.x : from.y;
    let join: Pt;
    let path: Pt[];
    if (c >= lo - 1e-9 && c <= hi + 1e-9) {
      join = horizontal ? { x: from.x, y: a.y } : { x: a.x, y: from.y };
      path = [from, join];
    } else {
      const end = (horizontal ? Math.abs(c - a.x) < Math.abs(c - b.x) : Math.abs(c - a.y) < Math.abs(c - b.y)) ? a : b;
      join = end;
      path = horizontal ? [from, { x: end.x, y: from.y }, end] : [from, { x: from.x, y: end.y }, end];
    }
    const d = len(path);
    const along = cum + manhattan(a, join);
    if (!best || d < best.d) best = { path: dedupe(path), join, along, d };
    cum += manhattan(a, b);
  }
  return best;
}

export function deriveDrainage(model: BuildingModel): DrainageDerived {
  const dr = model.drainage;
  const fp = model.footprint.kind === "rect" ? model.footprint : { wFt: 24, dFt: 36 };
  const slope = dr.slopeInPerFt;
  const out = outletPoint(model);
  const notes: string[] = [];

  // ---- Network: trunk from the farthest drain, laterals joining the trunk.
  const ordered = out ? [...dr.drains].sort((a, b) => manhattan(b, out) - manhattan(a, out)) : dr.drains.slice();
  const paths = new Map<string, Pt[]>();
  const segments: { a: Pt; b: Pt }[] = [];
  let trunk: Pt[] = [];
  let bends = 0;
  if (out && ordered.length) {
    trunk = pathToOutlet({ x: ordered[0].x, y: ordered[0].y }, out);
    paths.set(ordered[0].id, trunk);
    for (let i = 1; i < trunk.length; i++) segments.push({ a: trunk[i - 1], b: trunk[i] });
    bends += Math.max(0, trunk.length - 2);
    for (const d of ordered.slice(1)) {
      const j = joinTo({ x: d.x, y: d.y }, trunk);
      if (!j) continue;
      for (let i = 1; i < j.path.length; i++) segments.push({ a: j.path[i - 1], b: j.path[i] });
      bends += Math.max(0, j.path.length - 2) + 1; // the tee counts as a change of direction
      // Full path to the outlet = lateral + trunk from the join point.
      let cum = 0;
      const rest: Pt[] = [];
      for (let i = 1; i < trunk.length; i++) {
        const a = trunk[i - 1];
        const b = trunk[i];
        const segLen = manhattan(a, b);
        if (cum + segLen >= j.along - 1e-9 && rest.length === 0) rest.push(j.join);
        if (rest.length) rest.push(b);
        cum += segLen;
      }
      paths.set(d.id, dedupe([...j.path, ...rest.slice(1)]));
    }
  }

  // ---- Per-drain figures.
  const drains: DrainDerived[] = dr.drains.map((d) => {
    const zone = zoneAt(model, d.x, d.y);
    const catchment: Rect = zone ? zoneRect(zone) : { x: Math.max(0, d.x - CATCHMENT_HALF_FT), y: Math.max(0, d.y - CATCHMENT_HALF_FT), w: Math.min(fp.wFt, d.x + CATCHMENT_HALF_FT) - Math.max(0, d.x - CATCHMENT_HALF_FT), d: Math.min(fp.dFt, d.y + CATCHMENT_HALF_FT) - Math.max(0, d.y - CATCHMENT_HALF_FT) };
    const corners = [
      { x: catchment.x, y: catchment.y },
      { x: catchment.x + catchment.w, y: catchment.y },
      { x: catchment.x, y: catchment.y + catchment.d },
      { x: catchment.x + catchment.w, y: catchment.y + catchment.d },
    ];
    // Distance from the drain (a trench drains along its whole length, so measure to the channel).
    const half = d.kind === "trench" ? d.lengthFt / 2 : 0;
    const dist = (p: Pt) => (d.kind === "trench" ? (d.axis === "x" ? Math.hypot(Math.max(0, Math.abs(p.x - d.x) - half), p.y - d.y) : Math.hypot(p.x - d.x, Math.max(0, Math.abs(p.y - d.y) - half))) : Math.hypot(p.x - d.x, p.y - d.y));
    const farthestFt = Math.max(...corners.map(dist));
    const slabSlope = zone?.type === "wash" || d.kind === "trench" ? WASH_SLOPE : FLOOR_SLOPE;
    const path = paths.get(d.id) ?? [];
    return {
      drain: d,
      zone,
      catchment,
      slabSlopeInPerFt: slabSlope,
      farthestFt: +farthestFt.toFixed(1),
      highPointIn: +(farthestFt * slabSlope).toFixed(2),
      invertIn: DRAIN_PRESETS[d.kind].trapDepthIn,
      path,
      runFt: +len(path).toFixed(1),
    };
  });

  // ---- Outlet invert: set by the deepest arrival.
  let outlet: DrainageDerived["outlet"] = null;
  if (out && dr.outlet) {
    const invertIn = drains.length ? Math.max(...drains.map((d) => d.invertIn + d.runFt * slope)) : DRAIN_PRESETS.floor.trapDepthIn;
    const groundIn = model.foundation.slab.aboveGradeIn + dr.siteFallIn;
    const needed = dr.outlet.kind === "daylight" ? Math.max(0, invertIn + dr.pipeDiaIn + CROWN_CLEAR_IN - groundIn) : 0;
    outlet = { x: out.x, y: out.y, wallId: out.wallId, kind: dr.outlet.kind, invertIn: +invertIn.toFixed(1), groundIn, fallNeededIn: +needed.toFixed(1), daylightOk: needed <= 0 };
  }

  // ---- Cleanouts: head of the trunk, each 90° bend, every 100'.
  const cleanouts: Cleanout[] = [];
  if (trunk.length) {
    cleanouts.push({ x: trunk[0].x, y: trunk[0].y, why: "head" });
    for (let i = 1; i < trunk.length - 1; i++) cleanouts.push({ x: trunk[i].x, y: trunk[i].y, why: "bend" });
    const total = len(trunk);
    for (let s = 100; s < total; s += 100) {
      let cum = 0;
      for (let i = 1; i < trunk.length; i++) {
        const a = trunk[i - 1];
        const b = trunk[i];
        const L = manhattan(a, b);
        if (cum + L >= s) {
          const t = (s - cum) / L;
          cleanouts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, why: "distance" });
          break;
        }
        cum += L;
      }
    }
  }

  const totalFt = segments.reduce((s, g) => s + manhattan(g.a, g.b), 0);

  // ---- Notes for the concrete crew.
  if (drains.length) {
    notes.push(`Set every drain body and trench channel on rebar chairs at the finished-floor line (grate frame ⅛" below the slab surface) and pour it in with the slab; keep concrete out of the pipe.`);
    notes.push(`Slope the slab to each drain: ${WASH_SLOPE * 8}/8" per foot in wash bays, ${FLOOR_SLOPE * 8}/8" per foot elsewhere — screed from the high points listed in the schedule. No slope inside stalls: stalls stay flat and drain to the aisle.`);
    notes.push(`Under-slab pipe: ${dr.pipeDiaIn}" PVC (Sch 40 inside, SDR 35 outside) at ${dr.slopeInPerFt * 8}/8" per foot, bedded on 4" of ¾" gravel and covered before the pour; sleeve it through the thickened edge; keep 3' clear of post footings.`);
    notes.push(`Every drain is trapped (deep-seal or with a trap primer so it never dries out); sediment buckets in wash-bay drains; a cleanout at the head of the run, at every bend, and every 100'.`);
    if (outlet?.kind === "daylight") notes.push(outlet.daylightOk ? `The pipe leaves ${outlet.invertIn}" below the floor and ends on the ground ${dr.siteFallIn}" downhill with a rodent screen and a splash pad.` : `The pipe leaves ${outlet.invertIn}" below the floor but the ground at the outlet is only ${outlet.groundIn}" lower — it needs ${outlet.fallNeededIn}" more fall to daylight. Run it further downhill, raise the pad, or use a dry well.`);
    if (outlet?.kind === "dryWell") notes.push(`Dry well 10' from the building: a 4' × 4' pit with 2' of clean stone under a perforated barrel, filter fabric over the stone; size it to the wash volume and check the soil percolates.`);
    if (outlet?.kind === "septic" || outlet?.kind === "storm") notes.push(`Wash water carries manure and hair: most counties will not accept it in a storm drain and a septic tank needs a hair / sediment interceptor. Confirm with the building department before the pipe goes in.`);
    if (!outlet) notes.push("No outlet yet: the pipe has nowhere to go. Place the outlet on the wall nearest the downhill side of the site.");
  }

  return { drains, outlet, segments, pipe: { diaIn: dr.pipeDiaIn, totalFt: +totalFt.toFixed(1), bends, slopeInPerFt: slope }, cleanouts, notes };
}
