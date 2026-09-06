import { SCHEMA_VERSION, type BuildingModel } from "./schema";
import { syncExteriorWalls } from "./walls";

/**
 * Defaults per SPEC Appendix B: post-frame, 24×36, eave 10', gable 4:12,
 * 12" overhang, trusses 4' OC, 4" slab on 4" gravel, frost 36" (unverified).
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
    method: "postFrame",
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
      trussSpacingIn: 48,
      covering: "steelPanel",
      vents: { ridge: true, gable: false, soffit: false, cupola: false },
    },
    leanTos: [],
    foundation: {
      kind: "embeddedPost",
      slab: { enabled: true, thicknessIn: 4, gravelBaseIn: 4, vaporBarrier: true, reinforcement: "mesh", zones: [] },
      postBaySpacingFt: 8,
    },
    zones: [],
    fixtures: [],
    materials: {
      sidingColor: "#8b8f94",
      roofColor: "#4a4f55",
      trimColor: "#f4f4f2",
      wainscot: { enabled: false, heightFt: 3, color: "#5b5f63" },
    },
    overrides: [],
    meta: { name: opts.name ?? "Untitled barn", createdAt: now, updatedAt: now },
  };
  return syncExteriorWalls(base);
}
