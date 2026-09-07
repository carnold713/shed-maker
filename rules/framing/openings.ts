import type { Rule, Finding } from "../types";
import { wallLengthFt } from "@/lib/model/walls";
import { OVERHEAD_DOOR_HEADROOM_FT } from "@/lib/model/openings";
import { postLinesForWall, JAMB_POST_MIN_WIDTH_FT } from "@/lib/framing/postFrame";
import { formatFtIn } from "@/lib/units";

const CORNER_CLEARANCE_FT = 1;

/** Openings need a full post/stud and trim at a corner (SPEC §7.7). */
export const openingCornerClearance: Rule = {
  id: "framing.openings.cornerClearance",
  title: "Opening clear of corners",
  source: "NFBA:Post-Frame Building Design Manual",
  rationale: "A corner post plus jamb framing and corner trim need about 12\" of wall; an opening tighter than that cannot be framed cleanly.",
  applies: (m) => m.openings.length > 0,
  evaluate: (m) => {
    const out: Finding[] = [];
    const severity = m.frame.system === "stickFrame" ? "warn" : "error";
    for (const o of m.openings) {
      const w = m.walls.find((x) => x.id === o.wallId);
      if (!w || w.role !== "exterior") continue;
      const len = wallLengthFt(w);
      const tooClose = o.offsetFt < CORNER_CLEARANCE_FT - 1e-9 || len - (o.offsetFt + o.widthFt) < CORNER_CLEARANCE_FT - 1e-9;
      if (tooClose) {
        out.push({
          severity,
          rule: "framing.openings.cornerClearance",
          message: `${label(o.type)} on the ${side(w.side)} wall is within 12" of a corner.`,
          entityIds: [o.id],
          fix: { label: "Nudge clear", command: "nudgeOpeningClear", args: { id: o.id, clearanceFt: CORNER_CLEARANCE_FT } },
        });
      }
    }
    return out;
  },
};

/** Two openings cannot share wall length. */
export const openingsOverlap: Rule = {
  id: "framing.openings.overlap",
  title: "Openings do not overlap",
  source: "Industry",
  rationale: "Overlapping rough openings cannot both be framed.",
  applies: (m) => m.openings.length > 1,
  evaluate: (m) => {
    const out: Finding[] = [];
    const byWall = new Map<string, typeof m.openings>();
    for (const o of m.openings) byWall.set(o.wallId, [...(byWall.get(o.wallId) ?? []), o]);
    for (const list of byWall.values()) {
      const sorted = [...list].sort((a, b) => a.offsetFt - b.offsetFt);
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        if (b.offsetFt < a.offsetFt + a.widthFt - 1e-9) {
          out.push({ severity: "error", rule: "framing.openings.overlap", message: `${label(a.type)} and ${label(b.type)} overlap.`, entityIds: [a.id, b.id] });
        }
      }
    }
    return out;
  },
};

/** A small opening that lands on a post line displaces that post — the builder would rather move the door. */
export const openingOnPostLine: Rule = {
  id: "framing.openings.postLine",
  title: "Small opening crosses a post line",
  source: "NFBA:Post-Frame Building Design Manual",
  rationale: "Post spacing is the structural module; a man door or window that lands on a post forces the post to move and a header to carry the girts. Centre it in a bay instead.",
  applies: (m) => m.frame.system !== "stickFrame" && m.openings.length > 0,
  evaluate: (m) => {
    const out: Finding[] = [];
    for (const o of m.openings) {
      if (o.widthFt >= JAMB_POST_MIN_WIDTH_FT - 1e-9) continue;
      const w = m.walls.find((x) => x.id === o.wallId);
      if (!w || w.role !== "exterior") continue;
      // Regular layout ignoring openings: does a bay/endwall post fall inside this opening?
      const regular = postLinesForWall({ ...m, openings: [] }, w).filter((p) => p.role !== "corner");
      const hit = regular.find((p) => p.u > o.offsetFt && p.u < o.offsetFt + o.widthFt);
      if (hit) {
        out.push({
          severity: "warn",
          rule: "framing.openings.postLine",
          message: `${label(o.type)} on the ${side(w.side)} wall crosses the post line at ${formatFtIn(hit.u)} — the post is omitted and jamb posts added. Centre it in a bay to avoid that.`,
          entityIds: [o.id],
          fix: { label: "Center in bay", command: "centerOpeningInBay", args: { id: o.id } },
        });
      }
    }
    return out;
  },
};

/** Overhead doors need track headroom below the truss bottom chord (SPEC §4.6, §7.7). */
export const overheadDoorHeadroom: Rule = {
  id: "structural.openings.overheadHeadroom",
  title: "Overhead door headroom",
  source: "Industry",
  rationale: "A sectional door needs roughly 12\" above the opening for the track and springs, and the trusses bear at the eave; the door head plus headroom must stay below the eave.",
  applies: (m) => m.openings.some((o) => o.type === "overheadDoor"),
  evaluate: (m) =>
    m.openings
      .filter((o) => o.type === "overheadDoor")
      .flatMap((o) => {
        const w = m.walls.find((x) => x.id === o.wallId);
        if (!w) return [];
        const need = o.sillFt + o.heightFt + OVERHEAD_DOOR_HEADROOM_FT;
        if (need <= w.heightFt + 1e-9) return [];
        return [
          {
            severity: "error" as const,
            rule: "structural.openings.overheadHeadroom",
            message: `Overhead door ${formatFtIn(o.widthFt)} × ${formatFtIn(o.heightFt)} needs ${formatFtIn(need)} of wall for track headroom; eave is ${formatFtIn(w.heightFt)}.`,
            entityIds: [o.id],
            fix: { label: `Raise eave to ${formatFtIn(Math.ceil(need))}`, command: "setEaveHeight", args: { ft: Math.ceil(need) } },
          },
        ];
      }),
};

/** Openings that no longer fit their wall (loaded documents, manual edits). */
export const openingFitsWall: Rule = {
  id: "design.openings.fitsWall",
  title: "Opening fits its wall",
  source: "Industry",
  rationale: "An opening past the end of a wall or above the eave cannot exist.",
  applies: (m) => m.openings.length > 0,
  evaluate: (m) =>
    m.openings.flatMap((o) => {
      const w = m.walls.find((x) => x.id === o.wallId);
      if (!w) return [{ severity: "error" as const, rule: "design.openings.fitsWall", message: `${label(o.type)} references a missing wall.`, entityIds: [o.id] }];
      const len = wallLengthFt(w);
      const bad = o.offsetFt < -1e-9 || o.offsetFt + o.widthFt > len + 1e-9 || o.sillFt + o.heightFt > w.heightFt + 1e-9;
      return bad ? [{ severity: "error" as const, rule: "design.openings.fitsWall", message: `${label(o.type)} does not fit the ${side(w.side)} wall.`, entityIds: [o.id] }] : [];
    }),
};

function label(type: string) {
  return { manDoor: "Man door", doubleDoor: "Double door", dutchDoor: "Dutch door", slidingDoor: "Sliding door", overheadDoor: "Overhead door", stallDoor: "Stall door", interiorDoor: "Interior door", window: "Window" }[type] ?? type;
}
function side(s?: string) {
  return { n: "north", s: "south", e: "east", w: "west" }[s ?? ""] ?? "";
}
