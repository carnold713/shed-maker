/**
 * Commands are pure `(model, payload) => model` reducers. The store applies
 * them; zundo captures the resulting state for undo/redo (ADR-0003).
 * Every command must return a model that still passes `BuildingModel` —
 * tests in tests/model enforce that for each command.
 */
import type { BuildingModel, Frame, FrameSystem, Opening, OpeningType, Roof } from "./schema";
import { syncExteriorWalls, wallLengthFt } from "./walls";
import { OPENING_PRESETS } from "./openings";
import { newId } from "./ids";

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

export function setFrameSystem(model: BuildingModel, system: FrameSystem): BuildingModel {
  if (model.frame.system === system) return model;
  const stick = system === "stickFrame";
  return touch({
    ...model,
    frame: { ...model.frame, system, trusses: { ...model.frame.trusses, spacingIn: stick ? 24 : 48 } },
    foundation: { ...model.foundation, kind: stick ? "monolithicSlab" : "embeddedPost" },
  });
}

/** Deep-ish patch of the frame block: top-level keys replace, nested objects merge one level. */
export function setFrame(model: BuildingModel, patch: Partial<{ [K in keyof Frame]: Frame[K] extends object ? Partial<Frame[K]> : Frame[K] }>): BuildingModel {
  const next: Frame = { ...model.frame };
  for (const [k, v] of Object.entries(patch) as [keyof Frame, unknown][]) {
    const cur = next[k];
    if (typeof cur === "object" && cur !== null && typeof v === "object" && v !== null) {
      (next as Record<string, unknown>)[k] = { ...(cur as object), ...(v as object) };
    } else {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  if (next.bayFt !== undefined) next.bayFt = clamp(next.bayFt, 4, 16);
  return touch({ ...model, frame: next });
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

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------

/** Openings snap to this increment along the wall (feet). */
export const OPENING_SNAP_FT = 1 / 12;

function snapOffset(ft: number): number {
  return Math.round(ft / OPENING_SNAP_FT) * OPENING_SNAP_FT;
}

/** Keep an opening inside its wall and under the eave. Returns the clamped opening. */
export function constrainOpening(model: BuildingModel, o: Opening): Opening {
  const wall = model.walls.find((w) => w.id === o.wallId);
  if (!wall) return o;
  const len = wallLengthFt(wall);
  const widthFt = clamp(o.widthFt, 1, Math.max(1, len));
  const maxHeight = Math.max(1, wall.heightFt - o.sillFt);
  const heightFt = clamp(o.heightFt, 1, maxHeight);
  const offsetFt = clamp(snapOffset(o.offsetFt), 0, Math.max(0, len - widthFt));
  return { ...o, widthFt, heightFt, offsetFt };
}

export interface AddOpeningInput {
  wallId: string;
  type: OpeningType;
  /** Near-jamb offset from the wall start. If omitted the opening is centred on the wall. */
  offsetFt?: number;
  /** Centre the opening on this position instead of using `offsetFt`. */
  centerFt?: number;
  widthFt?: number;
  heightFt?: number;
  sillFt?: number;
  id?: string;
}

export function addOpening(model: BuildingModel, input: AddOpeningInput): BuildingModel {
  const wall = model.walls.find((w) => w.id === input.wallId);
  if (!wall) return model;
  const preset = OPENING_PRESETS[input.type];
  const widthFt = input.widthFt ?? preset.widthFt;
  const len = wallLengthFt(wall);
  let offsetFt: number;
  if (input.offsetFt !== undefined) offsetFt = input.offsetFt;
  else if (input.centerFt !== undefined) offsetFt = input.centerFt - widthFt / 2;
  else offsetFt = len / 2 - widthFt / 2;
  const opening: Opening = constrainOpening(model, {
    id: input.id ?? newId("op"),
    wallId: input.wallId,
    type: input.type,
    offsetFt,
    widthFt,
    heightFt: input.heightFt ?? preset.heightFt,
    sillFt: input.sillFt ?? preset.sillFt,
    swing: preset.swing,
    hardware: [],
  });
  return touch({ ...model, openings: [...model.openings, opening] });
}

export function updateOpening(model: BuildingModel, id: string, patch: Partial<Omit<Opening, "id" | "wallId">>): BuildingModel {
  const idx = model.openings.findIndex((o) => o.id === id);
  if (idx < 0) return model;
  const cur = model.openings[idx];
  let merged: Opening = { ...cur, ...patch };
  if (patch.type && patch.type !== cur.type) {
    const preset = OPENING_PRESETS[patch.type];
    merged = {
      ...merged,
      widthFt: patch.widthFt ?? preset.widthFt,
      heightFt: patch.heightFt ?? preset.heightFt,
      sillFt: patch.sillFt ?? preset.sillFt,
      swing: patch.swing ?? preset.swing,
    };
    // Keep the opening centred where it was when the size changes with the type.
    const centre = cur.offsetFt + cur.widthFt / 2;
    merged.offsetFt = centre - merged.widthFt / 2;
  } else if (patch.widthFt !== undefined && patch.offsetFt === undefined) {
    const centre = cur.offsetFt + cur.widthFt / 2;
    merged.offsetFt = centre - merged.widthFt / 2;
  }
  const next = constrainOpening(model, merged);
  const unchanged = (Object.keys(next) as (keyof Opening)[]).every((k) => next[k] === cur[k]);
  if (unchanged) return model;
  const openings = model.openings.slice();
  openings[idx] = next;
  return touch({ ...model, openings });
}

export function moveOpening(model: BuildingModel, id: string, offsetFt: number): BuildingModel {
  return updateOpening(model, id, { offsetFt });
}

export function removeOpening(model: BuildingModel, id: string): BuildingModel {
  if (!model.openings.some((o) => o.id === id)) return model;
  return touch({ ...model, openings: model.openings.filter((o) => o.id !== id) });
}

export function flipOpeningSwing(model: BuildingModel, id: string): BuildingModel {
  const o = model.openings.find((x) => x.id === id);
  if (!o) return model;
  const flip: Record<Opening["swing"], Opening["swing"]> = {
    in: "out",
    out: "in",
    slideLeft: "slideRight",
    slideRight: "slideLeft",
    biParting: "biParting",
    none: "none",
  };
  return updateOpening(model, id, { swing: flip[o.swing] });
}

/** Centre an opening on its wall, or on the nearest post bay when `bayFt` is given. */
export function centerOpening(model: BuildingModel, id: string, on: "wall" | "bay" = "wall"): BuildingModel {
  const o = model.openings.find((x) => x.id === id);
  const wall = o && model.walls.find((w) => w.id === o.wallId);
  if (!o || !wall) return model;
  const len = wallLengthFt(wall);
  if (on === "wall") return moveOpening(model, id, len / 2 - o.widthFt / 2);
  const bay = model.frame.bayFt;
  const centre = o.offsetFt + o.widthFt / 2;
  const bayIndex = Math.max(0, Math.min(Math.ceil(len / bay) - 1, Math.floor(centre / bay)));
  const bayCentre = bayIndex * bay + Math.min(bay, len - bayIndex * bay) / 2;
  return moveOpening(model, id, bayCentre - o.widthFt / 2);
}
