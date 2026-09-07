import type { BuildingModel } from "@/lib/model/schema";
import { actualFt } from "@/rules/materials/lumber";

/** Steel roof panel thickness including rib, feet (~¾"). */
export const ROOF_PANEL_THICK_FT = 0.75 / 12;

/**
 * Shared roof geometry parameters (SPEC §20.3). All heights are above finished
 * floor, feet. The roof "datum" is the top of the purlins at the outside wall
 * line; the roofing panel sits on it.
 */
export interface RoofParams {
  ridgeNS: boolean;
  /** Horizontal truss span (perpendicular to ridge), feet. */
  spanFt: number;
  /** Building length along the ridge, feet. */
  lengthFt: number;
  pitch: number;
  /** Slope angle, radians. */
  theta: number;
  /** Eave / wall height. */
  H: number;
  heelFt: number;
  ovE: number;
  ovG: number;
  topChordSize: "2x4" | "2x6";
  /** Vertical thickness of the top chord, feet (depth / cos θ). */
  topChordVert: number;
  /** Vertical thickness of a purlin as installed, feet. */
  purlinVert: number;
  /** Purlin depth perpendicular to the roof plane, feet. */
  purlinDepth: number;
  /** Top of top chord at the wall line. */
  topChordAtWall: number;
  /** Top of purlins at the wall line (= roofing underside). */
  datumAtWall: number;
  /** Top of the roofing at the ridge. */
  ridgeHeightFt: number;
  /** Bearing wall ids [first, second] in plan order. */
  bearingWalls: [string, string];
  /** Gable-end wall ids. */
  gableWalls: [string, string];
}

export function roofParams(model: BuildingModel): RoofParams {
  if (model.footprint.kind !== "rect") throw new Error("Polygon footprints are not supported yet (P1)");
  const { wFt: W, dFt: D } = model.footprint;
  const ridgeNS = model.roof.ridgeAxis === "ns";
  const spanFt = ridgeNS ? W : D;
  const lengthFt = ridgeNS ? D : W;
  const pitch = model.roof.pitch;
  const theta = Math.atan2(pitch, 12);
  const H = model.eaveHeightFt;
  const heelFt = model.frame.trusses.heelIn / 12;
  const topChordSize: "2x4" | "2x6" = spanFt > 24 ? "2x6" : "2x4";
  const topChordVert = actualFt(topChordSize).d / Math.cos(theta);
  const p = actualFt(model.frame.purlins.size);
  const purlinDepth = model.frame.purlins.orientation === "flat" ? p.t : p.d;
  const purlinVert = purlinDepth / Math.cos(theta);
  const topChordAtWall = H + heelFt;
  const datumAtWall = topChordAtWall + purlinVert;
  const rise = model.roof.form === "shed" ? spanFt * (pitch / 12) : (spanFt / 2) * (pitch / 12);
  const ridgeHeightFt = datumAtWall + rise + ROOF_PANEL_THICK_FT / Math.cos(theta);
  return {
    ridgeNS,
    spanFt,
    lengthFt,
    pitch,
    theta,
    H,
    heelFt,
    ovE: model.roof.overhangEaveIn / 12,
    ovG: model.roof.overhangGableIn / 12,
    topChordSize,
    topChordVert,
    purlinVert,
    purlinDepth,
    topChordAtWall,
    datumAtWall,
    ridgeHeightFt,
    bearingWalls: ridgeNS ? ["wall_ext_w", "wall_ext_e"] : ["wall_ext_s", "wall_ext_n"],
    gableWalls: ridgeNS ? ["wall_ext_s", "wall_ext_n"] : ["wall_ext_w", "wall_ext_e"],
  };
}

/** Gable rise over half the span, feet. */
export function gableRiseFt(spanFt: number, pitch: number): number {
  return (spanFt / 2) * (pitch / 12);
}
