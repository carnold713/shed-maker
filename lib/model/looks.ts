/**
 * The barn's looks (ADR-0018): cupola and weathervane on the ridge, bracketed
 * awnings over doors, trim boards around openings, a wainscot band, and the
 * exterior lights that go with them. Commands edit the model; the geometry,
 * estimate and rules derive from it.
 */
import type { Awning, BuildingModel, Opening, TrimStyle } from "./schema";
import { addFixture } from "./electrical";
import { isDoor } from "./openings";
import { wallLengthFt } from "./walls";

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

export const CUPOLA_SIZES_IN = [24, 30, 36, 42, 48] as const;

/** Cupola makers' rule of thumb: about 1¼" of cupola base per foot of ridge (1" small barns, 1½" big ones), rounded to a stock size. */
export function recommendedCupolaIn(ridgeLengthFt: number): number {
  const want = ridgeLengthFt * 1.25;
  return CUPOLA_SIZES_IN.reduce((best, s) => (Math.abs(s - want) < Math.abs(best - want) ? s : best), CUPOLA_SIZES_IN[0]);
}

export function ridgeLengthFt(model: BuildingModel): number {
  if (model.footprint.kind !== "rect") return 24;
  return model.roof.ridgeAxis === "ns" ? model.footprint.dFt : model.footprint.wFt;
}

export function setCupola(model: BuildingModel, patch: Partial<BuildingModel["roof"]["cupola"]>): BuildingModel {
  const cupola = { ...model.roof.cupola, ...patch };
  if (JSON.stringify(cupola) === JSON.stringify(model.roof.cupola)) return model;
  return touch({ ...model, roof: { ...model.roof, cupola, vents: { ...model.roof.vents, cupola: cupola.enabled } } });
}

export const TRIM_STYLE_LABEL: Record<TrimStyle, string> = {
  none: "Steel J-trim only",
  flat: "Flat 1×4 boards",
  wide: "Wide 1×6 boards",
  craftsman: "Craftsman (1×6 head with a cap, sill apron)",
};

export const TRIM_STYLE_HINT: Record<TrimStyle, string> = {
  none: "The siding's own J-channel around each opening; cleanest and cheapest.",
  flat: "A 3½\" board on all four sides in the trim colour.",
  wide: "A 5½\" board all round; reads well on a big barn.",
  craftsman: "Like the photo: 1×4 legs, a deeper 1×6 head with a drip cap, a sill and an apron under the windows.",
};

export function setTrimStyle(model: BuildingModel, trimStyle: TrimStyle): BuildingModel {
  if (model.materials.trimStyle === trimStyle) return model;
  return touch({ ...model, materials: { ...model.materials, trimStyle } });
}

export const WAINSCOT_LABEL = { steel: "Contrasting steel panel", stone: "Stone veneer", board: "Board and batten" } as const;

export function setWainscot(model: BuildingModel, patch: Partial<BuildingModel["materials"]["wainscot"]>): BuildingModel {
  const wainscot = { ...model.materials.wainscot, ...patch };
  wainscot.heightFt = Math.max(1.5, Math.min(5, wainscot.heightFt));
  if (JSON.stringify(wainscot) === JSON.stringify(model.materials.wainscot)) return model;
  return touch({ ...model, materials: { ...model.materials, wainscot } });
}

/** Doors an awning makes sense over: anything a person or animal walks through, not windows. */
export function isBigDoor(o: Opening): boolean {
  return isDoor(o.type) && o.type !== "manDoor" && o.widthFt >= 6;
}

export function setAwning(model: BuildingModel, openingId: string, awning: Partial<Awning> | null): BuildingModel {
  const idx = model.openings.findIndex((o) => o.id === openingId);
  if (idx < 0) return model;
  const cur = model.openings[idx];
  const next: Opening = awning === null ? { ...cur, awning: undefined } : { ...cur, awning: { kind: cur.awning?.kind ?? "shed", depthFt: cur.awning?.depthFt ?? 3, brackets: cur.awning?.brackets ?? "timber", ...awning } };
  if (awning === null) delete next.awning;
  if (JSON.stringify(next) === JSON.stringify(cur)) return model;
  const openings = model.openings.slice();
  openings[idx] = next;
  return touch({ ...model, openings });
}

/** An awning over every big door and entry door that has none. */
export function awningsOverDoors(model: BuildingModel, brackets: Awning["brackets"] = "timber"): BuildingModel {
  let m = model;
  for (const o of model.openings) {
    if (!isDoor(o.type) || o.awning) continue;
    const depth = o.widthFt >= 10 ? 4 : 3;
    m = setAwning(m, o.id, { kind: "shed", depthFt: depth, brackets });
  }
  return m;
}

/** Where a light for a door goes: centred above it, clear of the awning if any. */
function lightHeightFor(model: BuildingModel, o: Opening): number {
  const top = o.sillFt + o.heightFt + (o.awning ? o.awning.depthFt / 3 + 1.3 : 1.2);
  return Math.min(model.eaveHeightFt - 0.5, Math.max(7, top));
}

/**
 * Gooseneck barn lights centred over every big door and a lantern beside
 * every entry door, on the outside face (the electrical step wires them).
 */
export function lightsOverDoors(model: BuildingModel): BuildingModel {
  let m = model;
  for (const o of model.openings) {
    if (!isDoor(o.type)) continue;
    const wall = model.walls.find((w) => w.id === o.wallId);
    if (!wall) continue;
    const len = wallLengthFt(wall);
    const dx = (wall.end.x - wall.start.x) / len;
    const dy = (wall.end.y - wall.start.y) / len;
    const at = (u: number) => ({ x: wall.start.x + dx * u, y: wall.start.y + dy * u });
    const already = (u: number) => m.electrical.fixtures.some((f) => (f.kind === "gooseneck" || f.kind === "lantern" || f.kind === "floodlight") && f.wallId === o.wallId && Math.hypot(f.x - at(u).x, f.y - at(u).y) < 3);
    if (o.type === "manDoor") {
      const u = o.offsetFt + o.widthFt + 1;
      if (u <= len - 0.5 && !already(u)) m = addFixture(m, { kind: "lantern", x: at(u).x, y: at(u).y, wallId: o.wallId, mountFt: Math.min(model.eaveHeightFt - 1, 6.5), label: `Lantern by ${o.tag ?? "the entry door"}` });
      continue;
    }
    const u = o.offsetFt + o.widthFt / 2;
    if (already(u)) continue;
    const n = o.widthFt >= 14 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const uu = n === 1 ? u : o.offsetFt + (o.widthFt * (i + 1)) / (n + 1);
      m = addFixture(m, { kind: "gooseneck", x: at(uu).x, y: at(uu).y, wallId: o.wallId, mountFt: lightHeightFor(model, o), label: `Gooseneck over ${o.tag ?? "the door"}` });
    }
  }
  return m;
}

export type LookPreset = "classic" | "plain";

/** One click: the barn in the photo — cupola and vane, awnings with timber brackets, craftsman trim, stone wainscot, gooseneck lights. */
export function applyLook(model: BuildingModel, look: LookPreset): BuildingModel {
  let m = model;
  if (look === "classic") {
    m = setCupola(m, { enabled: true, sizeIn: recommendedCupolaIn(ridgeLengthFt(m)), count: 1, weathervane: true, style: "louvered" });
    m = setTrimStyle(m, "craftsman");
    m = setWainscot(m, { enabled: true, kind: "stone", heightFt: 3 });
    m = awningsOverDoors(m, "timber");
    m = lightsOverDoors(m);
    m = touch({ ...m, roof: { ...m.roof, covering: "standingSeam", overhangEaveIn: Math.max(m.roof.overhangEaveIn, 18), overhangGableIn: Math.max(m.roof.overhangGableIn, 12) } });
    return m;
  }
  m = setCupola(m, { enabled: false });
  m = setTrimStyle(m, "none");
  m = setWainscot(m, { enabled: false });
  for (const o of m.openings) if (o.awning) m = setAwning(m, o.id, null);
  return m;
}
