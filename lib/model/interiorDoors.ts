/**
 * Doors in interior partitions (stall fronts, room doors) — ADR-0014.
 * A door belongs to the zone it serves and sits in one of that zone's four
 * edges. The partition it lands in is derived (lib/interior/partitions), so
 * moving the zone moves its doors; resizing clamps them (zones.ts).
 */
import type { BuildingModel, InteriorDoor, InteriorDoorType, Species, Zone } from "./schema";
import { clampDoorsToRect, zoneRect, type Rect } from "./zones";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { newId } from "./ids";

export interface InteriorDoorPreset {
  type: InteriorDoorType;
  label: string;
  /** Plain-English blurb for pickers. */
  hint: string;
  widthFt: number;
  heightFt: number;
  /** Solid leaf (wood / steel) vs stall leaf (solid to kick height, grille above). */
  leaf: "stall" | "solid" | "none";
  hinged: boolean;
  /** Hardware per door for the schedule (rules/materials/prices skus). */
  hardware: { sku: string; qty: number; label: string }[];
  /** Price sku of the door unit itself; undefined = site-built from lumber. */
  unitSku?: string;
}

export const INTERIOR_DOOR_PRESETS: Record<InteriorDoorType, InteriorDoorPreset> = {
  stallSlide: {
    type: "stallSlide",
    label: "Sliding stall door",
    hint: "Hangs on a track above the stall front; never swings into the aisle.",
    widthFt: 4,
    heightFt: 7,
    leaf: "stall",
    hinged: false,
    hardware: [
      { sku: "hw.stallTrack", qty: 1, label: "Box track, 2× door width" },
      { sku: "hw.stallHanger", qty: 2, label: "Trolley hangers" },
      { sku: "hw.stallLatch", qty: 1, label: "Slide latch" },
      { sku: "hw.floorGuide", qty: 1, label: "Floor guide" },
    ],
    unitSku: "door.stallSlide",
  },
  stallHinged: {
    type: "stallHinged",
    label: "Hinged stall door",
    hint: "Swings out into the aisle on strap hinges; cheaper, needs aisle room.",
    widthFt: 4,
    heightFt: 7,
    leaf: "stall",
    hinged: true,
    hardware: [
      { sku: "hw.strapHinge", qty: 3, label: "Heavy strap hinges" },
      { sku: "hw.stallLatch", qty: 1, label: "Gravity latch" },
    ],
    unitSku: "door.stallHinged",
  },
  dutch: {
    type: "dutch",
    label: "Dutch (half) door",
    hint: "Two leaves: keep the top open for air and a head over the door.",
    widthFt: 4,
    heightFt: 7,
    leaf: "stall",
    hinged: true,
    hardware: [
      { sku: "hw.strapHinge", qty: 4, label: "Strap hinges (2 per leaf)" },
      { sku: "hw.stallLatch", qty: 2, label: "Latches (one per leaf)" },
      { sku: "hw.holdBack", qty: 1, label: "Hold-back hook" },
    ],
    unitSku: "door.dutchInterior",
  },
  woodHinged: {
    type: "woodHinged",
    label: "Wood door (room)",
    hint: "Pre-hung wood door for tack, feed and office rooms.",
    widthFt: 3,
    heightFt: 6 + 8 / 12,
    leaf: "solid",
    hinged: true,
    hardware: [{ sku: "hw.lockset", qty: 1, label: "Passage lockset" }],
    unitSku: "door.woodPrehung",
  },
  manDoor: {
    type: "manDoor",
    label: "Steel door (room)",
    hint: "Pre-hung insulated steel door; lockable for tack and feed rooms.",
    widthFt: 3,
    heightFt: 6 + 8 / 12,
    leaf: "solid",
    hinged: true,
    hardware: [{ sku: "hw.lockset", qty: 1, label: "Keyed lockset" }],
    unitSku: "door.man",
  },
  cased: {
    type: "cased",
    label: "Open doorway",
    hint: "A framed opening with no door — for hay and equipment bays.",
    widthFt: 4,
    heightFt: 7,
    leaf: "none",
    hinged: false,
    hardware: [],
  },
};

export const INTERIOR_DOOR_TYPES = Object.keys(INTERIOR_DOOR_PRESETS) as InteriorDoorType[];

/** Default door type for a zone: sliding stall doors on pens, wood doors on rooms. */
export function defaultInteriorDoorType(z: Pick<Zone, "type">): InteriorDoorType {
  if (z.type === "pen" || z.type === "kidding") return "stallSlide";
  if (z.type === "hay" || z.type === "equipment") return "cased";
  return "woodHinged";
}

/** Default size for a door type on a zone (species door width for stall types). */
export function defaultInteriorDoorSize(type: InteriorDoorType, species?: Species): { widthFt: number; heightFt: number } {
  const p = INTERIOR_DOOR_PRESETS[type];
  if (p.leaf === "stall" && species) {
    const sp = SPECIES_PRESETS[species];
    return { widthFt: sp.doorFt, heightFt: Math.max(p.heightFt, Math.min(8, sp.partitionTopFt)) };
  }
  return { widthFt: p.widthFt, heightFt: p.heightFt };
}

/** Length of a zone edge, feet. */
export function edgeLengthFt(r: Rect, side: InteriorDoor["side"]): number {
  return side === "n" || side === "s" ? r.w : r.d;
}

/** Plan segment of a door: [start, end] along its edge (west→east or south→north). */
export function doorSegment(r: Rect, d: Pick<InteriorDoor, "side" | "offsetFt" | "widthFt">): { x0: number; y0: number; x1: number; y1: number } {
  switch (d.side) {
    case "s":
      return { x0: r.x + d.offsetFt, y0: r.y, x1: r.x + d.offsetFt + d.widthFt, y1: r.y };
    case "n":
      return { x0: r.x + d.offsetFt, y0: r.y + r.d, x1: r.x + d.offsetFt + d.widthFt, y1: r.y + r.d };
    case "w":
      return { x0: r.x, y0: r.y + d.offsetFt, x1: r.x, y1: r.y + d.offsetFt + d.widthFt };
    case "e":
      return { x0: r.x + r.w, y0: r.y + d.offsetFt, x1: r.x + r.w, y1: r.y + d.offsetFt + d.widthFt };
  }
}

export interface AddInteriorDoorInput {
  zoneId: string;
  side: InteriorDoor["side"];
  /** Near-jamb offset along the edge, feet. Omitted = centred. */
  offsetFt?: number;
  type?: InteriorDoorType;
  widthFt?: number;
  heightFt?: number;
  id?: string;
}

function touch(model: BuildingModel): BuildingModel {
  return { ...model, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
}

const SNAP_FT = 0.5;

export function addInteriorDoor(model: BuildingModel, input: AddInteriorDoorInput): BuildingModel {
  const idx = model.zones.findIndex((z) => z.id === input.zoneId);
  if (idx < 0) return model;
  const z = model.zones[idx];
  const r = zoneRect(z);
  const type = input.type ?? defaultInteriorDoorType(z);
  const size = defaultInteriorDoorSize(type, z.species);
  const widthFt = input.widthFt ?? size.widthFt;
  const heightFt = input.heightFt ?? size.heightFt;
  const len = edgeLengthFt(r, input.side);
  if (widthFt > len - 0.5) return model;
  const centre = input.offsetFt === undefined ? len / 2 - widthFt / 2 : input.offsetFt;
  const offsetFt = Math.min(Math.max(0.25, Math.round(centre / SNAP_FT) * SNAP_FT), len - widthFt - 0.25);
  // Don't stack doors on top of each other in the same edge.
  const overlaps = z.doors.some((d) => d.side === input.side && d.offsetFt < offsetFt + widthFt && offsetFt < d.offsetFt + d.widthFt);
  if (overlaps) return model;
  const door: InteriorDoor = { id: input.id ?? newId("door"), type, side: input.side, offsetFt, widthFt, heightFt, swing: INTERIOR_DOOR_PRESETS[type].hinged ? "out" : "slideRight", hinge: "left" };
  const zones = model.zones.slice();
  zones[idx] = { ...z, doors: [...z.doors, door], autoDoor: false };
  return touch({ ...model, zones });
}

export function updateInteriorDoor(model: BuildingModel, doorId: string, patch: Partial<Omit<InteriorDoor, "id">>): BuildingModel {
  const zi = model.zones.findIndex((z) => z.doors.some((d) => d.id === doorId));
  if (zi < 0) return model;
  const z = model.zones[zi];
  const r = zoneRect(z);
  const doors = z.doors.map((d) => {
    if (d.id !== doorId) return d;
    const next: InteriorDoor = { ...d, ...patch };
    if (patch.type && patch.type !== d.type && patch.widthFt === undefined && patch.heightFt === undefined) {
      const size = defaultInteriorDoorSize(patch.type, z.species);
      next.widthFt = size.widthFt;
      next.heightFt = size.heightFt;
      next.swing = INTERIOR_DOOR_PRESETS[patch.type].hinged ? (d.swing === "in" ? "in" : "out") : d.swing === "slideLeft" ? "slideLeft" : "slideRight";
    }
    next.widthFt = Math.max(1.5, next.widthFt);
    next.heightFt = Math.max(4, Math.min(10, next.heightFt));
    return next;
  });
  const clamped = clampDoorsToRect(doors, r);
  if (JSON.stringify(clamped) === JSON.stringify(z.doors)) return model;
  const zones = model.zones.slice();
  zones[zi] = { ...z, doors: clamped };
  return touch({ ...model, zones });
}

/** Slide a door along its edge (snaps to 6"). */
export function moveInteriorDoor(model: BuildingModel, doorId: string, offsetFt: number): BuildingModel {
  return updateInteriorDoor(model, doorId, { offsetFt: Math.round(offsetFt / SNAP_FT) * SNAP_FT });
}

export function removeInteriorDoor(model: BuildingModel, doorId: string): BuildingModel {
  const zi = model.zones.findIndex((z) => z.doors.some((d) => d.id === doorId));
  if (zi < 0) return model;
  const z = model.zones[zi];
  const zones = model.zones.slice();
  // Removing the last explicit door leaves the zone doorless (no silent auto door coming back).
  zones[zi] = { ...z, doors: z.doors.filter((d) => d.id !== doorId), autoDoor: false };
  return touch({ ...model, zones });
}

/** Turn the derived default door back on (or off) for a zone. */
export function setAutoDoor(model: BuildingModel, zoneId: string, on: boolean): BuildingModel {
  const zi = model.zones.findIndex((z) => z.id === zoneId);
  if (zi < 0) return model;
  const z = model.zones[zi];
  if (z.autoDoor === on && (on ? z.doors.length === 0 : true)) return model;
  const zones = model.zones.slice();
  zones[zi] = { ...z, autoDoor: on, doors: on ? [] : z.doors };
  return touch({ ...model, zones });
}

/** Find a door by id across zones. */
export function findInteriorDoor(model: BuildingModel, doorId: string): { zone: Zone; door: InteriorDoor } | null {
  for (const zone of model.zones) {
    const door = zone.doors.find((d) => d.id === doorId);
    if (door) return { zone, door };
  }
  return null;
}
