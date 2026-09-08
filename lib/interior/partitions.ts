/**
 * Interior partitions DERIVED from zone edges (SPEC §5.3, §24). Every zone
 * edge that is not on an exterior wall becomes a partition; shared edges are
 * deduplicated. Pen edges facing an aisle get a stall door; pen edges on an
 * exterior wall with `outsideAccess` are reported so the envelope can react.
 */
import type { BuildingModel, InteriorDoor, InteriorDoorType, Zone } from "@/lib/model/schema";
import { zoneRect, type Rect } from "@/lib/model/zones";
import { SPECIES_PRESETS, type SpeciesPreset } from "@/rules/animals/presets";
import { defaultInteriorDoorSize, defaultInteriorDoorType, doorSegment } from "@/lib/model/interiorDoors";

export type PartitionKind = "stall" | "full" | "low";

export interface PartitionDoor {
  /** Door id (`auto_<zoneId>` for the derived default door). */
  id: string;
  /** Distance from the partition start, feet. */
  u: number;
  widthFt: number;
  heightFt: number;
  /** Which zone the door serves. */
  zoneId: string;
  type: InteriorDoorType;
  swing: InteriorDoor["swing"];
  hinge: InteriorDoor["hinge"];
  /** True for the derived default door (no InteriorDoor record behind it). */
  auto: boolean;
  /** Plan segment of the door (start < end along the partition). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Side of the partition the zone is on: -1 lower coordinate, +1 higher. */
  zoneSide: -1 | 1;
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

  const pushDoor = (p: Partition, z: Zone, u: number, d: Pick<InteriorDoor, "id" | "type" | "widthFt" | "heightFt" | "swing" | "hinge">, auto: boolean) => {
    const vertical = Math.abs(p.x1 - p.x0) < EPS;
    const zoneSide: -1 | 1 = p.zones[0]?.id === z.id ? -1 : 1;
    p.doors.push({
      id: d.id,
      u,
      widthFt: d.widthFt,
      heightFt: d.heightFt,
      zoneId: z.id,
      type: d.type,
      swing: d.swing,
      hinge: d.hinge,
      auto,
      x0: vertical ? p.x0 : p.x0 + u,
      y0: vertical ? p.y0 + u : p.y0,
      x1: vertical ? p.x0 : p.x0 + u + d.widthFt,
      y1: vertical ? p.y0 + u + d.widthFt : p.y0,
      zoneSide,
    });
  };

  for (const z of model.zones) {
    if (z.doors.length > 0) {
      // Explicit doors: land each one in the partition that contains its centre.
      const r = zoneRect(z);
      for (const d of z.doors) {
        const seg = doorSegment(r, d);
        const vertical = d.side === "e" || d.side === "w";
        const c = vertical ? seg.x0 : seg.y0;
        const mid = vertical ? (seg.y0 + seg.y1) / 2 : (seg.x0 + seg.x1) / 2;
        const host = out.find((p) => {
          const pv = Math.abs(p.x1 - p.x0) < EPS;
          if (pv !== vertical) return false;
          const pc = pv ? p.x0 : p.y0;
          if (Math.abs(pc - c) > EPS) return false;
          const a0 = pv ? p.y0 : p.x0;
          const a1 = pv ? p.y1 : p.x1;
          return a0 - EPS <= mid && mid <= a1 + EPS;
        });
        if (!host) continue; // edge is on the exterior wall or open floor: no partition to hold a door
        const start = vertical ? host.y0 : host.x0;
        const u0 = Math.max(0, (vertical ? seg.y0 : seg.x0) - start);
        const w = Math.min(d.widthFt, host.lengthFt - u0);
        if (w < 1) continue;
        pushDoor(host, z, u0, { ...d, widthFt: w }, false);
      }
      continue;
    }
    if (!z.autoDoor || z.type === "aisle" || z.type === "open") continue;
    // Default door: one on the longest shared edge with an aisle (or any non-pen neighbour for rooms).
    const candidates = out.filter((p) => p.zones.some((q) => q?.id === z.id) && p.zones.some((q) => q && q.id !== z.id && (q.type === "aisle" || (isRoom(z) && q.type !== "pen"))));
    if (candidates.length === 0) continue;
    const best = candidates.sort((a, b) => b.lengthFt - a.lengthFt)[0];
    const type = defaultInteriorDoorType(z);
    const size = defaultInteriorDoorSize(type, z.species);
    const doorW = Math.min(best.lengthFt - 0.5, size.widthFt);
    if (doorW < 2) continue;
    pushDoor(best, z, best.lengthFt / 2 - doorW / 2, { id: `auto_${z.id}`, type, widthFt: doorW, heightFt: size.heightFt, swing: type === "stallSlide" ? "slideRight" : "out", hinge: "left" }, true);
  }
  return out;
}

/** Every door in the interior, with its host partition (for hit-testing, schedules and drawings). */
export function interiorDoors(model: BuildingModel): { partition: Partition; door: PartitionDoor }[] {
  return derivePartitions(model).flatMap((partition) => partition.doors.map((door) => ({ partition, door })));
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
