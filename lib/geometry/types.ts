/**
 * Geometry is a typed, renderer-agnostic description derived from the model.
 * The 3D scene, the 2D plan, and (later) drawings all consume this — nothing
 * is derived from another derived thing (SPEC §2.2).
 *
 * World space: x east, y up, z SOUTH (so plan +y == world -z). Feet.
 */
export type Vec3 = [number, number, number];

export interface BoxMember {
  id: string;
  kind: "slab" | "wallPanel" | "roofPlane" | "post" | "stud" | "girt" | "purlin" | "plate";
  /** Centre of the box in world space. */
  center: Vec3;
  /** Full extents (x, y, z) BEFORE rotation. */
  size: Vec3;
  /** Euler rotation in radians (x, y, z). */
  rotation: Vec3;
  /** Which model entity produced it, for picking/provenance. */
  entityId: string;
  /** Rule id that placed it (framing members only). */
  ruleRef?: string;
}

export interface PolygonMember {
  id: string;
  kind: "gableEnd" | "roofCap";
  entityId: string;
  /** Planar polygon, vertices in world space, counter-clockwise as seen from outside. */
  vertices: Vec3[];
}

export interface Geometry {
  boxes: BoxMember[];
  polygons: PolygonMember[];
  /** Axis-aligned bounds in world space for camera framing. */
  bounds: { min: Vec3; max: Vec3 };
  /** Handy scalars for labels. */
  ridgeHeightFt: number;
}
