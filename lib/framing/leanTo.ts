/**
 * Lean-to framing (SPEC §7.2 "Lean-to: outer posts, ledger/header on main
 * posts, rafters or trusses at spacing"). Pure function of the model.
 */
import type { BuildingModel } from "@/lib/model/schema";
import { leanToHeights, leanToSpan } from "@/lib/model/leanTos";
import { actualFt, stockLength, POST_STOCK_LENGTHS_FT, type LumberSize } from "@/rules/materials/lumber";
import { wallFrame, wallLocalToWorld, wallRotation, type WallFrame } from "./wallFrame";
import type { FramingMember, PostScheduleRow } from "./types";
import type { Vec3 } from "@/lib/geometry/types";
import { eulerYX } from "@/lib/geometry/frame";

export const LEAN_TO_RULES = {
  posts: "framing.leanTo.postLayout",
  header: "framing.leanTo.header",
  ledger: "framing.leanTo.ledger",
  rafters: "framing.leanTo.rafterSpacing",
  purlins: "framing.leanTo.purlinSpacing",
} as const;

export const LEAN_TO_POST_MAX_SPACING_FT = 8;
export const LEAN_TO_RAFTER_SPACING_IN = 24;

function member(m: Omit<FramingMember, "treatment"> & { treatment?: FramingMember["treatment"] }): FramingMember {
  return { treatment: "none", ...m };
}

/** Box in the wall's local frame; local x along the wall, y up, z outward (n). */
function box(f: WallFrame, id: string, kind: FramingMember["kind"], nominal: LumberSize, u0: number, u1: number, h0: number, h1: number, n0: number, n1: number, ruleRef: string, entityId: string, note?: string, treatment: FramingMember["treatment"] = "none"): FramingMember {
  return member({
    id,
    kind,
    layer: "framing",
    nominal,
    lengthFt: kind === "post" ? h1 - h0 : Math.max(u1 - u0, n1 - n0),
    entityId,
    ruleRef,
    center: wallLocalToWorld(f, (u0 + u1) / 2, (h0 + h1) / 2, (n0 + n1) / 2),
    size: [u1 - u0, h1 - h0, n1 - n0],
    rotation: wallRotation(f),
    note,
    treatment,
  });
}

/** Sloped box along the outward normal: centre at (u, h, n), length along n rotated by -theta about the wall axis. */
function slopedBox(f: WallFrame, id: string, kind: FramingMember["kind"], nominal: LumberSize, u: number, thickU: number, hCenter: number, nCenter: number, lengthAlongSlope: number, depth: number, theta: number, ruleRef: string, entityId: string, note?: string): FramingMember {
  // Local: x along wall, y up, z outward. A rafter descends outward: rotate about local x by +theta (drops +z end).
  const rot = wallRotation(f);
  const size: Vec3 = [thickU, depth, lengthAlongSlope];
  return member({
    id,
    kind,
    layer: "roofStructure",
    nominal,
    lengthFt: lengthAlongSlope,
    entityId,
    ruleRef,
    center: wallLocalToWorld(f, u, hCenter, nCenter),
    size,
    rotation: eulerYX(rot[1], theta),
    note,
  });
}

export function generateLeanTos(model: BuildingModel): { members: FramingMember[]; posts: PostScheduleRow[] } {
  const members: FramingMember[] = [];
  const posts: PostScheduleRow[] = [];
  for (const lt of model.leanTos) {
    const span = leanToSpan(model, lt);
    const wall = model.walls.find((w) => w.id === span.wallId);
    if (!wall) continue;
    const f = wallFrame(wall);
    const { highFt, lowFt, theta } = leanToHeights(model, lt);
    const post = actualFt(lt.postSize);
    const header = actualFt("2x10");
    const rafter = actualFt("2x6");
    const purlin = actualFt("2x4");
    const embedFt = model.frame.post.foundation === "embedded" ? model.frame.post.embedIn / 12 : 0;
    const D = lt.depthFt;
    // Outer post line: centre at n = D - post.d/2 (post outside face on the lean-to edge).
    const nPost0 = D - post.d;
    const nPost1 = D;
    const postTop = lowFt - header.d; // header sits on the posts; rafters sit on the header
    // Posts at ≤ 8' from span start to end, corners included.
    const count = Math.max(2, Math.ceil(span.lengthFt / LEAN_TO_POST_MAX_SPACING_FT) + 1);
    const step = span.lengthFt / (count - 1);
    for (let i = 0; i < count; i++) {
      const u = span.u0 + i * step;
      const id = `ltpost_${lt.id}_${i}`;
      const u0 = Math.min(Math.max(u - post.t / 2, span.u0), span.u1 - post.t);
      members.push(box(f, id, "post", lt.postSize, u0, u0 + post.t, -embedFt, postTop, nPost0, nPost1, LEAN_TO_RULES.posts, lt.id, `lean-to post ${i + 1} of ${count}`, embedFt > 0 ? "UC4B" : "UC3B"));
      if (embedFt > 0) {
        const padDia = model.frame.post.padDiaIn / 12;
        const [cx, , cz] = wallLocalToWorld(f, u0 + post.t / 2, 0, (nPost0 + nPost1) / 2);
        members.push(member({ id: `ltfoot_${lt.id}_${i}`, kind: "footing", layer: "foundation", nominal: "6x6", lengthFt: 0, entityId: lt.id, ruleRef: "framing.postFrame.embedment", center: [cx, -embedFt - padDia / 4, cz], size: [padDia, padDia / 2, padDia], rotation: [0, 0, 0], note: "lean-to footing pad" }));
      }
      const [px, , pz] = wallLocalToWorld(f, u0 + post.t / 2, 0, (nPost0 + nPost1) / 2);
      const stock = stockLength(postTop + embedFt, POST_STOCK_LENGTHS_FT);
      posts.push({ id, wallId: span.wallId, x: px, y: -pz, nominal: lt.postSize, lengthFt: stock.stockFt, holeDiaIn: model.frame.post.holeDiaIn, holeDepthIn: model.frame.post.embedIn, concreteCuFt: embedFt > 0 ? Math.PI * (model.frame.post.holeDiaIn / 24) ** 2 * embedFt - post.t * post.d * embedFt : 0, role: i === 0 || i === count - 1 ? "corner" : "bay" });
    }
    // Header: 2-ply 2×10 on top of the outer posts.
    for (let ply = 0; ply < 2; ply++) {
      members.push(box(f, `lthdr_${lt.id}_${ply}`, "header", "2x10", span.u0, span.u1, postTop, postTop + header.d, nPost0 + ply * header.t, nPost0 + (ply + 1) * header.t, LEAN_TO_RULES.header, lt.id, `lean-to header ply ${ply + 1}`));
    }
    // Ledger: 2×10 on the main wall face (outside the girts), top at the attachment height.
    members.push(box(f, `ltledger_${lt.id}`, "carrier", "2x10", span.u0, span.u1, highFt - header.d, highFt, 0.75 / 12, 0.75 / 12 + header.t, LEAN_TO_RULES.ledger, lt.id, "lean-to ledger (lag to posts)", "UC3B"));
    // Rafters: 2×6 at 24" OC from the ledger to the header, top surface from highFt at the wall to lowFt at the outer edge.
    const run = D;
    const slopeLen = run / Math.cos(theta);
    const spacing = LEAN_TO_RAFTER_SPACING_IN / 12;
    const rafterUs: number[] = [];
    for (let u = span.u0 + rafter.t / 2; u < span.u1 - rafter.t; u += spacing) rafterUs.push(u);
    rafterUs.push(span.u1 - rafter.t / 2);
    for (const [i, u] of rafterUs.entries()) {
      const hMid = (highFt + lowFt) / 2 - rafter.d / 2 / Math.cos(theta);
      members.push(slopedBox(f, `ltrafter_${lt.id}_${i}`, "trussTopChord", "2x6", u, rafter.t, hMid, run / 2, slopeLen, rafter.d, theta, LEAN_TO_RULES.rafters, lt.id, `lean-to rafter ${i + 1} of ${rafterUs.length}`));
    }
    // Purlins across the rafters at 24" along the slope, on edge.
    const pCount = Math.max(2, Math.floor(slopeLen / 2) + 1);
    for (let i = 0; i < pCount; i++) {
      const s = Math.min(slopeLen - purlin.t / 2, purlin.t / 2 + (i * (slopeLen - purlin.t)) / (pCount - 1));
      const n = s * Math.cos(theta);
      const top = highFt + purlin.d / Math.cos(theta) - n * (lt.pitch / 12);
      const hCenter = top - purlin.d / 2 / Math.cos(theta);
      const rot = wallRotation(f);
      members.push(member({ id: `ltpurlin_${lt.id}_${i}`, kind: "purlin", layer: "roofStructure", nominal: "2x4", lengthFt: span.lengthFt, entityId: lt.id, ruleRef: LEAN_TO_RULES.purlins, center: wallLocalToWorld(f, (span.u0 + span.u1) / 2, hCenter, n), size: [span.lengthFt, purlin.d, purlin.t], rotation: eulerYX(rot[1], theta), note: `lean-to purlin ${i + 1} of ${pCount}` }));
    }
  }
  return { members, posts };
}
