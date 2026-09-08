/**
 * Fencing takeoff for the outdoor runs (ADR-0017, docs/research/runs-and-fencing.md §6).
 * Derived only: fence lines are the run edges that are not the barn wall,
 * with lines shared between two runs counted once; posts at the preset
 * spacing plus a post at every corner and two at every gate; rolls, boards,
 * panels or strands by fence kind; H-brace assemblies where wire pulls on
 * corner and gate posts.
 */
import type { BuildingModel, FenceKind, Run } from "@/lib/model/schema";
import { FENCE_PRESETS, runArea, runEdges, runSqFtPerHead, type RunEdge } from "@/lib/model/runs";

export interface RunFencing {
  runId: string;
  name: string;
  areaSqFt: number;
  sqFtPerHead: number;
  fenceKind: FenceKind;
  heightFt: number;
  /** Fence this run adds, after lines shared with another run are counted once. */
  fenceFt: number;
  /** Length of its fence lines that another run already counted. */
  sharedFt: number;
  linePosts: number;
  cornerPosts: number;
  gatePosts: number;
  gates: { widthFt: number; kind: "walk" | "drive" }[];
}

export interface FenceKindTakeoff {
  kind: FenceKind;
  label: string;
  fenceFt: number;
  linePosts: number;
  cornerPosts: number;
  gatePosts: number;
  /** H-brace assemblies (wire fences). */
  braces: number;
  /** Rolls / boards / panels / strand feet per the preset's material. */
  rolls: number;
  boards: number;
  panels: number;
  strandFt: number;
  insulators: number;
  topRailBoards: number;
  /** Bags of concrete for corner and gate posts. */
  concreteBags: number;
  sku: string;
}

export interface FencingDerived {
  runs: RunFencing[];
  byKind: FenceKindTakeoff[];
  totalFenceFt: number;
  totalPosts: number;
  gates: { widthFt: number; count: number }[];
  chargers: number;
  notes: string[];
}

interface Seg {
  runId: string;
  edge: RunEdge;
  axis: "x" | "y";
  c: number;
  a0: number;
  a1: number;
}

function segOf(runId: string, e: RunEdge): Seg {
  const vertical = Math.abs(e.x1 - e.x0) < 1e-9;
  return vertical ? { runId, edge: e, axis: "x", c: e.x0, a0: Math.min(e.y0, e.y1), a1: Math.max(e.y0, e.y1) } : { runId, edge: e, axis: "y", c: e.y0, a0: Math.min(e.x0, e.x1), a1: Math.max(e.x0, e.x1) };
}

/** Round a gate width up to a stock tube gate (4, 6, 8, 10, 12, 14, 16). */
export function stockGateFt(widthFt: number): number {
  const stock = [4, 6, 8, 10, 12, 14, 16];
  return stock.find((s) => s >= widthFt - 1e-6) ?? 16;
}

export function deriveFencing(model: BuildingModel): FencingDerived {
  const runs = model.runs;
  const segs: Seg[] = [];
  for (const r of runs) for (const e of runEdges(model, r)) if (!e.onBuilding) segs.push(segOf(r.id, e));
  // Shared lines: a later run's segment overlapping an earlier run's colinear segment is counted once.
  const sharedByRun = new Map<string, number>();
  for (let j = 0; j < segs.length; j++) {
    const b = segs[j];
    let shared = 0;
    for (let i = 0; i < j; i++) {
      const a = segs[i];
      if (a.runId === b.runId || a.axis !== b.axis || Math.abs(a.c - b.c) > 1e-6) continue;
      const o = Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0);
      if (o > 1e-6) shared += o;
    }
    sharedByRun.set(b.runId, (sharedByRun.get(b.runId) ?? 0) + Math.min(shared, b.a1 - b.a0));
  }
  // Corner posts deduped by point across runs.
  const cornerPts = new Set<string>();
  const cornersOf = (r: Run) => {
    const pts = [
      [r.rect.x, r.rect.y],
      [r.rect.x + r.rect.w, r.rect.y],
      [r.rect.x, r.rect.y + r.rect.d],
      [r.rect.x + r.rect.w, r.rect.y + r.rect.d],
    ];
    let n = 0;
    for (const [x, y] of pts) {
      const k = `${x.toFixed(3)},${y.toFixed(3)}`;
      if (cornerPts.has(k)) continue;
      cornerPts.add(k);
      n++;
    }
    return n;
  };

  const perRun: RunFencing[] = [];
  const byKind = new Map<FenceKind, FenceKindTakeoff>();
  const gateCounts = new Map<number, number>();
  let chargers = 0;
  const notes: string[] = [];
  for (const r of runs) {
    const preset = FENCE_PRESETS[r.fence.kind];
    const edges = runEdges(model, r).filter((e) => !e.onBuilding);
    const gross = edges.reduce((s, e) => s + e.lengthFt, 0);
    const shared = sharedByRun.get(r.id) ?? 0;
    const fenceFt = Math.max(0, gross - shared);
    // Line posts: one every spacing along each fenced edge, minus the corner at each end; shared edges scaled down.
    const share = gross > 0 ? fenceFt / gross : 0;
    const gateFt = r.gates.reduce((s, g) => s + g.widthFt, 0);
    const linePosts = Math.round(edges.reduce((s, e) => s + Math.max(0, Math.ceil(e.lengthFt / preset.postSpacingFt) - 1), 0) * share);
    const cornerPosts = cornersOf(r);
    const gatePosts = r.gates.length * 2;
    const gates = r.gates.map((g) => ({ widthFt: stockGateFt(g.widthFt), kind: (g.widthFt >= 10 ? "drive" : "walk") as "walk" | "drive" }));
    for (const g of gates) gateCounts.set(g.widthFt, (gateCounts.get(g.widthFt) ?? 0) + 1);
    perRun.push({ runId: r.id, name: r.name, areaSqFt: runArea(r), sqFtPerHead: Math.round(runSqFtPerHead(r)), fenceKind: r.fence.kind, heightFt: r.fence.heightFt, fenceFt: +fenceFt.toFixed(1), sharedFt: +shared.toFixed(1), linePosts, cornerPosts, gatePosts, gates });

    const k = byKind.get(r.fence.kind) ?? { kind: r.fence.kind, label: preset.label, fenceFt: 0, linePosts: 0, cornerPosts: 0, gatePosts: 0, braces: 0, rolls: 0, boards: 0, panels: 0, strandFt: 0, insulators: 0, topRailBoards: 0, concreteBags: 0, sku: preset.sku };
    const netFt = Math.max(0, fenceFt - gateFt);
    k.fenceFt += netFt;
    k.linePosts += linePosts;
    k.cornerPosts += cornerPosts;
    k.gatePosts += gatePosts;
    if (preset.braced) k.braces += cornerPosts + gatePosts;
    if (preset.material === "roll" && preset.unitFt) k.rolls += netFt / preset.unitFt;
    if (preset.material === "board" && preset.unitFt && preset.rails) k.boards += Math.ceil(netFt / preset.unitFt) * preset.rails;
    if (preset.material === "panel" && preset.unitFt) k.panels += Math.ceil(netFt / preset.unitFt);
    if (preset.material === "strand" && preset.rails) {
      k.strandFt += netFt * preset.rails;
      k.insulators += (linePosts + cornerPosts + gatePosts) * preset.rails;
    }
    if (r.fence.topRail && preset.material !== "board") k.topRailBoards += Math.ceil(netFt / 16);
    k.concreteBags += cornerPosts + gatePosts * 2;
    byKind.set(r.fence.kind, k);
    if (r.fence.kind === "electric") chargers = 1;
    if (r.fence.kind === "poultryNet") notes.push(`${r.name}: bury a 12" skirt of the mesh outward and cover the top — hawks and diggers.`);
  }
  for (const k of byKind.values()) {
    k.rolls = Math.ceil(k.rolls);
    k.fenceFt = +k.fenceFt.toFixed(1);
  }
  const totalFenceFt = +perRun.reduce((s, r) => s + r.fenceFt, 0).toFixed(1);
  const totalPosts = perRun.reduce((s, r) => s + r.linePosts + r.cornerPosts + r.gatePosts, 0);
  if (runs.some((r) => r.fence.kind === "noClimb" || r.fence.kind === "wovenWire")) notes.push("Wire fences: set corner and gate posts in concrete with an H-brace, stretch the wire from the brace, staple loosely so it can move with temperature.");
  if (runs.length) notes.push("Post holes: line posts 30–36\" deep (a third of the post), corner and gate posts 42–48\" and below frost; grade the run away from the barn at 2% so water leaves the door.");
  return { runs: perRun, byKind: [...byKind.values()], totalFenceFt, totalPosts, gates: [...gateCounts.entries()].sort((a, b) => a[0] - b[0]).map(([widthFt, count]) => ({ widthFt, count })), chargers, notes };
}
