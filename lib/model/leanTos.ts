/**
 * Lean-to / awning commands (SPEC §4.5). A lean-to hangs on one exterior
 * wall: its roof attaches just below the main eave and slopes away at its
 * own pitch, outer posts carry a header, and the pad may extend under it.
 */
import type { BuildingModel, LeanTo } from "./schema";
import { newId } from "./ids";
import { EXTERIOR_WALL_IDS, wallLengthFt } from "./walls";
import { wallFrame } from "@/lib/framing/wallFrame";

export type Side = "n" | "s" | "e" | "w";

export const LEAN_TO_DEPTHS_FT = [8, 10, 12, 14, 16];
export const LEAN_TO_MIN_CLEAR_FT = 7;

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

export interface AddLeanToInput {
  side: Side;
  depthFt?: number;
  pitch?: number;
  enclosed?: boolean;
  offsetFt?: number;
  lengthFt?: number;
  slab?: boolean;
  id?: string;
}

export function addLeanTo(model: BuildingModel, input: AddLeanToInput): BuildingModel {
  if (model.leanTos.some((l) => l.side === input.side && (input.offsetFt === undefined || l.offsetFt === undefined))) {
    // One full-length lean-to per side; partial ones may coexist if they don't overlap (kept simple: one per side).
    return model;
  }
  const lt: LeanTo = {
    id: input.id ?? newId("lt"),
    side: input.side,
    depthFt: input.depthFt ?? 12,
    pitch: input.pitch ?? 3,
    enclosed: input.enclosed ?? false,
    offsetFt: input.offsetFt,
    lengthFt: input.lengthFt,
    slab: input.slab ?? true,
    dropIn: 6,
    postSize: "6x6",
  };
  return touch({ ...model, leanTos: [...model.leanTos, lt] });
}

export function updateLeanTo(model: BuildingModel, id: string, patch: Partial<Omit<LeanTo, "id">>): BuildingModel {
  const idx = model.leanTos.findIndex((l) => l.id === id);
  if (idx < 0) return model;
  const cur = model.leanTos[idx];
  const next: LeanTo = { ...cur, ...patch };
  next.depthFt = Math.min(24, Math.max(4, next.depthFt));
  if (JSON.stringify(next) === JSON.stringify(cur)) return model;
  const leanTos = model.leanTos.slice();
  leanTos[idx] = next;
  return touch({ ...model, leanTos });
}

export function removeLeanTo(model: BuildingModel, id: string): BuildingModel {
  if (!model.leanTos.some((l) => l.id === id)) return model;
  return touch({ ...model, leanTos: model.leanTos.filter((l) => l.id !== id) });
}

/** Resolved extents of a lean-to along its wall. */
export function leanToSpan(model: BuildingModel, lt: LeanTo): { wallId: string; u0: number; u1: number; lengthFt: number } {
  const wallId = EXTERIOR_WALL_IDS[lt.side];
  const wall = model.walls.find((w) => w.id === wallId);
  const len = wall ? wallLengthFt(wall) : 0;
  const u0 = Math.max(0, Math.min(len, lt.offsetFt ?? 0));
  const u1 = lt.lengthFt === undefined ? len : Math.max(u0 + 1, Math.min(len, u0 + lt.lengthFt));
  return { wallId, u0, u1, lengthFt: u1 - u0 };
}

/** Plan-space rectangle of the lean-to (outside the wall) as polygon corners in order [wall start, wall end, outer end, outer start]. */
export function leanToPolygon(model: BuildingModel, lt: LeanTo): { x: number; y: number }[] {
  const { wallId, u0, u1 } = leanToSpan(model, lt);
  const wall = model.walls.find((w) => w.id === wallId);
  if (!wall) return [];
  const f = wallFrame(wall);
  const P = (u: number, n: number) => ({ x: wall.start.x + f.dir.x * u + f.normal.x * n, y: wall.start.y + f.dir.y * u + f.normal.y * n });
  return [P(u0, 0), P(u1, 0), P(u1, lt.depthFt), P(u0, lt.depthFt)];
}

/** Heights of the lean-to roof: attachment at the wall and at the outer edge (top of rafters), feet. */
export function leanToHeights(model: BuildingModel, lt: LeanTo): { highFt: number; lowFt: number; theta: number } {
  const highFt = model.eaveHeightFt - lt.dropIn / 12;
  const theta = Math.atan2(lt.pitch, 12);
  const lowFt = highFt - lt.depthFt * (lt.pitch / 12);
  return { highFt, lowFt, theta };
}
