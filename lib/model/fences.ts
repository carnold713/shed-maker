/**
 * Free fence lines (ADR-0017 addendum): a polyline in plan feet, open (a
 * lane, a boundary line) or closed around a paddock. Drawn point by point on
 * the plan or on the satellite map; the takeoff, 3D and the site sheet all
 * derive from the points.
 */
import type { BuildingModel, Fence, FenceGate, FenceKind } from "./schema";
import { newId } from "./ids";
import { FENCE_PRESETS } from "./runs";

export interface Pt {
  x: number;
  y: number;
}

const SNAP_FT = 0.5;

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

export function snapPt(p: Pt): Pt {
  return { x: Math.round(p.x / SNAP_FT) * SNAP_FT, y: Math.round(p.y / SNAP_FT) * SNAP_FT };
}

export interface FenceSegment {
  i: number;
  a: Pt;
  b: Pt;
  lengthFt: number;
  /** Direction of travel, radians in plan (x east, y north). */
  angle: number;
}

/** The straight runs of a fence line; a closed fence adds the run back to the first point. */
export function fenceSegments(f: Pick<Fence, "points" | "closed">): FenceSegment[] {
  const out: FenceSegment[] = [];
  const n = f.points.length;
  const count = f.closed && n > 2 ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = f.points[i];
    const b = f.points[(i + 1) % n];
    const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
    if (lengthFt < 1e-6) continue;
    out.push({ i, a, b, lengthFt, angle: Math.atan2(b.y - a.y, b.x - a.x) });
  }
  return out;
}

export function fenceLengthFt(f: Pick<Fence, "points" | "closed">): number {
  return fenceSegments(f).reduce((s, seg) => s + seg.lengthFt, 0);
}

/** Enclosed area of a closed fence, square feet (shoelace); 0 for an open line. */
export function fenceAreaSqFt(f: Pick<Fence, "points" | "closed">): number {
  if (!f.closed || f.points.length < 3) return 0;
  let s = 0;
  const n = f.points.length;
  for (let i = 0; i < n; i++) {
    const a = f.points[i];
    const b = f.points[(i + 1) % n];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export const SQFT_PER_ACRE = 43_560;

/** "0.48 acres" or "1,200 sq ft", whichever reads better. */
export function formatArea(sqFt: number): string {
  if (sqFt >= SQFT_PER_ACRE / 4) return `${(sqFt / SQFT_PER_ACRE).toFixed(2)} acres`;
  return `${Math.round(sqFt).toLocaleString()} sq ft`;
}

/** Point on a fence at `offsetFt` along segment `seg`. */
export function pointOnFence(f: Fence, seg: number, offsetFt: number): Pt | null {
  const s = fenceSegments(f).find((x) => x.i === seg);
  if (!s) return null;
  const t = Math.max(0, Math.min(1, offsetFt / s.lengthFt));
  return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
}

export interface AddFenceInput {
  points: Pt[];
  closed?: boolean;
  kind?: FenceKind;
  heightFt?: number;
  name?: string;
  id?: string;
}

export function addFence(model: BuildingModel, input: AddFenceInput): BuildingModel {
  const points = dedupe(input.points.map(snapPt));
  if (points.length < 2) return model;
  const kind = input.kind ?? "noClimb";
  const closed = (input.closed ?? false) && points.length >= 3;
  const n = model.fences.length + 1;
  const fence: Fence = {
    id: input.id ?? newId("fence"),
    name: input.name ?? (closed ? `Paddock ${n}` : `Fence line ${n}`),
    kind,
    heightFt: input.heightFt ?? FENCE_PRESETS[kind].heightFt,
    topRail: false,
    closed,
    points,
    gates: [],
  };
  return touch({ ...model, fences: [...model.fences, fence] });
}

function dedupe(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
    out.push(p);
  }
  // A closed loop drawn back onto its first point drops the duplicate.
  if (out.length > 2 && Math.abs(out[0].x - out[out.length - 1].x) < 1e-6 && Math.abs(out[0].y - out[out.length - 1].y) < 1e-6) out.pop();
  return out;
}

export function updateFence(model: BuildingModel, id: string, patch: Partial<Omit<Fence, "id">>): BuildingModel {
  const idx = model.fences.findIndex((f) => f.id === id);
  if (idx < 0) return model;
  const cur = model.fences[idx];
  const next: Fence = { ...cur, ...patch };
  if (patch.points) next.points = dedupe(patch.points.map(snapPt));
  if (next.points.length < 2) return model;
  if (next.closed && next.points.length < 3) next.closed = false;
  next.heightFt = Math.max(2, Math.min(8, next.heightFt));
  next.gates = next.gates.map((g) => clampGate(next, g)).filter((g): g is FenceGate => !!g);
  if (JSON.stringify(next) === JSON.stringify(cur)) return model;
  const fences = model.fences.slice();
  fences[idx] = next;
  return touch({ ...model, fences });
}

export function moveFencePoint(model: BuildingModel, id: string, index: number, p: Pt): BuildingModel {
  const f = model.fences.find((x) => x.id === id);
  if (!f || index < 0 || index >= f.points.length) return model;
  const points = f.points.slice();
  points[index] = snapPt(p);
  return updateFence(model, id, { points });
}

/** Add a corner on segment `seg` at the given point (splits the segment). */
export function insertFencePoint(model: BuildingModel, id: string, seg: number, p: Pt): BuildingModel {
  const f = model.fences.find((x) => x.id === id);
  if (!f) return model;
  const points = f.points.slice();
  points.splice(seg + 1, 0, snapPt(p));
  // Gates past the split shift one segment along.
  const gates = f.gates.map((g) => (g.seg > seg ? { ...g, seg: g.seg + 1 } : g));
  return updateFence(model, id, { points, gates });
}

export function removeFencePoint(model: BuildingModel, id: string, index: number): BuildingModel {
  const f = model.fences.find((x) => x.id === id);
  if (!f || f.points.length <= 2) return model;
  const points = f.points.filter((_, i) => i !== index);
  const gates = f.gates.filter((g) => g.seg !== index && g.seg !== index - 1).map((g) => (g.seg > index ? { ...g, seg: g.seg - 1 } : g));
  return updateFence(model, id, { points, gates });
}

/** Move the whole fence by (dx, dy). */
export function moveFence(model: BuildingModel, id: string, dx: number, dy: number): BuildingModel {
  const f = model.fences.find((x) => x.id === id);
  if (!f) return model;
  return updateFence(model, id, { points: f.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
}

export function removeFence(model: BuildingModel, id: string): BuildingModel {
  if (!model.fences.some((f) => f.id === id)) return model;
  return touch({ ...model, fences: model.fences.filter((f) => f.id !== id) });
}

function clampGate(f: Fence, g: FenceGate): FenceGate | null {
  const s = fenceSegments(f).find((x) => x.i === g.seg);
  if (!s) return null;
  const widthFt = Math.max(2, Math.min(s.lengthFt, g.widthFt));
  const offsetFt = Math.max(0, Math.min(s.lengthFt - widthFt, Math.round(g.offsetFt * 2) / 2));
  return { ...g, widthFt, offsetFt };
}

export interface AddFenceGateInput {
  seg?: number;
  offsetFt?: number;
  widthFt?: number;
  id?: string;
}

/** A gate on a segment (default: the longest one that has room), centred unless an offset is given. */
export function addFenceGate(model: BuildingModel, id: string, input: AddFenceGateInput = {}): BuildingModel {
  const f = model.fences.find((x) => x.id === id);
  if (!f) return model;
  const widthFt = input.widthFt ?? 4;
  const segs = fenceSegments(f);
  const candidates = input.seg !== undefined ? segs.filter((s) => s.i === input.seg) : segs.slice().sort((a, b) => b.lengthFt - a.lengthFt);
  const overlaps = (g: FenceGate) => f.gates.some((x) => x.seg === g.seg && x.offsetFt < g.offsetFt + g.widthFt && g.offsetFt < x.offsetFt + x.widthFt);
  for (const s of candidates) {
    if (input.seg === undefined && widthFt > s.lengthFt) continue;
    const w = Math.min(widthFt, s.lengthFt);
    const slots = input.offsetFt !== undefined ? [input.offsetFt] : [s.lengthFt / 2 - w / 2, ...f.gates.filter((g) => g.seg === s.i).map((g) => g.offsetFt + g.widthFt + 1), 0];
    for (const off of slots) {
      const gate = clampGate(f, { id: input.id ?? newId("gate"), seg: s.i, offsetFt: off, widthFt: w });
      if (gate && !overlaps(gate)) return updateFence(model, id, { gates: [...f.gates, gate] });
      if (input.offsetFt !== undefined) return model;
    }
  }
  return model;
}

export function updateFenceGate(model: BuildingModel, id: string, gateId: string, patch: Partial<Omit<FenceGate, "id">>): BuildingModel {
  const f = model.fences.find((x) => x.id === id);
  if (!f) return model;
  return updateFence(model, id, { gates: f.gates.map((g) => (g.id === gateId ? { ...g, ...patch } : g)) });
}

export function removeFenceGate(model: BuildingModel, id: string, gateId: string): BuildingModel {
  const f = model.fences.find((x) => x.id === id);
  if (!f) return model;
  return updateFence(model, id, { gates: f.gates.filter((g) => g.id !== gateId) });
}

/** Nearest fence vertex within `withinFt` of a point. */
export function fenceVertexAt(model: BuildingModel, p: Pt, withinFt: number): { fence: Fence; index: number } | null {
  let best: { fence: Fence; index: number; d: number } | null = null;
  for (const f of model.fences)
    f.points.forEach((q, index) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= withinFt && (!best || d < best.d)) best = { fence: f, index, d };
    });
  return best;
}

/** Nearest fence segment within `withinFt`, with the foot of the perpendicular. */
export function fenceSegmentAt(model: BuildingModel, p: Pt, withinFt: number): { fence: Fence; seg: FenceSegment; foot: Pt; offsetFt: number } | null {
  let best: { fence: Fence; seg: FenceSegment; foot: Pt; offsetFt: number; d: number } | null = null;
  for (const f of model.fences)
    for (const seg of fenceSegments(f)) {
      const dx = seg.b.x - seg.a.x;
      const dy = seg.b.y - seg.a.y;
      const t = Math.max(0, Math.min(1, ((p.x - seg.a.x) * dx + (p.y - seg.a.y) * dy) / (seg.lengthFt * seg.lengthFt)));
      const foot = { x: seg.a.x + dx * t, y: seg.a.y + dy * t };
      const d = Math.hypot(p.x - foot.x, p.y - foot.y);
      if (d <= withinFt && (!best || d < best.d)) best = { fence: f, seg, foot, offsetFt: t * seg.lengthFt, d };
    }
  return best;
}

/** Points worth snapping a new fence corner to: the barn's corners, run corners, and other fence corners. */
export function fenceSnapPoints(model: BuildingModel, exceptDraft?: Pt[]): Pt[] {
  const pts: Pt[] = [];
  if (model.footprint.kind === "rect") {
    const { wFt: W, dFt: D } = model.footprint;
    pts.push({ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D });
  }
  for (const r of model.runs) pts.push({ x: r.rect.x, y: r.rect.y }, { x: r.rect.x + r.rect.w, y: r.rect.y }, { x: r.rect.x + r.rect.w, y: r.rect.y + r.rect.d }, { x: r.rect.x, y: r.rect.y + r.rect.d });
  for (const f of model.fences) pts.push(...f.points);
  if (exceptDraft) pts.push(...exceptDraft);
  return pts;
}

/** Snap a fence corner: to a nearby corner within 2', else to the half-foot grid. */
export function snapFencePoint(model: BuildingModel, p: Pt, draft: Pt[] = []): Pt {
  let best: { q: Pt; d: number } | null = null;
  for (const q of fenceSnapPoints(model, draft)) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= 2 && (!best || d < best.d)) best = { q, d };
  }
  return best ? best.q : snapPt(p);
}
