import type { LumberSize, Treatment } from "@/rules/materials/lumber";
import type { Vec3 } from "@/lib/geometry/types";

export type FramingKind =
  | "post"
  | "footing"
  | "skirt"
  | "girt"
  | "carrier"
  | "header"
  | "jamb"
  | "trussTopChord"
  | "trussBottomChord"
  | "trussWeb"
  | "purlin"
  | "plate"
  | "stud"
  | "kneeBrace";

export type Layer = "slab" | "foundation" | "framing" | "roofStructure" | "roofing" | "siding" | "openings" | "interior" | "electrical";

/**
 * A single framing member: a box in world space with its lumber identity.
 * Everything a framer, the BOM, and the drawings need lives here.
 */
export interface FramingMember {
  id: string;
  kind: FramingKind;
  layer: Layer;
  /** Nominal lumber size, e.g. "2x6". */
  nominal: LumberSize;
  /** Cut length, feet. */
  lengthFt: number;
  treatment: Treatment;
  /** Which wall / roof / opening produced it. */
  entityId: string;
  /** Rule that placed it (SPEC §1.4 provenance). */
  ruleRef: string;
  center: Vec3;
  /** Box extents before rotation: [along length, depth (vertical when unrotated), thickness]. */
  size: Vec3;
  rotation: Vec3;
  /** Free text shown in the inspector ("row 3 of 5", "jamb post, east side"). */
  note?: string;
}

export interface PostScheduleRow {
  id: string;
  wallId: string;
  /** Plan position, feet. */
  x: number;
  y: number;
  nominal: LumberSize;
  lengthFt: number;
  holeDiaIn: number;
  holeDepthIn: number;
  /** Concrete for collar + pad, cubic feet. */
  concreteCuFt: number;
  role: "corner" | "bay" | "jamb" | "endwall";
}

export interface FramingSet {
  members: FramingMember[];
  posts: PostScheduleRow[];
  /** Truss geometry summary for the truss supplier (SPEC §20.3). */
  trussSpec: {
    count: number;
    spanFt: number;
    pitch: number;
    heelIn: number;
    overhangIn: number;
    spacingIn: number;
    type: string;
    bearingWalls: [string, string];
  } | null;
}
