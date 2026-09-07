import type { BuildingModel, Wall } from "@/lib/model/schema";
import { wallLengthFt } from "@/lib/model/walls";
import type { Vec3 } from "@/lib/geometry/types";
import { planToWorld } from "@/lib/geometry/frame";

/**
 * Wall-local frame helpers shared by the framing generators and the skin
 * geometry. Local coordinates: `u` along the wall from start to end (feet),
 * `h` up from finished floor (feet), `n` outward from the building along the
 * wall's exterior normal (feet). The plan wall line is the OUTSIDE face of the
 * girts / sheathing (ADR-0005 amendment in ADR-0006).
 */
export interface WallFrame {
  wall: Wall;
  lengthFt: number;
  /** Plan angle of the wall direction, radians CCW from +x. */
  angle: number;
  /** Unit direction along the wall in plan. */
  dir: { x: number; y: number };
  /** Outward unit normal in plan (exterior walls are walked clockwise, so outward is to the right). */
  normal: { x: number; y: number };
}

export function wallFrame(wall: Wall): WallFrame {
  const lengthFt = wallLengthFt(wall);
  const dx = (wall.end.x - wall.start.x) / lengthFt;
  const dy = (wall.end.y - wall.start.y) / lengthFt;
  // Clockwise walk => outward normal is dir rotated -90°: (dy, -dx).
  return { wall, lengthFt, angle: Math.atan2(dy, dx), dir: { x: dx, y: dy }, normal: { x: dy, y: -dx } };
}

/** Wall-local (u, h, n) -> world position. */
export function wallLocalToWorld(f: WallFrame, u: number, h: number, n: number): Vec3 {
  const px = f.wall.start.x + f.dir.x * u + f.normal.x * n;
  const py = f.wall.start.y + f.dir.y * u + f.normal.y * n;
  return planToWorld(px, py, h);
}

/**
 * Rotation for a box whose local +x runs along the wall. World +Y is up and
 * world z = -plan y, so a plan angle θ (CCW about +y_plan) becomes -θ... but
 * the z flip also mirrors the sense, so the net rotation about world Y is +θ.
 */
export function wallRotation(f: WallFrame): Vec3 {
  return [0, f.angle, 0];
}

export interface WallSpan {
  /** [u0, u1] along the wall, feet. */
  u0: number;
  u1: number;
  /** [h0, h1] vertical extent, feet. */
  h0: number;
  h1: number;
  openingId: string;
}

export function openingSpans(model: BuildingModel, wallId: string): WallSpan[] {
  return model.openings
    .filter((o) => o.wallId === wallId)
    .map((o) => ({ u0: o.offsetFt, u1: o.offsetFt + o.widthFt, h0: o.sillFt, h1: o.sillFt + o.heightFt, openingId: o.id }))
    .sort((a, b) => a.u0 - b.u0);
}

/**
 * Split the interval [0, length] at the given spans, returning the segments
 * NOT covered by any span whose vertical extent overlaps [h0, h1].
 */
export function freeSegments(lengthFt: number, spans: WallSpan[], h0: number, h1: number): [number, number][] {
  const blocking = spans.filter((s) => s.h0 < h1 - 1e-9 && s.h1 > h0 + 1e-9).sort((a, b) => a.u0 - b.u0);
  const out: [number, number][] = [];
  let cursor = 0;
  for (const s of blocking) {
    if (s.u0 > cursor + 1e-9) out.push([cursor, s.u0]);
    cursor = Math.max(cursor, s.u1);
  }
  if (cursor < lengthFt - 1e-9) out.push([cursor, lengthFt]);
  return out;
}
