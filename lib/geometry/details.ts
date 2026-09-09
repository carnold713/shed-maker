/**
 * The barn's looks in 3D (ADR-0018): cupola and weathervane on the ridge,
 * bracketed awnings over doors, trim boards around openings, and the
 * wainscot band. All derived from the model; nothing here is stored.
 */
import type { BuildingModel, Opening } from "@/lib/model/schema";
import { roofParams } from "@/lib/framing/roofMath";
import { wallFrame, wallLocalToWorld, wallRotation, type WallFrame } from "@/lib/framing/wallFrame";
import { isDoor } from "@/lib/model/openings";
import { eulerYX, planToWorld } from "./frame";
import type { BoxMember, Vec3 } from "./types";

const SIDING_T = 0.75 / 12;

function box(id: string, kind: BoxMember["kind"], layer: BoxMember["layer"], material: BoxMember["material"], entityId: string, center: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]): BoxMember {
  return { id, kind, layer, entityId, material, center, size, rotation };
}

// ---------------------------------------------------------------------------
// Cupola
// ---------------------------------------------------------------------------

function cupolaGeometry(model: BuildingModel): BoxMember[] {
  const c = model.roof.cupola;
  if (!c.enabled || model.footprint.kind !== "rect") return [];
  const rp = roofParams(model);
  const s = c.sizeIn / 12;
  const out: BoxMember[] = [];
  const ridgeNS = rp.ridgeNS;
  const centreAcross = rp.spanFt / 2;
  const theta = rp.theta;
  for (let i = 0; i < c.count; i++) {
    const along = (rp.lengthFt * (i + 1)) / (c.count + 1);
    const px = ridgeNS ? centreAcross : along;
    const py = ridgeNS ? along : centreAcross;
    const id = `cupola_${i}`;
    // Saddle base sits astride the ridge; bottom of the base is below the ridge line by the half-width times the slope.
    const baseH = 0.35 + (s / 2) * Math.tan(theta);
    const z0 = rp.ridgeHeightFt - (s / 2) * Math.tan(theta);
    out.push(box(`${id}_base`, "cupola", "roofing", "trim", "roof", planToWorld(px, py, z0 + baseH / 2), [s + 0.25, baseH, s + 0.25]));
    // Louvered / windowed body.
    const bodyH = s * 0.95;
    const z1 = z0 + baseH;
    out.push(box(`${id}_body`, "cupola", "roofing", c.style === "windowed" ? "glass" : "trim", "roof", planToWorld(px, py, z1 + bodyH / 2), [s, bodyH, s]));
    // Corner posts of the body.
    const post = s * 0.09;
    for (const [ox, oy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      out.push(box(`${id}_post_${ox}_${oy}`, "cupola", "roofing", "trim", "roof", planToWorld(px + (ox * (s - post)) / 2, py + (oy * (s - post)) / 2, z1 + bodyH / 2), [post, bodyH, post]));
    }
    // A little gable cap in the roof colour, ridge parallel to the main ridge.
    const capPitch = Math.atan2(8, 12);
    const capW = s + 0.5;
    const capRun = capW / 2;
    const capSlope = capRun / Math.cos(capPitch);
    const z2 = z1 + bodyH;
    const capMid = z2 + (capRun * Math.tan(capPitch)) / 2;
    for (const sign of [-1, 1] as const) {
      const off = (sign * capRun) / 2;
      const centre = ridgeNS ? planToWorld(px + off, py, capMid) : planToWorld(px, py + off, capMid);
      const size: Vec3 = ridgeNS ? [capSlope, 0.08, capW] : [capW, 0.08, capSlope];
      const rot: Vec3 = ridgeNS ? [0, 0, -sign * capPitch] : [sign * capPitch, 0, 0];
      out.push(box(`${id}_cap_${sign}`, "cupola", "roofing", "roofing", "roof", centre, size, rot));
    }
    const top = z2 + capRun * Math.tan(capPitch);
    if (c.weathervane) {
      // Rod, directionals, and an arrow turned a little off the ridge so it reads from the side.
      out.push(box(`${id}_vane_rod`, "cupola", "roofing", "steel", "roof", planToWorld(px, py, top + 1.4), [0.06, 2.8, 0.06]));
      out.push(box(`${id}_vane_dirs`, "cupola", "roofing", "steel", "roof", planToWorld(px, py, top + 1.2), [1.3, 0.04, 0.04], [0, Math.PI / 4, 0]));
      out.push(box(`${id}_vane_dirs2`, "cupola", "roofing", "steel", "roof", planToWorld(px, py, top + 1.2), [1.3, 0.04, 0.04], [0, -Math.PI / 4, 0]));
      out.push(box(`${id}_vane_arrow`, "cupola", "roofing", "steel", "roof", planToWorld(px, py, top + 2.3), [1.6, 0.05, 0.18], [0, Math.PI / 6, 0]));
      out.push(box(`${id}_vane_fig`, "cupola", "roofing", "steel", "roof", planToWorld(px, py, top + 2.55), [0.5, 0.45, 0.06], [0, Math.PI / 6, 0]));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Awnings
// ---------------------------------------------------------------------------

function awningGeometry(f: WallFrame, o: Opening): BoxMember[] {
  const a = o.awning;
  if (!a) return [];
  const out: BoxMember[] = [];
  const yaw = wallRotation(f)[1];
  const u0 = o.offsetFt - 1;
  const u1 = o.offsetFt + o.widthFt + 1;
  const width = u1 - u0;
  const slides = o.type === "slidingDoor";
  const hAttach = o.sillFt + o.heightFt + (slides ? 1.2 : 0.6);
  const depth = a.depthFt;
  const pitch = Math.atan2(4, 12);
  const drop = depth * Math.tan(pitch);
  const slope = Math.hypot(depth, drop);
  const mk = (id: string, kind: BoxMember["kind"], material: BoxMember["material"], u: number, h: number, n: number, size: Vec3, rot: Vec3) => box(`${o.id}_awn_${id}`, kind, "siding", material, o.id, wallLocalToWorld(f, u, h, n), size, rot);
  const um = (u0 + u1) / 2;
  const nOut = SIDING_T;
  // The roof plane: sloping down away from the wall. A tilt about the wall's along axis; sign chosen so the outer edge is lower.
  out.push(mk("roof", "awning", "roofing", um, hAttach - drop / 2 + 0.28, nOut + depth / 2, [width, 0.08, slope], eulerYX(yaw, pitch)));
  // Rafters under it, every ~2', and the fascia at the outer edge.
  const nRafters = Math.max(2, Math.round(width / 2) + 1);
  for (let i = 0; i < nRafters; i++) {
    const u = u0 + (width * i) / (nRafters - 1);
    out.push(mk(`rafter${i}`, "awning", "ptWood", u, hAttach - drop / 2, nOut + depth / 2, [0.125, 0.46, slope], eulerYX(yaw, pitch)));
  }
  out.push(mk("fascia", "awning", "trim", um, hAttach - drop - 0.1, nOut + depth, [width, 0.5, 0.08], [0, yaw, 0]));
  out.push(mk("ledger", "awning", "trim", um, hAttach + 0.05, nOut + 0.06, [width, 0.46, 0.12], [0, yaw, 0]));
  // Brackets at each end: a leg down the wall and a diagonal strut out to the fascia.
  const legH = Math.min(depth * 1.1, hAttach - (o.sillFt + o.heightFt) + depth);
  const bT = a.brackets === "timber" ? 0.45 : 0.15;
  const mat: BoxMember["material"] = a.brackets === "timber" ? "ptWood" : "steel";
  for (const u of [u0 + bT, u1 - bT]) {
    out.push(mk(`leg_${u.toFixed(2)}`, "awning", mat, u, hAttach - legH / 2 - 0.1, nOut + bT / 2, [bT, legH, bT], [0, yaw, 0]));
    const strutLen = Math.hypot(depth - bT, legH - 0.2);
    const tilt = Math.atan2(legH - 0.2, depth - bT);
    out.push(mk(`strut_${u.toFixed(2)}`, "awning", mat, u, hAttach - 0.1 - (legH - 0.2) / 2, nOut + depth / 2, [bT * 0.8, bT * 0.8, strutLen], eulerYX(yaw, -tilt)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Trim boards
// ---------------------------------------------------------------------------

function trimGeometry(f: WallFrame, o: Opening, style: BuildingModel["materials"]["trimStyle"]): BoxMember[] {
  if (style === "none") return [];
  const out: BoxMember[] = [];
  const t = 0.75 / 12;
  const n0 = SIDING_T + 0.01;
  const leg = style === "flat" ? 3.5 / 12 : 5.5 / 12;
  const head = style === "craftsman" ? 5.5 / 12 : leg;
  const big = isDoor(o.type) && o.widthFt >= 6;
  const legW = big && style === "craftsman" ? 5.5 / 12 : style === "craftsman" ? 3.5 / 12 : leg;
  const u0 = o.offsetFt;
  const u1 = o.offsetFt + o.widthFt;
  const h0 = o.sillFt;
  const h1 = o.sillFt + o.heightFt;
  const slides = o.type === "slidingDoor";
  const mk = (id: string, a0: number, a1: number, b0: number, b1: number) => box(`${o.id}_trim_${id}`, "trimBoard", "siding", "trim", o.id, wallLocalToWorld(f, (a0 + a1) / 2, (b0 + b1) / 2, n0 + t / 2), [a1 - a0, b1 - b0, t], wallRotation(f));
  if (!slides) {
    out.push(mk("l", u0 - legW, u0, h0 - (o.type === "window" ? 0 : 0), h1 + head));
    out.push(mk("r", u1, u1 + legW, h0, h1 + head));
    out.push(mk("h", u0 - legW, u1 + legW, h1, h1 + head));
    if (style === "craftsman") out.push(box(`${o.id}_trim_cap`, "trimBoard", "siding", "trim", o.id, wallLocalToWorld(f, (u0 + u1) / 2, h1 + head + 0.06, n0 + 0.06), [u1 - u0 + 2 * legW + 0.2, 0.12, 0.12 + t], wallRotation(f)));
  } else {
    // Sliding doors: the leaf covers the jambs; trim the header line above the track only.
    out.push(mk("h", u0 - legW, u1 + legW, h1 + 1.45, h1 + 1.45 + head));
  }
  if (o.type === "window") {
    out.push(mk("sill", u0 - legW, u1 + legW, h0 - 0.12, h0));
    if (style === "craftsman") out.push(mk("apron", u0 - legW + 0.05, u1 + legW - 0.05, h0 - 0.12 - 3.5 / 12, h0 - 0.12));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wainscot band
// ---------------------------------------------------------------------------

function wainscotGeometry(model: BuildingModel, f: WallFrame, spans: { u0: number; u1: number }[]): BoxMember[] {
  const w = model.materials.wainscot;
  if (!w.enabled) return [];
  const H = w.heightFt;
  const T = w.kind === "stone" ? 0.25 : 0.06;
  const material: BoxMember["material"] = w.kind === "stone" ? "stone" : "wainscot";
  const out: BoxMember[] = [];
  // Pieces between the doors along this wall.
  const cuts = spans.slice().sort((a, b) => a.u0 - b.u0);
  let c = 0;
  const pieces: [number, number][] = [];
  for (const s of cuts) {
    if (s.u0 > c + 0.01) pieces.push([c, s.u0]);
    c = Math.max(c, s.u1);
  }
  if (f.lengthFt > c + 0.01) pieces.push([c, f.lengthFt]);
  pieces.forEach(([a0, a1], i) => {
    out.push(box(`wainscot_${f.wall.id}_${i}`, "wainscot", "siding", material, f.wall.id, wallLocalToWorld(f, (a0 + a1) / 2, H / 2, SIDING_T + T / 2), [a1 - a0, H, T], wallRotation(f)));
    // Cap / Z-trim on top.
    out.push(box(`wainscot_${f.wall.id}_${i}_cap`, "wainscot", "siding", "trim", f.wall.id, wallLocalToWorld(f, (a0 + a1) / 2, H + 0.04, SIDING_T + T / 2 + 0.02), [a1 - a0, 0.08, T + 0.1], wallRotation(f)));
  });
  return out;
}

/** Everything decorative: cupola, awnings, trim boards, wainscot. */
export function detailsGeometry(model: BuildingModel): BoxMember[] {
  if (model.footprint.kind !== "rect") return [];
  const out: BoxMember[] = [...cupolaGeometry(model)];
  for (const wall of model.walls) {
    if (wall.role !== "exterior") continue;
    const f = wallFrame(wall);
    const here = model.openings.filter((o) => o.wallId === wall.id);
    for (const o of here) {
      out.push(...awningGeometry(f, o));
      out.push(...trimGeometry(f, o, model.materials.trimStyle));
    }
    out.push(...wainscotGeometry(model, f, here.filter((o) => o.sillFt < model.materials.wainscot.heightFt).map((o) => ({ u0: o.offsetFt, u1: o.offsetFt + o.widthFt }))));
  }
  return out;
}
