/**
 * Geometry is a typed, renderer-agnostic description derived from the model.
 * The 3D scene, the 2D plan, and (later) drawings all consume this — nothing
 * is derived from another derived thing (SPEC §2.2).
 *
 * World space: x east, y up, z SOUTH (so plan +y == world -z). Feet.
 */
import type { Layer } from "@/lib/framing/types";

export type Vec3 = [number, number, number];
export type { Layer };

export type BoxKind =
  | "slab"
  | "wallSkin"
  | "roofPlane"
  | "doorLeaf"
  | "doorFrame"
  | "glazing"
  | "windowFrame"
  | "framing";

export interface BoxMember {
  id: string;
  kind: BoxKind;
  layer: Layer;
  /** Centre of the box in world space. */
  center: Vec3;
  /** Full extents (x, y, z) BEFORE rotation. */
  size: Vec3;
  /** Euler rotation in radians (x, y, z). */
  rotation: Vec3;
  /** Which model entity produced it, for picking/provenance. */
  entityId: string;
  /** For framing boxes: the framing member id (same as `id`). */
  ruleRef?: string;
  /** Rendering hint: 'siding' | 'roofing' | 'concrete' | 'wood' | 'glass' | 'door' | 'trim'. */
  material: "siding" | "roofing" | "concrete" | "wood" | "ptWood" | "glass" | "door" | "trim";
}

export interface PolygonMember {
  id: string;
  kind: "gableEnd" | "roofCap";
  layer: Layer;
  entityId: string;
  material: BoxMember["material"];
  /** Planar polygon, vertices in world space, counter-clockwise as seen from outside. */
  vertices: Vec3[];
}

export interface Geometry {
  boxes: BoxMember[];
  polygons: PolygonMember[];
  /** Axis-aligned bounds in world space for camera framing. */
  bounds: { min: Vec3; max: Vec3 };
  ridgeHeightFt: number;
}
