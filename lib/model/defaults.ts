import { SCHEMA_VERSION, type BuildingModel } from "./schema";
import { syncExteriorWalls } from "./walls";

/**
 * Defaults per SPEC Appendix B / §20: post-frame on 8' bays with 6×6 posts,
 * 24×36, eave 10', gable 4:12, 12" overhang, trusses 4' OC on 2-ply 2×12
 * carriers, 2×6 face girts at 24", 2×4 purlins on edge at 24", 4" slab on 4"
 * gravel, frost 36" (unverified).
 */
export function createDefaultModel(opts: { name?: string; wFt?: number; dFt?: number; now?: Date } = {}): BuildingModel {
  const now = (opts.now ?? new Date()).toISOString();
  const base: BuildingModel = {
    schemaVersion: SCHEMA_VERSION,
    units: "imperial",
    site: {
      orientationDeg: 0,
      frostDepthIn: 36,
      verified: { frost: false, snow: false, wind: false },
    },
    frame: {
      system: "postFrame",
      bayFt: 8,
      post: { size: "6x6", foundation: "embedded", embedIn: 48, holeDiaIn: 18, padDiaIn: 18 },
      girts: { size: "2x6", spacingIn: 24, mount: "face" },
      skirt: { size: "2x8", rows: 1 },
      carrier: { plies: 2, size: "2x12" },
      trusses: { spacingIn: 48, heelIn: 6, type: "common" },
      purlins: { size: "2x4", spacingIn: 24, orientation: "edge" },
      studs: { size: "2x6", spacingIn: 16 },
      species: "SPF",
    },
    footprint: { kind: "rect", wFt: opts.wFt ?? 24, dFt: opts.dFt ?? 36 },
    eaveHeightFt: 10,
    walls: [],
    openings: [],
    roof: {
      form: "gable",
      pitch: 4,
      ridgeAxis: "ns",
      overhangEaveIn: 12,
      overhangGableIn: 12,
      structure: "truss",
      covering: "steelPanel",
      vents: { ridge: true, gable: false, soffit: false, cupola: false },
    },
    leanTos: [],
    runs: [],
    fences: [],
    foundation: {
      kind: "embeddedPost",
      slab: { enabled: true, thicknessIn: 4, gravelBaseIn: 4, vaporBarrier: true, reinforcement: "mesh", zones: [], aprons: true, apronDepthFt: 8, aboveGradeIn: 6 },
      postBaySpacingFt: 8,
    },
    zones: [],
    fixtures: [],
    materials: {
      sidingColor: "#efece5",
      roofColor: "#cfc8bd",
      trimColor: "#ffffff",
      wainscot: { enabled: false, heightFt: 3, color: "#5b5f63" },
    },
    electrical: { service: { amps: 100, feederLengthFt: 100, feedFrom: "housePanel" }, wiring: "pvcConduit", fixtures: [] },
    drainage: { drains: [], pipeDiaIn: 4, slopeInPerFt: 0.25, siteFallIn: 0 },
    overrides: [],
    priceOverrides: {},
    meta: { name: opts.name ?? "Untitled barn", createdAt: now, updatedAt: now },
  };
  return syncExteriorWalls(base);
}
