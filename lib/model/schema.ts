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

export const SCHEMA_VERSION = 2;

export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

export const Pt = z.object({ x: z.number(), y: z.number() });
export type Pt = z.infer<typeof Pt>;

export const Units = z.enum(["imperial", "metric"]);
export type Units = z.infer<typeof Units>;

/** @deprecated v1 field; v2 uses `frame.system`. Kept for migration typing only. */
export const ConstructionMethod = z.enum(["postFrame", "stickFrame"]);
export type ConstructionMethod = z.infer<typeof ConstructionMethod>;

export const FrameSystem = z.enum(["postFrame", "stickFrame", "hybrid"]);
export type FrameSystem = z.infer<typeof FrameSystem>;

export const PostSize = z.enum(["4x6", "6x6", "6x8", "3ply2x6", "3ply2x8"]);
export const GirtSize = z.enum(["2x4", "2x6"]);
export const SkirtSize = z.enum(["2x6", "2x8"]);
export const CarrierSize = z.enum(["2x8", "2x10", "2x12"]);
export const PurlinSize = z.enum(["2x4", "2x6"]);
export const StudSize = z.enum(["2x4", "2x6"]);

/**
 * Framing system parameters (SPEC §31). Post-frame is the primary engine;
 * stick-frame is the secondary shell option and the interior partition system.
 */
export const Frame = z.object({
  system: FrameSystem.default("postFrame"),
  /** Post bay spacing along the truss-bearing (side) walls, feet. */
  bayFt: z.number().positive().default(8),
  post: z
    .object({
      size: PostSize.default("6x6"),
      foundation: z.enum(["embedded", "bracketPier", "permaColumn"]).default("embedded"),
      /** Embedment depth below grade, inches (embedded only). */
      embedIn: z.number().positive().default(48),
      holeDiaIn: z.number().positive().default(18),
      padDiaIn: z.number().positive().default(18),
    })
    .prefault({}),
  girts: z
    .object({
      size: GirtSize.default("2x6"),
      spacingIn: z.number().positive().max(24).default(24),
      mount: z.enum(["face", "bookshelf"]).default("face"),
    })
    .prefault({}),
  skirt: z.object({ size: SkirtSize.default("2x8"), rows: z.union([z.literal(1), z.literal(2)]).default(1) }).prefault({}),
  carrier: z.object({ plies: z.number().int().min(1).max(3).default(2), size: CarrierSize.default("2x12") }).prefault({}),
  trusses: z
    .object({
      spacingIn: z.number().positive().default(48),
      /** Heel height at the outside of bearing, inches. */
      heelIn: z.number().nonnegative().default(6),
      type: z.enum(["common", "scissor", "gambrel", "mono", "attic"]).default("common"),
    })
    .prefault({}),
  purlins: z
    .object({
      size: PurlinSize.default("2x4"),
      spacingIn: z.number().positive().default(24),
      orientation: z.enum(["edge", "flat", "inset"]).default("edge"),
    })
    .prefault({}),
  /** Stick-frame shell parameters (used when system is stickFrame). */
  studs: z.object({ size: StudSize.default("2x6"), spacingIn: z.union([z.literal(16), z.literal(24)]).default(16) }).prefault({}),
  species: z.enum(["SPF", "SYP", "DF"]).default("SPF"),
});
export type Frame = z.infer<typeof Frame>;

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
  "rollUpDoor",
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
  /** Display tag on plans (D1, W3). Assigned by the drawing layer if absent. */
  tag: z.string().optional(),
  /** Set when the opening belongs to a pen's outside access; it follows the pen (SPEC §18.2). */
  zoneId: Id.optional(),
  /** Style within the type: man door "solid"|"halfLight"; window "slider"|"singleHung"|"fixed"|"awning"|"hopper"|"transom". */
  variant: z.string().optional(),
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
  /** Projection from the wall, feet. */
  depthFt: z.number().positive(),
  pitch: z.number().min(0.5).max(12).default(3),
  enclosed: z.boolean().default(false),
  /** Start along the wall (from the wall's start corner) and run length; omitted = the full wall. */
  offsetFt: z.number().nonnegative().optional(),
  lengthFt: z.number().positive().optional(),
  /** Concrete pad under the lean-to. */
  slab: z.boolean().default(true),
  /** Drop of the lean-to roof attachment below the main eave, inches. */
  dropIn: z.number().nonnegative().default(6),
  postSize: z.enum(["4x4", "4x6", "6x6"]).default("6x6"),
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
      /** Concrete aprons outside overhead / roll-up / sliding doors (SPEC §4.8). */
      aprons: z.boolean().default(true),
      apronDepthFt: z.number().positive().default(8),
      /** Finished floor above grade, inches (SPEC §6.2: 4–6"). */
      aboveGradeIn: z.number().nonnegative().default(6),
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

/** Doors in interior partitions (stall fronts, room doors) — SPEC §24, ADR-0014. */
export const InteriorDoorType = z.enum(["stallSlide", "stallHinged", "dutch", "aisleSlide", "woodHinged", "manDoor", "cased"]);
export type InteriorDoorType = z.infer<typeof InteriorDoorType>;

export const InteriorDoor = z.object({
  id: Id,
  type: InteriorDoorType,
  /** Which edge of the zone the door sits in. */
  side: z.enum(["n", "s", "e", "w"]),
  /** From the edge's west (or south) end to the near jamb, feet. */
  offsetFt: z.number().nonnegative(),
  widthFt: z.number().positive(),
  heightFt: z.number().positive(),
  /** Hinged doors swing into ("in") or out of the zone; sliders slide left/right seen from the aisle. */
  swing: z.enum(["in", "out", "slideLeft", "slideRight"]).default("out"),
  /** Hinge jamb for hinged doors, seen from outside the zone. */
  hinge: z.enum(["left", "right"]).default("left"),
});
export type InteriorDoor = z.infer<typeof InteriorDoor>;

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
  /** Pen opens to the outside through a Dutch door on the exterior wall it touches (SPEC §18.2). */
  outsideAccess: z.boolean().default(false),
  /** Explicit doors in this zone's partitions. Empty + `autoDoor` = one default door facing the aisle. */
  doors: z.array(InteriorDoor).default([]),
  autoDoor: z.boolean().default(true),
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

// ---- Electrical (SPEC §27, ADR-0013): fixtures are placed; circuits, loads,
// wire sizes and routes are derived in lib/electrical.

export const FixtureKind = z.enum(["light", "floodlight", "outlet", "switch", "panel", "fan", "waterer", "heater"]);
export type FixtureKind = z.infer<typeof FixtureKind>;

export const ElectricalFixture = z.object({
  id: Id,
  kind: FixtureKind,
  /** Plan position of the device, feet (ADR-0005). Wall devices sit on the wall line. */
  x: z.number(),
  y: z.number(),
  /** Mounting height above finished floor, feet (centre of the device). */
  mountFt: z.number().nonnegative(),
  /** Nameplate load, watts. Switches and the panel carry none. */
  watts: z.number().nonnegative().default(0),
  volts: z.union([z.literal(120), z.literal(240)]).default(120),
  /** Wall the device mounts on, when wall-mounted (outlets, switches, panel, floodlights). */
  wallId: Id.optional(),
  label: z.string().optional(),
  /** Light fixtures: the switch that controls them. */
  switchId: Id.optional(),
  /** Light strips: 0 = runs east–west, 90 = north–south. */
  rotationDeg: z.number().default(0),
  /** Wall devices on an interior partition: the direction that wall runs (exterior walls use `wallId`). */
  facing: z.enum(["x", "y"]).optional(),
});
export type ElectricalFixture = z.infer<typeof ElectricalFixture>;

export const ElectricalService = z.object({
  /** Sub-panel rating fed from the house / meter, amps at 240 V single-phase. */
  amps: z.number().int().positive().default(100),
  /** One-way feeder length from the source to the barn panel, feet (voltage drop). */
  feederLengthFt: z.number().nonnegative().default(100),
  feedFrom: z.enum(["housePanel", "meter"]).default("housePanel"),
});

export const Electrical = z.object({
  service: ElectricalService.prefault({}),
  /** Wiring method inside the barn (NEC 547.5(A)). */
  wiring: z.enum(["pvcConduit", "ufCable", "mcCable"]).default("pvcConduit"),
  fixtures: z.array(ElectricalFixture).default([]),
});
export type Electrical = z.infer<typeof Electrical>;

// ---- Floor drainage (ADR-0016): drains and the outlet are placed; the
// under-slab pipe runs, slopes, inverts and cleanouts are derived in lib/plumbing.

export const DrainKind = z.enum(["floor", "trench"]);
export type DrainKind = z.infer<typeof DrainKind>;

export const Drain = z.object({
  id: Id,
  kind: DrainKind,
  /** Plan position of the drain (centre of a trench), feet. */
  x: z.number(),
  y: z.number(),
  /** Trench drains: channel length along `axis`, feet. */
  lengthFt: z.number().positive().default(4),
  axis: z.enum(["x", "y"]).default("x"),
  label: z.string().optional(),
});
export type Drain = z.infer<typeof Drain>;

export const DrainOutlet = z.object({
  kind: z.enum(["daylight", "dryWell", "septic", "storm"]).default("daylight"),
  /** Exterior wall the pipe leaves through, and where along it. */
  wallId: Id,
  offsetFt: z.number().nonnegative(),
});
export type DrainOutlet = z.infer<typeof DrainOutlet>;

export const Drainage = z.object({
  drains: z.array(Drain).default([]),
  outlet: DrainOutlet.optional(),
  pipeDiaIn: z.union([z.literal(3), z.literal(4), z.literal(6)]).default(4),
  /** Pipe fall, inches per foot (IPC 704.1: ⅛" min for 3"–6" pipe; ¼" preferred). */
  slopeInPerFt: z.number().positive().default(0.25),
  /** How much lower the ground is at the outlet point than at the building, inches (site fall). */
  siteFallIn: z.number().nonnegative().default(0),
});
export type Drainage = z.infer<typeof Drainage>;

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
  frame: Frame.prefault({}),
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
  electrical: Electrical.prefault({}),
  drainage: Drainage.prefault({}),
  materials: MaterialChoices.prefault({}),
  overrides: z.array(Override).default([]),
  /** Per-project unit-cost overrides keyed by price sku (SPEC §7.8). */
  priceOverrides: z.record(z.string(), z.number().nonnegative()).default({}),
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
