/**
 * Stick-frame shell generator (SPEC §7.1, M1 subset): PT bottom plate, double
 * top plate, studs at 16"/24" OC laid out from the wall start, king + jack
 * studs and a header at each opening, rough sill under windows. Cripples,
 * blocking, corners and anchor bolts arrive in M2.
 */
import type { BuildingModel } from "@/lib/model/schema";
import { actualFt, type LumberSize } from "@/rules/materials/lumber";
import type { FramingMember, FramingSet } from "./types";
import { openingSpans, wallFrame, wallLocalToWorld, wallRotation, type WallFrame } from "./wallFrame";
import { generatePostFrame } from "./postFrame";

export const STICK_RULES = {
  plates: "framing.stick.plates",
  studLayout: "framing.stick.studLayout",
  openingFraming: "framing.stick.openingFraming",
  header: "framing.stick.headerSpan",
} as const;

/** Header size by rough-opening width for a bearing wall, SPF #2, single-storey roof only. Source: IRC:R602.7(1) (conservative rows). */
export function headerSizeFor(widthFt: number): LumberSize {
  if (widthFt <= 3) return "2x6";
  if (widthFt <= 5) return "2x8";
  if (widthFt <= 7) return "2x10";
  return "2x12";
}

function box(f: WallFrame, id: string, kind: FramingMember["kind"], nominal: LumberSize, u0: number, u1: number, h0: number, h1: number, n0: number, n1: number, ruleRef: string, note?: string): FramingMember {
  const vertical = kind === "stud" || kind === "jamb";
  return {
    id,
    kind,
    layer: "framing",
    nominal,
    lengthFt: vertical ? h1 - h0 : u1 - u0,
    treatment: kind === "plate" && h0 < 0.01 ? "UC3B" : "none",
    entityId: f.wall.id,
    ruleRef,
    center: wallLocalToWorld(f, (u0 + u1) / 2, (h0 + h1) / 2, (n0 + n1) / 2),
    size: [u1 - u0, h1 - h0, n1 - n0],
    rotation: wallRotation(f),
    note,
  };
}

export function generateStickFrame(model: BuildingModel): FramingSet {
  if (model.footprint.kind !== "rect") return { members: [], posts: [], trussSpec: null };
  const members: FramingMember[] = [];
  const stud = actualFt(model.frame.studs.size);
  const oc = model.frame.studs.spacingIn / 12;
  // Studs sit inside the sheathing plane: n ∈ [-stud.d, 0].
  const n0 = -stud.d;
  const n1 = 0;

  for (const wall of model.walls) {
    if (wall.role !== "exterior") continue;
    const f = wallFrame(wall);
    const len = f.lengthFt;
    const H = wall.heightFt;
    const plateT = stud.t;
    // Plates
    members.push(box(f, `plate_${wall.id}_bottom`, "plate", model.frame.studs.size, 0, len, 0, plateT, n0, n1, STICK_RULES.plates, "bottom plate (PT)"));
    members.push(box(f, `plate_${wall.id}_top1`, "plate", model.frame.studs.size, 0, len, H - 2 * plateT, H - plateT, n0, n1, STICK_RULES.plates, "top plate"));
    members.push(box(f, `plate_${wall.id}_top2`, "plate", model.frame.studs.size, 0, len, H - plateT, H, n0, n1, STICK_RULES.plates, "cap plate"));

    const spans = openingSpans(model, wall.id);
    const studH0 = plateT;
    const studH1 = H - 2 * plateT;
    const blocked = (u: number) => spans.find((s) => u + stud.t > s.u0 - stud.t - 1e-6 && u < s.u1 + stud.t + 1e-6);

    // Common studs on layout from the wall start, plus an end stud.
    const positions: number[] = [];
    for (let u = 0; u < len - stud.t; u += oc) positions.push(u);
    positions.push(len - stud.t);
    for (const [i, u] of positions.entries()) {
      if (blocked(u)) continue;
      members.push(box(f, `stud_${wall.id}_${i}`, "stud", model.frame.studs.size, u, u + stud.t, studH0, studH1, n0, n1, STICK_RULES.studLayout, `stud ${i + 1}`));
    }

    // Opening framing: king + jack each side, header, window sill.
    for (const s of spans) {
      const o = model.openings.find((x) => x.id === s.openingId)!;
      const headerSize = headerSizeFor(s.u1 - s.u0);
      const hd = actualFt(headerSize);
      const jacks = s.u1 - s.u0 > 6 ? 2 : 1;
      const headBottom = s.h1;
      const headTop = Math.min(studH1, headBottom + hd.d);
      for (const side of ["l", "r"] as const) {
        const sign = side === "l" ? -1 : 1;
        let u = side === "l" ? s.u0 - stud.t : s.u1;
        for (let j = 0; j < jacks; j++) {
          members.push(box(f, `jack_${o.id}_${side}${j}`, "stud", model.frame.studs.size, u, u + stud.t, studH0, headBottom, n0, n1, STICK_RULES.openingFraming, "jack stud"));
          u += sign * stud.t;
        }
        members.push(box(f, `king_${o.id}_${side}`, "stud", model.frame.studs.size, u, u + stud.t, studH0, studH1, n0, n1, STICK_RULES.openingFraming, "king stud"));
      }
      for (let ply = 0; ply < 2; ply++) {
        members.push(box(f, `header_${o.id}_${ply}`, "header", headerSize, s.u0 - stud.t * jacks, s.u1 + stud.t * jacks, headBottom, headTop, n0 + ply * hd.t, n0 + (ply + 1) * hd.t, STICK_RULES.header, `header ply ${ply + 1}`));
      }
      if (o.type === "window") {
        members.push(box(f, `sill_${o.id}`, "plate", model.frame.studs.size, s.u0, s.u1, s.h0 - stud.t, s.h0, n0, n1, STICK_RULES.openingFraming, "rough sill"));
      }
    }
  }

  // Roof structure is shared with post-frame (trusses at frame.trusses.spacingIn, purlins/sheathing).
  const roof = generatePostFrame({ ...model, openings: [], walls: model.walls.map((w) => ({ ...w })) });
  for (const m of roof.members) if (m.layer === "roofStructure") members.push(m);
  return { members, posts: [], trussSpec: roof.trussSpec };
}
