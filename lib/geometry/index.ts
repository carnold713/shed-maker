import type { BuildingModel } from "@/lib/model/schema";
import { wallLengthFt } from "@/lib/model/walls";
import type { BoxMember, Geometry, PolygonMember, Vec3 } from "./types";

export * from "./types";

/** Plan (x east, y north) -> world (x east, y up, z south). */
export function planToWorld(x: number, y: number, h = 0): Vec3 {
  return [x, h, -y];
}

/** Ridge height above finished floor for a gable over `spanFt` at `pitch`:12. */
export function gableRiseFt(spanFt: number, pitch: number): number {
  return (spanFt / 2) * (pitch / 12);
}

/**
 * Derive renderable geometry for the building envelope. M0 scope: slab,
 * exterior wall panels, gable or shed roof planes and gable-end infill.
 * Framing members arrive with the framing generators in M2.
 */
export function deriveGeometry(model: BuildingModel): Geometry {
  if (model.footprint.kind !== "rect") {
    throw new Error("Polygon footprints are not supported yet (P1)");
  }
  const { wFt: W, dFt: D } = model.footprint;
  const H = model.eaveHeightFt;
  const boxes: BoxMember[] = [];
  const polygons: PolygonMember[] = [];

  // Slab: top at y=0, thickness below grade line for a visible edge.
  if (model.foundation.slab.enabled) {
    const t = model.foundation.slab.thicknessIn / 12;
    boxes.push({
      id: "slab",
      kind: "slab",
      entityId: "foundation",
      center: [W / 2, -t / 2, -D / 2],
      size: [W, t, D],
      rotation: [0, 0, 0],
    });
  }

  // Exterior walls as thin panels centred on the wall line.
  for (const w of model.walls) {
    if (w.role !== "exterior") continue;
    const len = wallLengthFt(w);
    const thick = w.thicknessIn / 12;
    const mx = (w.start.x + w.end.x) / 2;
    const my = (w.start.y + w.end.y) / 2;
    const angle = Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x);
    boxes.push({
      id: `panel_${w.id}`,
      kind: "wallPanel",
      entityId: w.id,
      center: planToWorld(mx, my, w.heightFt / 2),
      size: [len, w.heightFt, thick],
      // Plan angle is CCW about +y(north); world rotation about +Y is measured with z south, so negate.
      rotation: [0, angle, 0],
    });
  }

  // Roof.
  const ovE = model.roof.overhangEaveIn / 12;
  const ovG = model.roof.overhangGableIn / 12;
  const pitch = model.roof.pitch;
  const slopeAngle = Math.atan2(pitch, 12);
  const roofThick = 0.5;
  let ridgeHeightFt = H;

  const ridgeNS = model.roof.ridgeAxis === "ns"; // ridge runs along plan y; slopes face E/W
  const span = ridgeNS ? W : D; // horizontal distance across the roof
  const length = ridgeNS ? D : W; // along the ridge

  if (model.roof.form === "shed") {
    // Mono-slope: high side on the "start" (west or south), low side opposite. Eave height = low wall.
    const rise = span * (pitch / 12);
    ridgeHeightFt = H + rise;
    const run = span + 2 * ovE;
    const slopeLen = run / Math.cos(slopeAngle);
    const midH = H + rise / 2; // at plan centre
    // High side is the WEST wall (ridgeAxis "ns") or the NORTH wall (ridgeAxis "ew").
    // Rz(-θ) drops the local +x end (east); Rx(+φ) drops the local +z end (south).
    boxes.push({
      id: "roof_mono",
      kind: "roofPlane",
      entityId: "roof",
      center: planToWorld(W / 2, D / 2, midH),
      size: ridgeNS ? [slopeLen, roofThick, length + 2 * ovG] : [length + 2 * ovG, roofThick, slopeLen],
      rotation: ridgeNS ? [0, 0, -slopeAngle] : [slopeAngle, 0, 0],
    });
  } else {
    // Gable (gambrel/hip/monitor render as gable until P1/P2 geometry lands).
    const rise = gableRiseFt(span, pitch);
    ridgeHeightFt = H + rise;
    const halfRun = span / 2 + ovE;
    const slopeLen = halfRun / Math.cos(slopeAngle);
    // Each plane runs from the ridge (height H + rise) down to the eave overhang tip
    // (height H - ovE·pitch/12). Its centre sits halfway along that run.
    const midH = H + rise / 2 - (ovE * pitch) / 24;
    const centerOffset = halfRun / 2; // horizontal distance from ridge to plane centre
    const along = length + 2 * ovG;

    if (ridgeNS) {
      // Two planes east and west of x = W/2.
      boxes.push({
        id: "roof_w",
        kind: "roofPlane",
        entityId: "roof",
        center: planToWorld(W / 2 - centerOffset, D / 2, midH),
        size: [slopeLen, roofThick, along],
        rotation: [0, 0, slopeAngle], // +x end (ridge) up
      });
      boxes.push({
        id: "roof_e",
        kind: "roofPlane",
        entityId: "roof",
        center: planToWorld(W / 2 + centerOffset, D / 2, midH),
        size: [slopeLen, roofThick, along],
        rotation: [0, 0, -slopeAngle], // -x end (ridge) up
      });
      // Gable-end triangles at y=0 (south) and y=D (north).
      polygons.push(
        {
          id: "gable_s",
          kind: "gableEnd",
          entityId: "wall_ext_s",
          vertices: [planToWorld(0, 0, H), planToWorld(W, 0, H), planToWorld(W / 2, 0, ridgeHeightFt)],
        },
        {
          id: "gable_n",
          kind: "gableEnd",
          entityId: "wall_ext_n",
          vertices: [planToWorld(W, D, H), planToWorld(0, D, H), planToWorld(W / 2, D, ridgeHeightFt)],
        },
      );
    } else {
      // Ridge along x; planes north and south of y = D/2.
      boxes.push({
        id: "roof_s",
        kind: "roofPlane",
        entityId: "roof",
        center: planToWorld(W / 2, D / 2 - centerOffset, midH),
        size: [along, roofThick, slopeLen],
        rotation: [slopeAngle, 0, 0], // +z end (south eave) down
      });
      boxes.push({
        id: "roof_n",
        kind: "roofPlane",
        entityId: "roof",
        center: planToWorld(W / 2, D / 2 + centerOffset, midH),
        size: [along, roofThick, slopeLen],
        rotation: [-slopeAngle, 0, 0], // -z end (north eave) down
      });
      polygons.push(
        {
          id: "gable_w",
          kind: "gableEnd",
          entityId: "wall_ext_w",
          vertices: [planToWorld(0, D, H), planToWorld(0, 0, H), planToWorld(0, D / 2, ridgeHeightFt)],
        },
        {
          id: "gable_e",
          kind: "gableEnd",
          entityId: "wall_ext_e",
          vertices: [planToWorld(W, 0, H), planToWorld(W, D, H), planToWorld(W, D / 2, ridgeHeightFt)],
        },
      );
    }
  }

  const pad = Math.max(ovE, ovG) + 1;
  return {
    boxes,
    polygons,
    bounds: { min: [-pad, -1, -D - pad], max: [W + pad, ridgeHeightFt + 1, pad] },
    ridgeHeightFt,
  };
}
