import type { BuildingModel, Wall } from "./schema";

/**
 * Exterior walls for a rectangular footprint, walked clockwise from the
 * south-west corner: S (0,0)->(w,0), E (w,0)->(w,d), N (w,d)->(0,d), W (0,d)->(0,0).
 *
 * Wall ids are stable per side so openings can keep referencing them across
 * footprint edits (an opening whose offset falls outside the new wall length
 * is handled by `clampOpeningsToWalls`).
 */
export const EXTERIOR_WALL_IDS = {
  s: "wall_ext_s",
  e: "wall_ext_e",
  n: "wall_ext_n",
  w: "wall_ext_w",
} as const;

export function exteriorWallsForRect(
  wFt: number,
  dFt: number,
  heightFt: number,
  existing: Wall[] = [],
): Wall[] {
  const bySide = new Map(existing.filter((w) => w.role === "exterior" && w.side).map((w) => [w.side!, w]));
  const mk = (side: "s" | "e" | "n" | "w", start: { x: number; y: number }, end: { x: number; y: number }): Wall => {
    const prev = bySide.get(side);
    return {
      id: EXTERIOR_WALL_IDS[side],
      role: "exterior",
      side,
      start,
      end,
      heightFt: prev?.heightFt ?? heightFt,
      thicknessIn: prev?.thicknessIn ?? 5.5,
      bearing: true,
      assembly: prev?.assembly ?? { sheathing: "none", siding: "steelPanel", interiorFinish: "none", insulation: "none" },
    };
  };
  return [
    mk("s", { x: 0, y: 0 }, { x: wFt, y: 0 }),
    mk("e", { x: wFt, y: 0 }, { x: wFt, y: dFt }),
    mk("n", { x: wFt, y: dFt }, { x: 0, y: dFt }),
    mk("w", { x: 0, y: dFt }, { x: 0, y: 0 }),
  ];
}

export function wallLengthFt(w: Wall): number {
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
}

/** Rebuild exterior walls from the footprint, preserving interior walls and per-wall settings. */
export function syncExteriorWalls(model: BuildingModel): BuildingModel {
  if (model.footprint.kind !== "rect") return model; // poly footprints: P1
  const interior = model.walls.filter((w) => w.role === "interior");
  const exterior = exteriorWallsForRect(
    model.footprint.wFt,
    model.footprint.dFt,
    model.eaveHeightFt,
    model.walls,
  );
  const walls = [...exterior, ...interior];
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const openings = model.openings.filter((o) => {
    const w = wallById.get(o.wallId);
    return w !== undefined && o.offsetFt + o.widthFt <= wallLengthFt(w) + 1e-6;
  });
  return { ...model, walls, openings };
}

/** Nearest exterior wall to a plan point: the wall, the position along it, and the distance. */
export function nearestExteriorWall(model: BuildingModel, x: number, y: number): { wall: Wall; u: number; dist: number } | null {
  let best: { wall: Wall; u: number; dist: number } | null = null;
  for (const w of model.walls) {
    if (w.role !== "exterior") continue;
    const len = wallLengthFt(w);
    if (len <= 0) continue;
    const dx = (w.end.x - w.start.x) / len;
    const dy = (w.end.y - w.start.y) / len;
    const u = Math.max(0, Math.min(len, (x - w.start.x) * dx + (y - w.start.y) * dy));
    const cx = w.start.x + dx * u;
    const cy = w.start.y + dy * u;
    const dist = Math.hypot(x - cx, y - cy);
    if (!best || dist < best.dist) best = { wall: w, u, dist };
  }
  return best;
}
