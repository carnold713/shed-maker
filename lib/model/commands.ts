/**
 * Commands are pure `(model, payload) => model` reducers. The store applies
 * them; zundo captures the resulting state for undo/redo (ADR-0003).
 * Every command must return a model that still passes `BuildingModel` —
 * tests in tests/model enforce that for each command.
 */
import type { BuildingModel, ConstructionMethod, Roof } from "./schema";
import { syncExteriorWalls } from "./walls";

export const MIN_DIM_FT = 4;
export const MAX_DIM_FT = 200;
export const MIN_EAVE_FT = 6;
export const MAX_EAVE_FT = 24;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

export function setFootprintRect(model: BuildingModel, wFt: number, dFt: number): BuildingModel {
  const w = clamp(Number.isFinite(wFt) ? wFt : MIN_DIM_FT, MIN_DIM_FT, MAX_DIM_FT);
  const d = clamp(Number.isFinite(dFt) ? dFt : MIN_DIM_FT, MIN_DIM_FT, MAX_DIM_FT);
  if (model.footprint.kind === "rect" && model.footprint.wFt === w && model.footprint.dFt === d) return model;
  return touch(syncExteriorWalls({ ...model, footprint: { kind: "rect", wFt: w, dFt: d } }));
}

export function setEaveHeight(model: BuildingModel, heightFt: number): BuildingModel {
  const h = clamp(Number.isFinite(heightFt) ? heightFt : MIN_EAVE_FT, MIN_EAVE_FT, MAX_EAVE_FT);
  if (model.eaveHeightFt === h) return model;
  // Exterior walls follow the global eave height unless individually overridden later (P1).
  const walls = model.walls.map((w) => (w.role === "exterior" ? { ...w, heightFt: h } : w));
  return touch({ ...model, eaveHeightFt: h, walls });
}

export function setMethod(model: BuildingModel, method: ConstructionMethod): BuildingModel {
  if (model.method === method) return model;
  const foundationKind = method === "postFrame" ? "embeddedPost" : "monolithicSlab";
  const trussSpacingIn = method === "postFrame" ? 48 : 24;
  return touch({
    ...model,
    method,
    foundation: { ...model.foundation, kind: foundationKind },
    roof: { ...model.roof, trussSpacingIn },
  });
}

export function setRoof(model: BuildingModel, patch: Partial<Roof>): BuildingModel {
  return touch({ ...model, roof: { ...model.roof, ...patch } });
}

export function setName(model: BuildingModel, name: string): BuildingModel {
  const trimmed = name.trim();
  if (!trimmed || trimmed === model.meta.name) return model;
  return touch({ ...model, meta: { ...model.meta, name: trimmed } });
}

export function setOrientation(model: BuildingModel, deg: number): BuildingModel {
  const d = ((deg % 360) + 360) % 360;
  return touch({ ...model, site: { ...model.site, orientationDeg: d } });
}

/** Snap a dimension to the nearest module (2' or 4'). */
export function snapToModule(ft: number, moduleFt: 2 | 4 = 2): number {
  return Math.max(moduleFt, Math.round(ft / moduleFt) * moduleFt);
}
