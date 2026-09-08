/**
 * Post-frame framing generator (SPEC §20, NFBA terminology). Pure function of
 * the model. Every member carries actual lumber dimensions and a ruleRef.
 *
 * Conventions (ADR-0006): the plan wall line is the outside face of the
 * girts. Posts sit inside that line by one girt thickness; siding goes
 * outside it. Trusses bear on carriers along the two bearing walls.
 */
import type { BuildingModel, Wall } from "@/lib/model/schema";
import { wallLengthFt } from "@/lib/model/walls";
import { actualFt, stockLength, POST_STOCK_LENGTHS_FT, type LumberSize } from "@/rules/materials/lumber";
import { headroomFor } from "@/lib/model/openings";
import { eulerYX, planToWorld } from "@/lib/geometry/frame";
import type { Vec3 } from "@/lib/geometry/types";
import type { FramingMember, FramingSet, PostScheduleRow } from "./types";
import { freeSegments, openingSpans, wallFrame, wallLocalToWorld, wallRotation, type WallFrame } from "./wallFrame";
import { roofParams } from "./roofMath";

export const RULES = {
  postLayout: "framing.postFrame.postLayout",
  jambPosts: "framing.postFrame.jambPosts",
  embedment: "framing.postFrame.embedment",
  skirt: "framing.postFrame.skirtBoard",
  girts: "framing.postFrame.girtSpacing",
  carrier: "framing.postFrame.trussCarrier",
  header: "framing.postFrame.openingHeader",
  trussLayout: "framing.postFrame.trussLayout",
  purlins: "framing.postFrame.purlinSpacing",
  kneeBrace: "framing.postFrame.kneeBrace",
} as const;

/** Knee braces (RCO §328 prescriptive post-frame; docs/research/construction-details.md §4): 2×6 at 45°, legs 36" (48" for tall or wide barns). */
export function kneeBraceLegFt(model: BuildingModel): number {
  if (model.footprint.kind !== "rect") return 3;
  const span = model.roof.ridgeAxis === "ns" ? model.footprint.wFt : model.footprint.dFt;
  return model.eaveHeightFt >= 14 || span >= 40 ? 4 : 3;
}
export function needsKneeBraces(model: BuildingModel): boolean {
  if (model.footprint.kind !== "rect" || model.frame.system === "stickFrame") return false;
  const span = model.roof.ridgeAxis === "ns" ? model.footprint.wFt : model.footprint.dFt;
  return model.eaveHeightFt >= 10 || span >= 30;
}

/** Openings at or above this width get a post at each jamb (SPEC §20.1). */
export const JAMB_POST_MIN_WIDTH_FT = 8;
/** End-wall posts are never further apart than this (SPEC §20.1). */
export const ENDWALL_MAX_SPACING_FT = 8;
/** A remainder bay shorter than this is merged into the previous bay (Industry). */
export const MIN_REMAINDER_BAY_FT = 2;

export interface PostLine {
  /** Position along the wall from its start, feet (post centreline). */
  u: number;
  role: "corner" | "bay" | "jamb" | "endwall";
  openingId?: string;
}

/**
 * Post centrelines along a wall. Regular posts land on the bay module from
 * the wall start; a short remainder bay is left at the end. Any regular post
 * that falls inside an opening is dropped and jamb posts are added at both
 * sides of openings ≥ 8' (and of any opening that displaced a post).
 */
export function postLinesForWall(model: BuildingModel, wall: Wall): PostLine[] {
  const len = wallLengthFt(wall);
  const rp = roofParams(model);
  const isBearing = rp.bearingWalls.includes(wall.id);
  const spacing = isBearing ? model.frame.bayFt : Math.min(model.frame.bayFt, ENDWALL_MAX_SPACING_FT);
  const postT = actualFt(model.frame.post.size).t; // post width along the wall
  const girtT = actualFt(model.frame.girts.size).t;
  // Corner posts sit fully inside the corner: centre is inset from the wall start by post half-width + the adjacent wall's girt.
  const cornerInset = girtT + postT / 2;

  const lines: PostLine[] = [{ u: cornerInset, role: "corner" }];
  // Full bays from the wall start; the last bay is the remainder (≥ 2', else merged into the previous bay).
  for (let u = spacing; u <= len - MIN_REMAINDER_BAY_FT + 1e-6; u += spacing) {
    lines.push({ u, role: isBearing ? "bay" : "endwall" });
  }
  lines.push({ u: len - cornerInset, role: "corner" });

  const spans = openingSpans(model, wall.id);
  const kept = lines.filter((p) => !spans.some((s) => p.u > s.u0 - postT / 2 && p.u < s.u1 + postT / 2 && p.role !== "corner"));
  const displaced = spans.filter((s) => lines.some((p) => p.role !== "corner" && p.u > s.u0 - postT / 2 && p.u < s.u1 + postT / 2));
  for (const s of spans) {
    const needsJambs = s.u1 - s.u0 >= JAMB_POST_MIN_WIDTH_FT - 1e-9 || displaced.includes(s);
    if (!needsJambs) continue;
    const left = s.u0 - postT / 2;
    const right = s.u1 + postT / 2;
    if (left > cornerInset + postT) kept.push({ u: left, role: "jamb", openingId: s.openingId });
    if (right < len - cornerInset - postT) kept.push({ u: right, role: "jamb", openingId: s.openingId });
  }
  return kept.sort((a, b) => a.u - b.u).filter((p, i, arr) => i === 0 || p.u - arr[i - 1].u > postT * 0.9);
}

function member(partial: Omit<FramingMember, "treatment"> & { treatment?: FramingMember["treatment"] }): FramingMember {
  return { treatment: "none", ...partial };
}

/** Box aligned with a wall: local x along the wall (u), y up (h), z outward (n). */
function wallBox(
  f: WallFrame,
  id: string,
  kind: FramingMember["kind"],
  layer: FramingMember["layer"],
  nominal: LumberSize,
  u0: number,
  u1: number,
  h0: number,
  h1: number,
  n0: number,
  n1: number,
  ruleRef: string,
  extra: Partial<FramingMember> = {},
): FramingMember {
  return member({
    id,
    kind,
    layer,
    nominal,
    lengthFt: kind === "post" || kind === "jamb" || kind === "stud" ? h1 - h0 : u1 - u0,
    entityId: f.wall.id,
    ruleRef,
    center: wallLocalToWorld(f, (u0 + u1) / 2, (h0 + h1) / 2, (n0 + n1) / 2),
    size: [u1 - u0, h1 - h0, n1 - n0],
    rotation: wallRotation(f),
    ...extra,
  });
}

export function generatePostFrame(model: BuildingModel): FramingSet {
  if (model.footprint.kind !== "rect") return { members: [], posts: [], trussSpec: null };
  const members: FramingMember[] = [];
  const posts: PostScheduleRow[] = [];
  const fr = model.frame;
  const rp = roofParams(model);
  const post = actualFt(fr.post.size);
  const girt = actualFt(fr.girts.size);
  const skirt = actualFt(fr.skirt.size);
  const carrier = actualFt(fr.carrier.size);
  const embedFt = fr.post.foundation === "embedded" ? fr.post.embedIn / 12 : 0;
  const padDiaFt = fr.post.padDiaIn / 12;
  const braces = needsKneeBraces(model);

  for (const wall of model.walls) {
    if (wall.role !== "exterior") continue;
    const f = wallFrame(wall);
    const len = f.lengthFt;
    const H = wall.heightFt;
    const isBearing = rp.bearingWalls.includes(wall.id);
    // Girts sit on the outside face of the posts: girt occupies n ∈ [-girt.t, 0]; posts n ∈ [-girt.t - post.d, -girt.t].
    const girtN0 = -girt.t;
    const postN1 = girtN0;
    const postN0 = postN1 - post.d;

    // ---- Posts
    const lines = postLinesForWall(model, wall);
    const postTop = H; // all posts stop at the eave; the gable truss bears on the end-wall posts too
    for (const [i, p] of lines.entries()) {
      // Corner posts are generated by both walls; keep the one from the wall where the post is at u = cornerInset (start), skip at the end.
      if (p.role === "corner" && i === lines.length - 1) continue;
      const id = `post_${wall.id}_${i}`;
      const lengthFt = postTop + embedFt;
      const stock = stockLength(lengthFt, POST_STOCK_LENGTHS_FT);
      members.push(
        wallBox(f, id, "post", "framing", fr.post.size, p.u - post.t / 2, p.u + post.t / 2, -embedFt, postTop, postN0, postN1, p.role === "jamb" ? RULES.jambPosts : RULES.postLayout, {
          treatment: fr.post.foundation === "embedded" ? "UC4B" : "UC3B",
          note: `${p.role} post · ${lengthFt.toFixed(1)}' (stock ${stock.stockFt}')${isBearing ? ` · notch inside face 1½" × ${(carrier.d * 12).toFixed(2).replace(/\.?0+$/, "")}" for the carrier` : ""}`,
        }),
      );
      // Knee brace: 2×6 at 45° from the post to the truss beside it, on the inside, in the truss plane.
      if (isBearing && braces) {
        const a = kneeBraceLegFt(model);
        const brace = actualFt("2x6");
        const uB = p.u + post.t / 2 + brace.t / 2 + 0.02;
        const centre = wallLocalToWorld(f, uB, H - a / 2, postN0 - a / 2);
        const yaw = wallRotation(f)[1];
        members.push(
          member({
            id: `knee_${id}`,
            kind: "kneeBrace",
            layer: "framing",
            nominal: "2x6",
            lengthFt: a * Math.SQRT2 + 11 / 12,
            entityId: wall.id,
            ruleRef: RULES.kneeBrace,
            center: centre,
            size: [brace.t, brace.d, a * Math.SQRT2],
            rotation: eulerYX(yaw, Math.PI / 4),
            note: `knee brace · legs ${a * 12}" · 45° both ends · ½" × 8" bolt at the post, (4) 16d at the truss block`,
          }),
        );
      }
      if (fr.post.foundation === "embedded") {
        const padT = padDiaFt / 2;
        const [cx, , cz] = wallLocalToWorld(f, p.u, 0, (postN0 + postN1) / 2);
        members.push(
          member({
            id: `footing_${id}`,
            kind: "footing",
            layer: "foundation",
            nominal: "6x6",
            lengthFt: 0,
            entityId: wall.id,
            ruleRef: RULES.embedment,
            center: [cx, -embedFt - padT / 2, cz],
            size: [padDiaFt, padT, padDiaFt],
            rotation: [0, 0, 0],
            note: `footing pad ${fr.post.padDiaIn}" dia`,
          }),
        );
      }
      const holeDepthIn = fr.post.embedIn;
      const holeVol = Math.PI * (fr.post.holeDiaIn / 24) ** 2 * (holeDepthIn / 12);
      const postVol = post.t * post.d * embedFt;
      const [px, , pz] = wallLocalToWorld(f, p.u, 0, (postN0 + postN1) / 2);
      posts.push({
        id,
        wallId: wall.id,
        x: px,
        y: -pz,
        nominal: fr.post.size,
        lengthFt: stock.stockFt,
        holeDiaIn: fr.post.holeDiaIn,
        holeDepthIn,
        concreteCuFt: fr.post.foundation === "embedded" ? Math.max(0, holeVol - postVol) : 0,
        role: p.role,
      });
    }

    // ---- Skirt board(s): PT, on the outside face of the posts, bottom just below grade.
    const spans = openingSpans(model, wall.id);
    for (let r = 0; r < fr.skirt.rows; r++) {
      const h0 = -0.25 + r * skirt.d;
      const h1 = h0 + skirt.d;
      for (const [i, [u0, u1]] of freeSegments(len, spans, Math.max(h0, 0), h1).entries()) {
        members.push(
          wallBox(f, `skirt_${wall.id}_${r}_${i}`, "skirt", "framing", fr.skirt.size, u0, u1, h0, h1, girtN0, 0, RULES.skirt, { treatment: "UC4B", note: `skirt board row ${r + 1}` }),
        );
      }
    }

    // ---- Girts at ≤ 24" OC from the skirt top up to the eave, plus an eave girt with its top at the eave.
    const spacing = fr.girts.spacingIn / 12;
    const skirtTop = -0.25 + fr.skirt.rows * skirt.d;
    const rows: number[] = [];
    for (let h = skirtTop + spacing; h < H - girt.d - 1e-6; h += spacing) rows.push(h);
    rows.push(H - girt.d); // eave girt (top at H)
    for (const [r, h0] of rows.entries()) {
      const h1 = h0 + girt.d;
      for (const [i, [u0, u1]] of freeSegments(len, spans, h0, h1).entries()) {
        members.push(wallBox(f, `girt_${wall.id}_${r}_${i}`, "girt", "framing", fr.girts.size, u0, u1, h0, h1, girtN0, 0, RULES.girts, { note: `girt row ${r + 1} of ${rows.length}` }));
      }
    }

    // ---- Truss carrier on bearing walls: plies on the inside face of the posts, top at the eave.
    if (isBearing) {
      for (let ply = 0; ply < fr.carrier.plies; ply++) {
        const n1 = postN0 - ply * carrier.t;
        const n0 = n1 - carrier.t;
        members.push(
          wallBox(f, `carrier_${wall.id}_${ply}`, "carrier", "framing", fr.carrier.size, 0, len, H - carrier.d, H, n0, n1, RULES.carrier, { note: `truss carrier ply ${ply + 1} of ${fr.carrier.plies}` }),
        );
      }
    }

    // ---- Openings: header between jamb posts (2-ply, same size as girts or 2x8 for wide), jamb framing.
    for (const s of spans) {
      const o = model.openings.find((x) => x.id === s.openingId)!;
      const wide = s.u1 - s.u0 >= JAMB_POST_MIN_WIDTH_FT - 1e-9;
      const headerSize: LumberSize = wide ? (s.u1 - s.u0 > 12 ? "2x12" : "2x10") : "2x6";
      const hd = actualFt(headerSize);
      const headTop = Math.min(H, s.h1 + hd.d + headroomFor(o.type));
      const headBottom = headTop - hd.d;
      if (headBottom > s.h1 - 1e-6 || headroomFor(o.type) > 0) {
        members.push(
          wallBox(f, `header_${o.id}`, "header", "framing", headerSize, s.u0, s.u1, Math.max(s.h1, headBottom), Math.max(s.h1, headBottom) + hd.d, girtN0 - hd.t, girtN0, RULES.header, {
            note: `header over ${o.type}`,
          }),
        );
      }
      if (!wide) {
        // Light jambs (2x6 on edge) each side of small openings framed between girts.
        const j = actualFt("2x6");
        for (const [side, u] of [
          ["l", s.u0 - j.t],
          ["r", s.u1],
        ] as const) {
          members.push(wallBox(f, `jamb_${o.id}_${side}`, "jamb", "framing", "2x6", u, u + j.t, Math.max(0, s.h0 - 0.05), Math.min(H, s.h1 + 0.05), girtN0 - j.d, girtN0, RULES.header, { note: "opening jamb" }));
        }
      }
    }
  }

  // ---- Trusses on the bearing walls.
  const trussSpec = addTrusses(model, members);
  // ---- Purlins across the trusses.
  addPurlins(model, members);

  return { members, posts, trussSpec };
}

/** Along-ridge world position helper: `a` measured along the ridge from the building's south/west edge. */
function ridgeToWorld(rp: ReturnType<typeof roofParams>, model: BuildingModel, across: number, along: number, h: number): Vec3 {
  if (model.footprint.kind !== "rect") throw new Error("rect only");
  // across: distance from the west (ridgeNS) or south (ridgeEW) eave line; along: from south (ridgeNS) or west.
  return rp.ridgeNS ? planToWorld(across, along, h) : planToWorld(along, across, h);
}

function addTrusses(model: BuildingModel, members: FramingMember[]): FramingSet["trussSpec"] {
  if (model.footprint.kind !== "rect") return null;
  const rp = roofParams(model);
  const spacing = model.frame.trusses.spacingIn / 12;
  const positions: number[] = [];
  const chordT = actualFt(rp.topChordSize).t;
  for (let a = chordT / 2; a < rp.lengthFt - chordT; a += spacing) positions.push(a);
  positions.push(rp.lengthFt - chordT / 2); // gable truss at the far end
  const chord = actualFt(rp.topChordSize);
  const bc = actualFt(rp.spanFt > 24 ? "2x6" : "2x4");
  const isShed = model.roof.form === "shed";
  const halfSpan = rp.spanFt / 2;
  const rise = isShed ? rp.spanFt * (rp.pitch / 12) : gableRiseFt(rp);
  const alongAxisRotation = (angle: number): Vec3 => (rp.ridgeNS ? [0, 0, angle] : [-angle, 0, 0]);

  for (const [i, a_] of positions.entries()) {
    const a = a_;
    const id = `truss_${i}`;
    const isGable = i === 0 || i === positions.length - 1;
    // Bottom chord: bearing on the carriers, top at H + heel - chordVert? The bottom chord's top sits at the eave (H); the heel wedge is above it.
    members.push(
      member({
        id: `${id}_bc`,
        kind: "trussBottomChord",
        layer: "roofStructure",
        nominal: rp.spanFt > 24 ? "2x6" : "2x4",
        lengthFt: rp.spanFt,
        entityId: "roof",
        ruleRef: RULES.trussLayout,
        center: ridgeToWorld(rp, model, halfSpan, a, rp.H + bc.d / 2),
        size: rp.ridgeNS ? [rp.spanFt, bc.d, bc.t] : [bc.t, bc.d, rp.spanFt],
        rotation: [0, 0, 0],
        note: `${isGable ? "gable " : ""}truss ${i + 1} of ${positions.length} · bottom chord`,
      }),
    );
    // Top chords: top surface passes through (outside wall, H + heel) rising to the ridge; tails extend over the eave overhang.
    const runs: { from: number; to: number; sign: 1 | -1 }[] = isShed
      ? [{ from: -rp.ovE, to: rp.spanFt + rp.ovE, sign: rp.ridgeNS ? -1 : 1 }]
      : [
          { from: -rp.ovE, to: halfSpan, sign: 1 },
          { from: halfSpan, to: rp.spanFt + rp.ovE, sign: -1 },
        ];
    for (const [k, r] of runs.entries()) {
      const len = (r.to - r.from) / Math.cos(rp.theta);
      const mid = (r.from + r.to) / 2;
      // Height of the chord's top surface at `mid`, measured from the wall line on the rising side.
      const distFromLow = r.sign === 1 ? mid - 0 : rp.spanFt - mid;
      const topAtMid = rp.topChordAtWall + distFromLow * (rp.pitch / 12) - (isShed ? 0 : 0);
      const centerH = topAtMid - chord.d / 2 / Math.cos(rp.theta);
      members.push(
        member({
          id: `${id}_tc${k}`,
          kind: "trussTopChord",
          layer: "roofStructure",
          nominal: rp.topChordSize,
          lengthFt: len,
          entityId: "roof",
          ruleRef: RULES.trussLayout,
          center: ridgeToWorld(rp, model, mid, a, centerH),
          size: rp.ridgeNS ? [len, chord.d, chord.t] : [chord.t, chord.d, len],
          rotation: alongAxisRotation(r.sign * (rp.ridgeNS ? 1 : -1) * rp.theta * (rp.ridgeNS ? 1 : 1)),
          note: `truss ${i + 1} · top chord`,
        }),
      );
    }
    // Webs (visual + count): king post and two diagonals for a common gable truss.
    if (!isShed) {
      const webH = rp.topChordAtWall + rise - chord.d / Math.cos(rp.theta) - (rp.H + bc.d);
      if (webH > 0.5) {
        members.push(
          member({
            id: `${id}_king`,
            kind: "trussWeb",
            layer: "roofStructure",
            nominal: "2x4",
            lengthFt: webH,
            entityId: "roof",
            ruleRef: RULES.trussLayout,
            center: ridgeToWorld(rp, model, halfSpan, a, rp.H + bc.d + webH / 2),
            size: rp.ridgeNS ? [chord.t * 0.9, webH, chord.t] : [chord.t, webH, chord.t * 0.9],
            rotation: [0, 0, 0],
            note: `truss ${i + 1} · king post`,
          }),
        );
        for (const sign of [-1, 1] as const) {
          // Diagonal from the bottom-chord quarter point up to the ridge.
          const dx = halfSpan / 2;
          const dy = webH;
          const len = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx);
          members.push(
            member({
              id: `${id}_web${sign}`,
              kind: "trussWeb",
              layer: "roofStructure",
              nominal: "2x4",
              lengthFt: len,
              entityId: "roof",
              ruleRef: RULES.trussLayout,
              center: ridgeToWorld(rp, model, halfSpan + (sign * halfSpan) / 4, a_, rp.H + bc.d + webH / 2),
              size: rp.ridgeNS ? [len, chord.t * 0.9, chord.t] : [chord.t, chord.t * 0.9, len],
              rotation: rp.ridgeNS ? [0, 0, -sign * a] : [-sign * a, 0, 0],
              note: `truss ${i + 1} · web`,
            }),
          );
        }
      }
    }
  }
  return {
    count: positions.length,
    spanFt: rp.spanFt,
    pitch: rp.pitch,
    heelIn: model.frame.trusses.heelIn,
    overhangIn: model.roof.overhangEaveIn,
    spacingIn: model.frame.trusses.spacingIn,
    type: model.roof.form === "shed" ? "mono" : model.frame.trusses.type,
    bearingWalls: rp.bearingWalls,
  };
}

function gableRiseFt(rp: ReturnType<typeof roofParams>): number {
  return (rp.spanFt / 2) * (rp.pitch / 12);
}

function addPurlins(model: BuildingModel, members: FramingMember[]) {
  if (model.footprint.kind !== "rect") return;
  const rp = roofParams(model);
  const p = actualFt(model.frame.purlins.size);
  const flat = model.frame.purlins.orientation === "flat";
  const thick = flat ? p.d : p.t; // dimension along the slope
  const depth = rp.purlinDepth; // perpendicular to the roof
  const spacing = model.frame.purlins.spacingIn / 12;
  const along = rp.lengthFt + 2 * rp.ovG;
  const isShed = model.roof.form === "shed";
  const halfSpan = rp.spanFt / 2;
  const planes: { from: number; to: number; sign: 1 | -1 }[] = isShed
    ? [{ from: -rp.ovE, to: rp.spanFt + rp.ovE, sign: rp.ridgeNS ? -1 : 1 }]
    : [
        { from: -rp.ovE, to: halfSpan, sign: 1 },
        { from: halfSpan, to: rp.spanFt + rp.ovE, sign: -1 },
      ];
  for (const [k, pl] of planes.entries()) {
    const slopeLen = (pl.to - pl.from) / Math.cos(rp.theta);
    // Purlins measured along the slope from the eave: first at the eave edge, last at the ridge.
    const positions: number[] = [];
    for (let s = thick / 2; s < slopeLen - thick; s += spacing) positions.push(s);
    positions.push(slopeLen - thick / 2);
    for (const [i, s] of positions.entries()) {
      // Horizontal distance from the low edge of this plane.
      const horiz = s * Math.cos(rp.theta);
      const across = pl.sign === 1 ? pl.from + horiz : pl.to - horiz;
      const distFromWall = pl.sign === 1 ? across : rp.spanFt - across;
      const topAt = rp.datumAtWall + distFromWall * (rp.pitch / 12);
      const centerH = topAt - depth / 2 / Math.cos(rp.theta);
      const ang = pl.sign * rp.theta;
      members.push(
        member({
          id: `purlin_${k}_${i}`,
          kind: "purlin",
          layer: "roofStructure",
          nominal: model.frame.purlins.size,
          lengthFt: along,
          entityId: "roof",
          ruleRef: RULES.purlins,
          center: rp.ridgeNS ? planToWorld(across, rp.lengthFt / 2, centerH) : planToWorld(rp.lengthFt / 2, across, centerH),
          size: rp.ridgeNS ? [thick, depth, along] : [along, depth, thick],
          rotation: rp.ridgeNS ? [0, 0, ang] : [ang, 0, 0],
          note: `purlin ${i + 1} of ${positions.length}, plane ${k + 1}`,
        }),
      );
    }
  }
}
