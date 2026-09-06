/**
 * BuildingModel — the single source of truth for a project.
 *
 * Everything else (geometry, framing, BOM, drawings, validation) is DERIVED
 * from this document and never stored. See docs/SPEC.md §10 and ADR-0001.
 *
 * Units: the model always stores lengths in decimal FEET regardless of the
 * `units` display preference. Plan coordinates are (x east, y north) in feet
 * with the origin at the south-west corner of the footprint.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

export const Pt = z.object({ x: z.number(), y: z.number() });
export type Pt = z.infer<typeof Pt>;

export const Units = z.enum(["imperial", "metric"]);
export type Units = z.infer<typeof Units>;

export const ConstructionMethod = z.enum(["postFrame", "stickFrame"]);
export type ConstructionMethod = z.infer<typeof ConstructionMethod>;

export const Site = z.object({
  zip: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** Rotation of the building's plan +y axis from true north, degrees clockwise. */
  orientationDeg: z.number().default(0),
  frostDepthIn: z.number().positive().optional(),
  groundSnowPsf: z.number().nonnegative().optional(),
  windMph: z.number().nonnegative().optional(),
  verified: z
    .object({
      frost: z.boolean().default(false),
      snow: z.boolean().default(false),
      wind: z.boolean().default(false),
    })
    .default({ frost: false, snow: false, wind: false }),
  boundary: z.array(Pt).optional(),
  setbacksFt: z
    .object({ n: z.number(), s: z.number(), e: z.number(), w: z.number() })
    .optional(),
});
export type Site = z.infer<typeof Site>;

export const Footprint = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rect"),
    /** Width along plan x (east–west), feet. */
    wFt: z.number().positive(),
    /** Depth along plan y (north–south), feet. */
    dFt: z.number().positive(),
  }),
  z.object({ kind: z.literal("poly"), pts: z.array(Pt).min(3) }),
]);
export type Footprint = z.infer<typeof Footprint>;

export const WallAssembly = z.object({
  sheathing: z.enum(["none", "osb", "plywood"]).default("none"),
  siding: z
    .enum(["steelPanel", "boardAndBatten", "lap", "t111", "cedar", "none"])
    .default("steelPanel"),
  interiorFinish: z
    .enum(["none", "kickwall", "fullOsb", "drywall"])
    .default("none"),
  insulation: z.enum(["none", "batt", "sprayFoam", "board"]).default("none"),
});
export type WallAssembly = z.infer<typeof WallAssembly>;

export const Wall = z.object({
  id: Id,
  /** Exterior walls are derived from the footprint; interior walls are user-placed. */
  role: z.enum(["exterior", "interior"]),
  /** For rect footprints: which side this exterior wall is on. */
  side: z.enum(["n", "s", "e", "w"]).optional(),
  start: Pt,
  end: Pt,
  heightFt: z.number().positive(),
  /** Nominal framing thickness, inches (e.g. 5.5 for 2×6). */
  thicknessIn: z.number().positive().default(5.5),
  bearing: z.boolean().default(true),
  assembly: WallAssembly.prefault({}),
});
export type Wall = z.infer<typeof Wall>;

export const OpeningType = z.enum([
  "manDoor",
  "doubleDoor",
  "dutchDoor",
  "slidingDoor",
  "overheadDoor",
  "stallDoor",
  "interiorDoor",
  "window",
]);
export type OpeningType = z.infer<typeof OpeningType>;

export const Opening = z.object({
  id: Id,
  wallId: Id,
  type: OpeningType,
  /** Distance from the wall's `start` point to the opening's near jamb, feet. */
  offsetFt: z.number().nonnegative(),
  widthFt: z.number().positive(),
  heightFt: z.number().positive(),
  /** Sill height above finished floor, feet. 0 for doors. */
  sillFt: z.number().nonnegative().default(0),
  swing: z.enum(["in", "out", "slideLeft", "slideRight", "biParting", "none"]).default("none"),
  hardware: z.array(z.string()).default([]),
});
export type Opening = z.infer<typeof Opening>;

export const RoofForm = z.enum(["gable", "shed", "gambrel", "hip", "monitor"]);
export type RoofForm = z.infer<typeof RoofForm>;

export const Roof = z.object({
  form: RoofForm.default("gable"),
  /** Rise per 12" of run. 4 => 4:12. */
  pitch: z.number().min(0.5).max(12).default(4),
  /** Ridge runs along plan x ("ew") or plan y ("ns"). */
  ridgeAxis: z.enum(["ew", "ns"]).default("ew"),
  overhangEaveIn: z.number().min(0).max(36).default(12),
  overhangGableIn: z.number().min(0).max(36).default(12),
  structure: z.enum(["truss", "rafter"]).default("truss"),
  trussSpacingIn: z.number().positive().default(48),
  covering: z.enum(["steelPanel", "shingle", "standingSeam"]).default("steelPanel"),
  vents: z
    .object({
      ridge: z.boolean().default(true),
      gable: z.boolean().default(false),
      soffit: z.boolean().default(false),
      cupola: z.boolean().default(false),
    })
    .default({ ridge: true, gable: false, soffit: false, cupola: false }),
});
export type Roof = z.infer<typeof Roof>;

export const LeanTo = z.object({
  id: Id,
  side: z.enum(["n", "s", "e", "w"]),
  depthFt: z.number().positive(),
  pitch: z.number().min(0.5).max(12).default(3),
  enclosed: z.boolean().default(false),
});
export type LeanTo = z.infer<typeof LeanTo>;

export const SlabZone = z.object({
  id: Id,
  polygon: z.array(Pt).min(3),
  thicknessIn: z.number().positive().default(4),
  pitchInPerFt: z.number().nonnegative().default(0),
});

export const Foundation = z.object({
  kind: z
    .enum(["embeddedPost", "bracketOnPier", "monolithicSlab", "stemWall"])
    .default("embeddedPost"),
  slab: z
    .object({
      enabled: z.boolean().default(true),
      thicknessIn: z.number().positive().default(4),
      gravelBaseIn: z.number().nonnegative().default(4),
      vaporBarrier: z.boolean().default(true),
      reinforcement: z.enum(["none", "mesh", "rebar", "fiber"]).default("mesh"),
      zones: z.array(SlabZone).default([]),
    })
    .prefault({}),
  postBaySpacingFt: z.number().positive().default(8),
});
export type Foundation = z.infer<typeof Foundation>;

export const ZoneType = z.enum([
  "pen",
  "aisle",
  "tack",
  "feed",
  "hay",
  "wash",
  "equipment",
  "office",
  "kidding",
  "milking",
  "utility",
  "restroom",
  "open",
]);
export type ZoneType = z.infer<typeof ZoneType>;

export const Species = z.enum([
  "horse",
  "pony",
  "goat",
  "sheep",
  "cattle",
  "pig",
  "chicken",
  "alpaca",
  "rabbit",
  "dog",
  "generic",
]);
export type Species = z.infer<typeof Species>;

export const Zone = z.object({
  id: Id,
  name: z.string(),
  type: ZoneType,
  species: Species.optional(),
  headCount: z.number().int().nonnegative().optional(),
  polygon: z.array(Pt).min(3),
  flooring: z
    .enum(["concrete", "concreteMats", "gravel", "dirt", "wood"])
    .default("concrete"),
});
export type Zone = z.infer<typeof Zone>;

export const Fixture = z.object({
  id: Id,
  kind: z.string(),
  position: Pt,
  rotationDeg: z.number().default(0),
  zoneId: Id.optional(),
});
export type Fixture = z.infer<typeof Fixture>;

export const MaterialChoices = z.object({
  sidingColor: z.string().default("#8b8f94"),
  roofColor: z.string().default("#4a4f55"),
  trimColor: z.string().default("#f4f4f2"),
  wainscot: z
    .object({ enabled: z.boolean().default(false), heightFt: z.number().positive().default(3), color: z.string().default("#5b5f63") })
    .prefault({}),
});
export type MaterialChoices = z.infer<typeof MaterialChoices>;

export const Override = z.object({
  id: Id,
  /** The generated member / rule output being overridden. */
  targetId: Id,
  field: z.string(),
  value: z.unknown(),
  reason: z.string(),
});
export type Override = z.infer<typeof Override>;

export const Meta = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BuildingModel = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  units: Units.default("imperial"),
  site: Site.default({ orientationDeg: 0, verified: { frost: false, snow: false, wind: false } }),
  method: ConstructionMethod.default("postFrame"),
  footprint: Footprint,
  /** Eave (wall) height for exterior walls, feet. Per-wall override lives on Wall.heightFt. */
  eaveHeightFt: z.number().positive().default(10),
  walls: z.array(Wall).default([]),
  openings: z.array(Opening).default([]),
  roof: Roof.prefault({}),
  leanTos: z.array(LeanTo).default([]),
  foundation: Foundation.prefault({}),
  zones: z.array(Zone).default([]),
  fixtures: z.array(Fixture).default([]),
  materials: MaterialChoices.prefault({}),
  overrides: z.array(Override).default([]),
  meta: Meta,
});
export type BuildingModel = z.infer<typeof BuildingModel>;

/** Parse + validate an untrusted document (API boundary, DB row). Throws ZodError. */
export function parseBuildingModel(input: unknown): BuildingModel {
  return BuildingModel.parse(input);
}

export function safeParseBuildingModel(input: unknown) {
  return BuildingModel.safeParse(input);
}
