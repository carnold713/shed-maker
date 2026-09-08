/**
 * Outdoor runs (SPEC §26, ADR-0017): fenced ground attached to the barn.
 * A run is a plan rectangle outside the walls, usually hung on a pen's
 * outside wall so the stall's Dutch door opens straight into it. Sizes,
 * fence kinds and heights follow docs/research/runs-and-fencing.md; the
 * numbers below are planning figures from extension guidance, flagged
 * "verify" where they came from memory rather than a cited page.
 */
import type { BuildingModel, FenceKind, Run, RunGate, Species, Zone } from "./schema";
import { newId } from "./ids";
import { exteriorEdgesOf, zoneRect, type ExteriorEdge, type Rect } from "./zones";
import { SPECIES_PRESETS } from "@/rules/animals/presets";

export type Side = "n" | "s" | "e" | "w";
type Pt = { x: number; y: number };
const SIDES: Side[] = ["n", "e", "s", "w"];

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

// ---------------------------------------------------------------------------
// Fence catalogue
// ---------------------------------------------------------------------------

export interface FencePreset {
  kind: FenceKind;
  label: string;
  /** Plain-English blurb for pickers. */
  hint: string;
  heightFt: number;
  /** Line-post spacing, feet. */
  postSpacingFt: number;
  /** How the fence material is bought. */
  material: "roll" | "board" | "panel" | "strand";
  /** Roll or panel length, feet (roll / panel kinds). */
  unitFt?: number;
  /** Boards per bay (board fence) or strands (electric). */
  rails?: number;
  /** Corner and gate posts need an H-brace assembly to hold wire tension. */
  braced: boolean;
  sku: string;
}

export const FENCE_PRESETS: Record<FenceKind, FencePreset> = {
  noClimb: { kind: "noClimb", label: "No-climb woven wire (2×4 mesh)", hint: "The safe default for horses, alpacas and goats: hooves and heads can't get through the 2\" × 4\" mesh.", heightFt: 5, postSpacingFt: 8, material: "roll", unitFt: 100, braced: true, sku: "fence.noClimb.roll" },
  wovenWire: { kind: "wovenWire", label: "Woven wire (field fence)", hint: "Cheaper 6\" × 6\" or graduated mesh for sheep and cattle; goats and horses can hang a leg in it.", heightFt: 4, postSpacingFt: 8, material: "roll", unitFt: 330, braced: true, sku: "fence.woven.roll" },
  board: { kind: "board", label: "Board fence (3 rails)", hint: "Classic 2×6 plank on 8' posts. Looks the best, costs the most, and horses lean on it.", heightFt: 4.5, postSpacingFt: 8, material: "board", unitFt: 16, rails: 3, braced: false, sku: "fence.board.16" },
  electric: { kind: "electric", label: "High-tensile electric (5 strands)", hint: "Long pasture runs; needs a charger and training. Not for small dry lots on its own.", heightFt: 4.5, postSpacingFt: 15, material: "strand", rails: 5, braced: true, sku: "fence.htWire.coil" },
  pipePanel: { kind: "pipePanel", label: "Pipe and continuous panel", hint: "Welded steel panels on pipe posts: cattle, horses, anything that pushes.", heightFt: 5, postSpacingFt: 10, material: "panel", unitFt: 20, braced: false, sku: "fence.pipePanel" },
  chainLink: { kind: "chainLink", label: "Chain link", hint: "Dog kennels and small runs; 6' keeps a dog in and coyotes out.", heightFt: 6, postSpacingFt: 8, material: "roll", unitFt: 50, braced: false, sku: "fence.chainLink.roll" },
  hogPanel: { kind: "hogPanel", label: "Hog / cattle panels", hint: "16' welded panels on T-posts: pigs, sheep, goats, small cattle lots.", heightFt: 4, postSpacingFt: 8, material: "panel", unitFt: 16, braced: false, sku: "fence.hogPanel" },
  poultryNet: { kind: "poultryNet", label: "Poultry netting / hardware cloth", hint: "½\" hardware cloth 6' high with a buried skirt keeps the hens in and the foxes out; cover the top for hawks.", heightFt: 6, postSpacingFt: 8, material: "roll", unitFt: 100, braced: false, sku: "fence.poultry.roll" },
};

export const FENCE_KINDS = Object.keys(FENCE_PRESETS) as FenceKind[];

// ---------------------------------------------------------------------------
// Per-species run guidance (docs/research/runs-and-fencing.md §2–3)
// ---------------------------------------------------------------------------

export interface RunGuidance {
  /** Dry-lot / attached-run area per head, square feet. */
  minSqFtPerHead: number;
  recSqFtPerHead: number;
  fence: FenceKind;
  fenceHeightFt: number;
  minFenceHeightFt: number;
  /** Fence kinds that hurt or don't hold this animal. */
  avoid: FenceKind[];
  note: string;
  source: `Species:${string}`;
}

export const RUN_GUIDANCE: Record<Species, RunGuidance> = {
  horse: { minSqFtPerHead: 288, recSqFtPerHead: 600, fence: "noClimb", fenceHeightFt: 5, minFenceHeightFt: 4.5, avoid: ["hogPanel", "poultryNet", "wovenWire"], note: "12' × 24' minimum off a stall; 400–1,000 sq ft per horse for a dry lot; never barbed wire.", source: "Species:extension-equine (Penn State, UMN; from knowledge — verify)" },
  pony: { minSqFtPerHead: 200, recSqFtPerHead: 450, fence: "noClimb", fenceHeightFt: 4.5, minFenceHeightFt: 4, avoid: ["hogPanel", "poultryNet", "wovenWire"], note: "12' × 20' minimum off a stall.", source: "Species:extension-equine (from knowledge — verify)" },
  goat: { minSqFtPerHead: 25, recSqFtPerHead: 50, fence: "noClimb", fenceHeightFt: 4.5, minFenceHeightFt: 4, avoid: ["wovenWire", "electric", "poultryNet"], note: "Goats climb and put heads through 6\" mesh; 2×4 no-climb or panels, 4'–5' high, latches they can't work.", source: "Species:NMSU / UKY goat housing (from knowledge — verify)" },
  sheep: { minSqFtPerHead: 25, recSqFtPerHead: 40, fence: "wovenWire", fenceHeightFt: 4, minFenceHeightFt: 3.5, avoid: ["electric", "poultryNet"], note: "Woven wire 4' with a hot wire on top where predators are a problem.", source: "Species:OSU Sheep Team (from knowledge — verify)" },
  cattle: { minSqFtPerHead: 250, recSqFtPerHead: 350, fence: "pipePanel", fenceHeightFt: 5, minFenceHeightFt: 4.5, avoid: ["poultryNet", "chainLink"], note: "Unpaved lot 250–500 sq ft per head; pipe, panel or 5-strand high-tensile.", source: "Species:MWPS beef housing (from knowledge — verify)" },
  pig: { minSqFtPerHead: 100, recSqFtPerHead: 200, fence: "hogPanel", fenceHeightFt: 3.5, minFenceHeightFt: 3, avoid: ["poultryNet", "chainLink", "board"], note: "Hog panels with a hot wire at nose height stop rooting under.", source: "Species:extension-swine (from knowledge — verify)" },
  chicken: { minSqFtPerHead: 10, recSqFtPerHead: 15, fence: "poultryNet", fenceHeightFt: 6, minFenceHeightFt: 5, avoid: ["electric", "wovenWire", "hogPanel", "pipePanel", "board", "noClimb"], note: "8–10 sq ft per bird; hardware cloth with a 12\" buried skirt and a covered top.", source: "Species:extension-poultry (from knowledge — verify)" },
  alpaca: { minSqFtPerHead: 100, recSqFtPerHead: 200, fence: "noClimb", fenceHeightFt: 5, minFenceHeightFt: 4.5, avoid: ["electric", "wovenWire", "poultryNet", "hogPanel"], note: "Herd animals, never one alone; dry lot 100–200 sq ft per animal; 5' no-climb keeps dogs and coyotes out — the fence is for predators more than the alpacas.", source: "Species:Alpaca Owners Association (docs/research/runs-and-fencing.md §1; from knowledge — verify)" },
  rabbit: { minSqFtPerHead: 4, recSqFtPerHead: 8, fence: "poultryNet", fenceHeightFt: 3, minFenceHeightFt: 2.5, avoid: ["electric", "wovenWire", "hogPanel", "pipePanel", "board", "noClimb", "chainLink"], note: "Wire mesh with a buried skirt; cover the top.", source: "Species:extension-rabbit (from knowledge — verify)" },
  dog: { minSqFtPerHead: 32, recSqFtPerHead: 60, fence: "chainLink", fenceHeightFt: 6, minFenceHeightFt: 5, avoid: ["electric", "wovenWire", "hogPanel", "poultryNet"], note: "6' chain link; 5' × 10' minimum per dog.", source: "Species:USDA kennel guidance (from knowledge — verify)" },
  generic: { minSqFtPerHead: 288, recSqFtPerHead: 400, fence: "noClimb", fenceHeightFt: 5, minFenceHeightFt: 4, avoid: [], note: "Planning figure; pick the animal for real numbers.", source: "Species:generic" },
};

export function runGuidanceFor(species?: Species): RunGuidance {
  return RUN_GUIDANCE[species ?? "generic"];
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function runRect(r: Run): Rect {
  return { x: r.rect.x, y: r.rect.y, w: r.rect.w, d: r.rect.d };
}

export function runArea(r: Run): number {
  return r.rect.w * r.rect.d;
}

export function runSqFtPerHead(r: Run): number {
  return runArea(r) / Math.max(1, r.headCount);
}

export interface RunEdge {
  side: Side;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lengthFt: number;
  /** The building wall is this edge — no fence needed. */
  onBuilding: boolean;
}

function footprint(model: BuildingModel): { W: number; D: number } | null {
  return model.footprint.kind === "rect" ? { W: model.footprint.wFt, D: model.footprint.dFt } : null;
}

/** The four sides of a run, flagged where they lie along the barn wall. */
export function runEdges(model: BuildingModel, run: Run): RunEdge[] {
  const r = runRect(run);
  const fp = footprint(model);
  const eps = 1e-6;
  const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > eps;
  const edge = (side: Side): RunEdge => {
    let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.d;
    if (side === "s") y1 = r.y;
    if (side === "n") y0 = r.y + r.d;
    if (side === "w") x1 = r.x;
    if (side === "e") x0 = r.x + r.w;
    const lengthFt = side === "n" || side === "s" ? r.w : r.d;
    let onBuilding = false;
    if (fp) {
      if (side === "s" && Math.abs(r.y - fp.D) < eps && overlaps(r.x, r.x + r.w, 0, fp.W)) onBuilding = true;
      if (side === "n" && Math.abs(r.y + r.d) < eps && overlaps(r.x, r.x + r.w, 0, fp.W)) onBuilding = true;
      if (side === "w" && Math.abs(r.x - fp.W) < eps && overlaps(r.y, r.y + r.d, 0, fp.D)) onBuilding = true;
      if (side === "e" && Math.abs(r.x + r.w) < eps && overlaps(r.y, r.y + r.d, 0, fp.D)) onBuilding = true;
    }
    return { side, x0, y0, x1, y1, lengthFt, onBuilding };
  };
  return SIDES.map(edge);
}

/** The side of a run that faces away from the barn (where the outside gate goes). */
export function outerSide(model: BuildingModel, run: Run): Side {
  const edges = runEdges(model, run);
  const attached = edges.find((e) => e.onBuilding);
  const opposite: Record<Side, Side> = { n: "s", s: "n", e: "w", w: "e" };
  if (attached) return opposite[attached.side];
  const fp = footprint(model);
  if (!fp) return "s";
  // Free-standing: the side farthest from the barn centre.
  const r = runRect(run);
  const cx = fp.W / 2;
  const cy = fp.D / 2;
  const dx = r.x + r.w / 2 - cx;
  const dy = r.y + r.d / 2 - cy;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "e" : "w") : dy > 0 ? "n" : "s";
}

/** Does the rect overlap the footprint (more than touching)? */
export function overlapsBuilding(model: BuildingModel, r: Rect): boolean {
  const fp = footprint(model);
  if (!fp) return false;
  const eps = 1e-6;
  return r.x < fp.W - eps && r.x + r.w > eps && r.y < fp.D - eps && r.y + r.d > eps;
}

/** Push a rect out of the footprint by the shortest move (runs live outside the walls). */
export function clampRunOutside(model: BuildingModel, r: Rect): Rect {
  if (!overlapsBuilding(model, r)) return r;
  const fp = footprint(model)!;
  const moves: { dx: number; dy: number }[] = [
    { dx: fp.W - r.x, dy: 0 }, // to the east
    { dx: -(r.x + r.w), dy: 0 }, // to the west
    { dx: 0, dy: fp.D - r.y }, // north
    { dx: 0, dy: -(r.y + r.d) }, // south
  ];
  const best = moves.reduce((a, b) => (Math.abs(a.dx) + Math.abs(a.dy) <= Math.abs(b.dx) + Math.abs(b.dy) ? a : b));
  return { ...r, x: r.x + best.dx, y: r.y + best.dy };
}

/** Depth away from the wall so `headCount` animals get the recommended area along a `widthFt` frontage (2' steps, 12'–120'). */
export function defaultRunDepth(species: Species | undefined, headCount: number, widthFt: number): number {
  const g = runGuidanceFor(species);
  const need = g.recSqFtPerHead * Math.max(1, headCount);
  const depth = Math.ceil(need / Math.max(1, widthFt) / 2) * 2;
  return Math.max(12, Math.min(120, depth));
}

function edgeLength(r: Rect, side: Side): number {
  return side === "n" || side === "s" ? r.w : r.d;
}

function defaultRunName(model: BuildingModel, species: Species | undefined, zone?: Zone): string {
  if (zone) return `${zone.name} run`;
  const label = species ? SPECIES_PRESETS[species].label.split(" /")[0] : "Run";
  const n = model.runs.filter((x) => x.species === species && !x.zoneId).length + 1;
  return species ? `${label} run ${n}` : `Run ${model.runs.length + 1}`;
}

/** Rect for a run hung on a wall side, centred at clockwise wall coordinate `u`, `widthFt` along the wall and `depthFt` out from it. */
export function runRectOnWall(model: BuildingModel, side: Side, u: number, widthFt: number, depthFt: number): Rect | null {
  const fp = footprint(model);
  if (!fp) return null;
  const wallLen = side === "n" || side === "s" ? fp.W : fp.D;
  const width = Math.min(wallLen, widthFt);
  // Clockwise wall coordinate -> plan position along the wall.
  let along = side === "s" ? u : side === "e" ? u : side === "n" ? fp.W - u : fp.D - u;
  along = Math.round(Math.max(0, Math.min(wallLen - width, along - width / 2)));
  if (side === "s") return { x: along, y: -depthFt, w: width, d: depthFt };
  if (side === "n") return { x: along, y: fp.D, w: width, d: depthFt };
  if (side === "e") return { x: fp.W, y: along, w: depthFt, d: width };
  return { x: -depthFt, y: along, w: depthFt, d: width };
}

/** The pen whose outside edge covers clockwise wall coordinate `u` on `side`, if any. */
export function penAtWall(model: BuildingModel, side: Side, u: number): Zone | null {
  for (const z of model.zones) {
    if (z.type !== "pen" && z.type !== "kidding") continue;
    const e = exteriorEdgesOf(model, z).find((x) => x.side === side);
    if (e && u >= e.centerFt - e.lengthFt / 2 - 1e-6 && u <= e.centerFt + e.lengthFt / 2 + 1e-6) return z;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export interface AddRunInput {
  /** Hang the run on this pen's outside wall (the pen must touch one). */
  zoneId?: string;
  /** Or on this wall side, centred at `offsetFt` along the wall (clockwise wall coordinate). */
  side?: Side;
  offsetFt?: number;
  /** Or an explicit rectangle. */
  rect?: Rect;
  widthFt?: number;
  depthFt?: number;
  species?: Species;
  headCount?: number;
  fence?: Partial<Run["fence"]>;
  name?: string;
  id?: string;
}

export function addRun(model: BuildingModel, input: AddRunInput): BuildingModel {
  const fp = footprint(model);
  if (!fp) return model;
  const zone = input.zoneId ? model.zones.find((z) => z.id === input.zoneId) : undefined;
  if (input.zoneId && !zone) return model;
  const species = input.species ?? zone?.species;
  const headCount = Math.max(1, input.headCount ?? zone?.headCount ?? 1);
  const g = runGuidanceFor(species);
  let rect: Rect | null = null;
  let attachedSide: Side | null = null;

  if (input.rect) {
    rect = { ...input.rect };
  } else if (zone) {
    const edges = exteriorEdgesOf(model, zone);
    if (!edges.length) return model;
    // Prefer the wall with a door out of this pen (its own Dutch door, or any door in its span), then the longest outside edge.
    const hasDoor = (e: ExteriorEdge) =>
      model.openings.some((o) => o.type !== "window" && o.wallId === `wall_ext_${e.side}` && (o.zoneId === zone.id || (o.offsetFt + o.widthFt > e.centerFt - e.lengthFt / 2 + 1e-6 && o.offsetFt < e.centerFt + e.lengthFt / 2 - 1e-6)));
    const edge = edges.find(hasDoor) ?? edges.slice().sort((a, b) => b.lengthFt - a.lengthFt)[0];
    const r = zoneRect(zone);
    const width = input.widthFt ?? edge.lengthFt;
    const depth = input.depthFt ?? defaultRunDepth(species, headCount, width);
    attachedSide = edge.side;
    if (edge.side === "s") rect = { x: r.x, y: -depth, w: width, d: depth };
    else if (edge.side === "n") rect = { x: r.x, y: fp.D, w: width, d: depth };
    else if (edge.side === "e") rect = { x: fp.W, y: r.y, w: depth, d: r.d };
    else rect = { x: -depth, y: r.y, w: depth, d: r.d };
    if (edge.side === "e" || edge.side === "w") rect = { ...rect, w: input.depthFt ?? defaultRunDepth(species, headCount, r.d), d: input.widthFt ?? r.d };
    if (edge.side === "w") rect.x = -rect.w;
  } else if (input.side) {
    const side = input.side;
    attachedSide = side;
    const wallLen = side === "n" || side === "s" ? fp.W : fp.D;
    const width = Math.min(wallLen, input.widthFt ?? 24);
    const depth = input.depthFt ?? defaultRunDepth(species, headCount, width);
    rect = runRectOnWall(model, side, input.offsetFt ?? wallLen / 2, width, depth);
  }
  if (!rect) return model;
  rect = clampRunOutside(model, rect);
  const fence: Run["fence"] = { kind: input.fence?.kind ?? g.fence, heightFt: input.fence?.heightFt ?? g.fenceHeightFt, topRail: input.fence?.topRail ?? false };
  const run: Run = {
    id: input.id ?? newId("run"),
    name: input.name ?? defaultRunName(model, species, zone),
    species,
    zoneId: zone?.id,
    headCount,
    rect: { x: rect.x, y: rect.y, w: rect.w, d: rect.d },
    fence,
    gates: [],
  };
  // One walk gate on the side away from the barn (a run off the south wall opens to the south).
  const outer = attachedSide ?? outerSide(model, run);
  const len = edgeLength(rect, outer);
  run.gates.push({ id: newId("gate"), side: outer, offsetFt: Math.max(0, Math.round(len / 2 - 2)), widthFt: Math.min(4, len) });
  return touch({ ...model, runs: [...model.runs, run] });
}

export function updateRun(model: BuildingModel, id: string, patch: Partial<Omit<Run, "id" | "fence">> & { fence?: Partial<Run["fence"]> }): BuildingModel {
  const idx = model.runs.findIndex((r) => r.id === id);
  if (idx < 0) return model;
  const cur = model.runs[idx];
  const next: Run = { ...cur, ...patch, fence: { ...cur.fence, ...(patch.fence ?? {}) }, gates: patch.gates ?? cur.gates };
  if (patch.rect) {
    const r = clampRunOutside(model, { x: patch.rect.x, y: patch.rect.y, w: Math.max(4, patch.rect.w), d: Math.max(4, patch.rect.d) });
    next.rect = { x: r.x, y: r.y, w: r.w, d: r.d };
  }
  if (patch.headCount !== undefined) next.headCount = Math.max(1, Math.round(patch.headCount));
  next.fence.heightFt = Math.max(2, Math.min(8, next.fence.heightFt));
  next.gates = next.gates.map((gt) => clampGate(next, gt));
  if (JSON.stringify(next) === JSON.stringify(cur)) return model;
  const runs = model.runs.slice();
  runs[idx] = next;
  return touch({ ...model, runs });
}

export function moveRun(model: BuildingModel, id: string, x: number, y: number): BuildingModel {
  const run = model.runs.find((r) => r.id === id);
  if (!run) return model;
  return updateRun(model, id, { rect: { ...run.rect, x: Math.round(x), y: Math.round(y) } });
}

export function resizeRun(model: BuildingModel, id: string, rect: Rect): BuildingModel {
  return updateRun(model, id, { rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.max(4, Math.round(rect.w)), d: Math.max(4, Math.round(rect.d)) } });
}

export function removeRun(model: BuildingModel, id: string): BuildingModel {
  if (!model.runs.some((r) => r.id === id)) return model;
  return touch({ ...model, runs: model.runs.filter((r) => r.id !== id) });
}

/** Grow the run away from the barn until each animal has the recommended area. */
export function fitRunToHead(model: BuildingModel, id: string): BuildingModel {
  const run = model.runs.find((r) => r.id === id);
  if (!run) return model;
  const g = runGuidanceFor(run.species);
  const need = g.recSqFtPerHead * run.headCount;
  if (runArea(run) >= need) return model;
  const outer = outerSide(model, run);
  const r = runRect(run);
  if (outer === "n" || outer === "s") {
    const d = Math.ceil(need / r.w);
    return updateRun(model, id, { rect: outer === "n" ? { ...r, d } : { ...r, y: r.y + r.d - d, d } });
  }
  const w = Math.ceil(need / r.d);
  return updateRun(model, id, { rect: outer === "e" ? { ...r, w } : { ...r, x: r.x + r.w - w, w } });
}

function clampGate(run: Run, g: RunGate): RunGate {
  const len = edgeLength(runRect(run), g.side);
  const widthFt = Math.max(2, Math.min(len, g.widthFt));
  const offsetFt = Math.max(0, Math.min(len - widthFt, Math.round(g.offsetFt * 2) / 2));
  return { ...g, widthFt, offsetFt };
}

export interface AddGateInput {
  side?: Side;
  offsetFt?: number;
  widthFt?: number;
  id?: string;
}

export function addRunGate(model: BuildingModel, runId: string, input: AddGateInput = {}): BuildingModel {
  const run = model.runs.find((r) => r.id === runId);
  if (!run) return model;
  const r = runRect(run);
  const widthFt = input.widthFt ?? 4;
  const free = runEdges(model, run).filter((e) => !e.onBuilding).map((e) => e.side);
  // Sides to try: the one asked for, else the side away from the barn, then the longest free sides.
  const candidates = input.side ? [input.side] : [outerSide(model, run), ...free.filter((s) => s !== outerSide(model, run)).sort((a, b) => edgeLength(r, b) - edgeLength(r, a))];
  const overlaps = (g: RunGate) => run.gates.some((x) => x.side === g.side && x.offsetFt < g.offsetFt + g.widthFt && g.offsetFt < x.offsetFt + x.widthFt);
  for (const side of candidates) {
    const len = edgeLength(r, side);
    if (!input.side && widthFt > len) continue; // a 12' gate needs a 12' side
    const w = Math.min(widthFt, len);
    // Centred, else the first slot along the side that is clear of the other gates.
    const slots = [Math.max(0, len / 2 - w / 2), ...run.gates.filter((g) => g.side === side).map((g) => g.offsetFt + g.widthFt + 1), 0];
    for (const off of input.offsetFt !== undefined ? [input.offsetFt] : slots) {
      const gate = clampGate(run, { id: input.id ?? newId("gate"), side, offsetFt: off, widthFt: w });
      if (!overlaps(gate)) return updateRun(model, runId, { gates: [...run.gates, gate] });
      if (input.offsetFt !== undefined) return model;
    }
  }
  return model;
}

export function updateRunGate(model: BuildingModel, runId: string, gateId: string, patch: Partial<Omit<RunGate, "id">>): BuildingModel {
  const run = model.runs.find((r) => r.id === runId);
  if (!run) return model;
  return updateRun(model, runId, { gates: run.gates.map((g) => (g.id === gateId ? { ...g, ...patch } : g)) });
}

export function removeRunGate(model: BuildingModel, runId: string, gateId: string): BuildingModel {
  const run = model.runs.find((r) => r.id === runId);
  if (!run) return model;
  return updateRun(model, runId, { gates: run.gates.filter((g) => g.id !== gateId) });
}

/** Runs hung on a pen. */
export function runsForZone(model: BuildingModel, zoneId: string): Run[] {
  return model.runs.filter((r) => r.zoneId === zoneId);
}

/** Pens on an outside wall that have no run yet get one, sized for their animals (SPEC §26 attached runs). */
export function autoRuns(model: BuildingModel, ids?: string[]): BuildingModel {
  let m = model;
  let i = 0;
  for (const z of model.zones) {
    if (z.type !== "pen" && z.type !== "kidding") continue;
    if (m.runs.some((r) => r.zoneId === z.id)) continue;
    if (!exteriorEdgesOf(m, z).length) continue;
    m = addRun(m, { zoneId: z.id, id: ids?.[i++] });
  }
  return m;
}

export interface RunGhost {
  rect: Rect;
  side: Side;
  /** Clockwise wall coordinate under the pointer. */
  u: number;
  zoneId?: string;
  label: string;
  /** For the status line. */
  hint: string;
}

/**
 * What the Run tool would add for a pointer at plan point `p`: hung on the
 * nearest outside wall, on the pen there (its width and animals) or a 24'
 * frontage; the depth follows the pointer but never less than the animals need.
 */
export function runGhostAt(model: BuildingModel, p: Pt): RunGhost | null {
  const fp = footprint(model);
  if (!fp) return null;
  const inside = p.x > 0 && p.x < fp.W && p.y > 0 && p.y < fp.D;
  if (inside) return null;
  // Nearest wall side by distance to the footprint edges.
  const cands: { side: Side; dist: number; u: number }[] = [
    { side: "s", dist: Math.abs(p.y), u: Math.max(0, Math.min(fp.W, p.x)) },
    { side: "n", dist: Math.abs(p.y - fp.D), u: Math.max(0, Math.min(fp.W, fp.W - p.x)) },
    { side: "w", dist: Math.abs(p.x), u: Math.max(0, Math.min(fp.D, fp.D - p.y)) },
    { side: "e", dist: Math.abs(p.x - fp.W), u: Math.max(0, Math.min(fp.D, p.y)) },
  ];
  // Only walls whose span the pointer is beside count first; otherwise the nearest corner wall.
  const beside = cands.filter((c) => (c.side === "s" || c.side === "n" ? p.x >= 0 && p.x <= fp.W : p.y >= 0 && p.y <= fp.D));
  const hit = (beside.length ? beside : cands).sort((a, b) => a.dist - b.dist)[0];
  const pen = penAtWall(model, hit.side, hit.u);
  const species = pen?.species;
  const head = pen?.headCount ?? 1;
  const pr = pen ? zoneRect(pen) : null;
  const width = pr ? (hit.side === "n" || hit.side === "s" ? pr.w : pr.d) : 24;
  const depth = Math.max(defaultRunDepth(species, head, width), Math.min(120, Math.round(hit.dist)));
  const u = pen ? (exteriorEdgesOf(model, pen).find((e) => e.side === hit.side)?.centerFt ?? hit.u) : hit.u;
  const rect = runRectOnWall(model, hit.side, u, width, depth);
  if (!rect) return null;
  const animal = SPECIES_PRESETS[species ?? "generic"].label.toLowerCase().split(" /")[0];
  const sideName = { n: "north", s: "south", e: "east", w: "west" }[hit.side];
  return { rect, side: hit.side, u: hit.u, zoneId: pen?.id, label: pen ? `${pen.name} run` : "Run", hint: `Click to add a ${rect.w}' × ${rect.d}' run ${pen ? `off ${pen.name} for its ${animal}s` : `on the ${sideName} wall`} · ${runGuidanceFor(species).recSqFtPerHead} sq ft each recommended` };
}

/** Plan-space bounds of the barn plus its lean-tos and runs, for fitting views. */
export function siteExtent(model: BuildingModel): Rect {
  const fp = footprint(model) ?? { W: 24, D: 36 };
  let x0 = 0, y0 = 0, x1 = fp.W, y1 = fp.D;
  for (const lt of model.leanTos) {
    if (lt.side === "e") x1 = Math.max(x1, fp.W + lt.depthFt);
    if (lt.side === "w") x0 = Math.min(x0, -lt.depthFt);
    if (lt.side === "n") y1 = Math.max(y1, fp.D + lt.depthFt);
    if (lt.side === "s") y0 = Math.min(y0, -lt.depthFt);
  }
  for (const r of model.runs) {
    x0 = Math.min(x0, r.rect.x);
    y0 = Math.min(y0, r.rect.y);
    x1 = Math.max(x1, r.rect.x + r.rect.w);
    y1 = Math.max(y1, r.rect.y + r.rect.d);
  }
  for (const f of model.fences)
    for (const p of f.points) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  return { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
}
