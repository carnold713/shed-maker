/**
 * Interior partitions DERIVED from zone edges (SPEC §5.3, §24). Every zone
 * edge that is not on an exterior wall becomes a partition; shared edges are
 * deduplicated. Pen edges facing an aisle get a stall door; pen edges on an
 * exterior wall with `outsideAccess` are reported so the envelope can react.
 */
import type { BuildingModel, Zone } from "@/lib/model/schema";
import { zoneRect, type Rect } from "@/lib/model/zones";
import { SPECIES_PRESETS, type SpeciesPreset } from "@/rules/animals/presets";

export type PartitionKind = "stall" | "full" | "low";

export interface PartitionDoor {
  /** Distance from the partition start, feet. */
  u: number;
  widthFt: number;
  /** Which zone the door serves. */
  zoneId: string;
}

export interface Partition {
  id: string;
  /** Plan endpoints; axis-aligned, start < end. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lengthFt: number;
  kind: PartitionKind;
  /** Solid height and total height, feet. */
  kickFt: number;
  topFt: number;
  /** Zones on each side (in the order [lower/left, upper/right]). */
  zones: [Zone | null, Zone | null];
  doors: PartitionDoor[];
  /** True when the partition line sits on a post line (bay grid). */
  onPostLine: boolean;
}

interface Edge {
  axis: "x" | "y";
  c: number; // constant coordinate
  a0: number; // interval along the other axis
  a1: number;
  zone: Zone;
  /** Which side of the line the zone is on: -1 = lower coordinate side, +1 = higher. */
  side: -1 | 1;
}

const EPS = 1e-6;

function edgesOf(z: Zone): Edge[] {
  const r = zoneRect(z);
  return [
    { axis: "x", c: r.x, a0: r.y, a1: r.y + r.d, zone: z, side: 1 },
    { axis: "x", c: r.x + r.w, a0: r.y, a1: r.y + r.d, zone: z, side: -1 },
    { axis: "y", c: r.y, a0: r.x, a1: r.x + r.w, zone: z, side: 1 },
    { axis: "y", c: r.y + r.d, a0: r.x, a1: r.x + r.w, zone: z, side: -1 },
  ];
}

function isRoom(z: Zone | null) {
  return !!z && !["pen", "kidding", "aisle", "open"].includes(z.type);
}

export function derivePartitions(model: BuildingModel): Partition[] {
  if (model.footprint.kind !== "rect") return [];
  const { wFt: W, dFt: D } = model.footprint;
  const edges = model.zones.flatMap(edgesOf);
  const out: Partition[] = [];
  const bayAxis = model.roof.ridgeAxis === "ns" ? "y" : "x";

  // Group by (axis, c); split into breakpoints; for each elementary interval decide the partition.
  const groups = new Map<string, Edge[]>();
  for (const e of edges) {
    const key = `${e.axis}:${e.c.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  let n = 0;
  for (const [key, list] of groups) {
    const axis = list[0].axis;
    const c = list[0].c;
    const extent = axis === "x" ? W : D;
    if (Math.abs(c) < EPS || Math.abs(c - extent) < EPS) continue; // exterior wall
    const pts = [...new Set(list.flatMap((e) => [e.a0, e.a1]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
    let current: Partition | null = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a0 = pts[i];
      const a1 = pts[i + 1];
      const mid = (a0 + a1) / 2;
      const covering = list.filter((e) => e.a0 <= mid && e.a1 >= mid);
      if (covering.length === 0) {
        current = null;
        continue;
      }
      const lower = covering.find((e) => e.side === -1)?.zone ?? null; // zone on the lower-coordinate side
      const upper = covering.find((e) => e.side === 1)?.zone ?? null;
      const pair: [Zone | null, Zone | null] = [lower, upper];
      const kind: PartitionKind = isRoom(lower) || isRoom(upper) ? "full" : "stall";
      // Merge with the previous interval if it has the same neighbours.
      if (current && current.zones[0]?.id === lower?.id && current.zones[1]?.id === upper?.id) {
        if (axis === "x") current.y1 = a1;
        else current.x1 = a1;
        current.lengthFt = a1 - (axis === "x" ? current.y0 : current.x0);
        continue;
      }
      const speciesZone: Zone | undefined = [lower, upper].find((z): z is Zone => !!z && (z.type === "pen" || z.type === "kidding"));
      const preset: SpeciesPreset = speciesZone?.species ? SPECIES_PRESETS[speciesZone.species] : SPECIES_PRESETS.generic;
      current = {
        id: `part_${key}_${n++}`,
        x0: axis === "x" ? c : a0,
        y0: axis === "x" ? a0 : c,
        x1: axis === "x" ? c : a1,
        y1: axis === "x" ? a1 : c,
        lengthFt: a1 - a0,
        kind,
        kickFt: kind === "full" ? Math.min(model.eaveHeightFt, 10) : preset.kickWallFt,
        topFt: kind === "full" ? Math.min(model.eaveHeightFt, 10) : preset.partitionTopFt,
        zones: pair,
        doors: [],
        onPostLine: axis === bayAxis ? Math.abs(c / model.frame.bayFt - Math.round(c / model.frame.bayFt)) < 1e-6 : false,
      };
      out.push(current);
    }
  }

  // Doors: each pen/room gets one door on its longest shared edge with an aisle (or any non-pen neighbour for rooms).
  for (const z of model.zones) {
    if (z.type === "aisle" || z.type === "open") continue;
    const candidates = out.filter((p) => p.zones.some((q) => q?.id === z.id) && p.zones.some((q) => q && q.id !== z.id && (q.type === "aisle" || (isRoom(z) && q.type !== "pen"))));
    if (candidates.length === 0) continue;
    const best = candidates.sort((a, b) => b.lengthFt - a.lengthFt)[0];
    const preset = z.species ? SPECIES_PRESETS[z.species] : null;
    const doorW = Math.min(best.lengthFt - 0.5, preset ? preset.doorFt : 3);
    if (doorW < 2) continue;
    best.doors.push({ u: best.lengthFt / 2 - doorW / 2, widthFt: doorW, zoneId: z.id });
  }
  return out;
}

/** Pens flagged for outside access whose rect touches an exterior wall: [zone, wall side, centre along that wall]. */
export function outsideAccessRequests(model: BuildingModel): { zone: Zone; side: "n" | "s" | "e" | "w"; centerFt: number; rect: Rect }[] {
  if (model.footprint.kind !== "rect") return [];
  const { wFt: W, dFt: D } = model.footprint;
  const out: { zone: Zone; side: "n" | "s" | "e" | "w"; centerFt: number; rect: Rect }[] = [];
  for (const z of model.zones) {
    if (!z.outsideAccess) continue;
    const r = zoneRect(z);
    // Walls are walked clockwise from SW: S u = x; E u = y; N u = W - x; W u = D - y.
    if (Math.abs(r.y) < EPS) out.push({ zone: z, side: "s", centerFt: r.x + r.w / 2, rect: r });
    else if (Math.abs(r.x + r.w - W) < EPS) out.push({ zone: z, side: "e", centerFt: r.y + r.d / 2, rect: r });
    else if (Math.abs(r.y + r.d - D) < EPS) out.push({ zone: z, side: "n", centerFt: W - (r.x + r.w / 2), rect: r });
    else if (Math.abs(r.x) < EPS) out.push({ zone: z, side: "w", centerFt: D - (r.y + r.d / 2), rect: r });
  }
  return out;
}
