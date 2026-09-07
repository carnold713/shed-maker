import type { Rule } from "../types";
import { leanToHeights, LEAN_TO_MIN_CLEAR_FT } from "@/lib/model/leanTos";
import { formatFtIn } from "@/lib/units";

/** The low edge of a lean-to must clear a person (and a horse) — SPEC §4.5. */
export const leanToClearance: Rule = {
  id: "design.leanTo.clearance",
  title: "Lean-to low edge clears 7'",
  source: "Industry",
  rationale: "At 3:12 a 12' lean-to drops 3'; with a 6\" drop below a 10' eave the outer edge lands at 6'6\" — too low for a run-in. Raise the eave, flatten the pitch, or shorten the depth.",
  applies: (m) => m.leanTos.length > 0,
  evaluate: (m) =>
    m.leanTos.flatMap((lt) => {
      const { lowFt } = leanToHeights(m, lt);
      const side = { n: "north", s: "south", e: "east", w: "west" }[lt.side];
      if (lowFt >= LEAN_TO_MIN_CLEAR_FT - 1e-6) return [];
      const eaveNeeded = Math.ceil(m.eaveHeightFt + (LEAN_TO_MIN_CLEAR_FT - lowFt));
      return [
        {
          severity: "warn" as const,
          rule: "design.leanTo.clearance",
          message: `${side} lean-to outer edge is ${formatFtIn(lowFt)} high (${lt.depthFt}' at ${lt.pitch}:12) — below ${LEAN_TO_MIN_CLEAR_FT}'.`,
          entityIds: [lt.id],
          fix: { label: `Raise eave to ${eaveNeeded}'`, command: "setEaveHeight", args: { ft: eaveNeeded } },
        },
      ];
    }),
};

/** 2×6 rafters at 24" carry about 12' of lean-to under a light snow load. */
export const leanToRafterSpan: Rule = {
  id: "structural.leanTo.rafterSpan",
  title: "Lean-to rafter span",
  source: "IRC:R802.4 (2×6 SPF #2 rafters, 24\" OC)",
  rationale: "Beyond about 12' of projection 2×6 rafters at 24\" run out of table; use 2×8/2×10 rafters or trusses and have the truss supplier confirm.",
  applies: (m) => m.leanTos.some((lt) => lt.depthFt > 12),
  evaluate: (m) =>
    m.leanTos
      .filter((lt) => lt.depthFt > 12)
      .map((lt) => ({ severity: "info" as const, rule: "structural.leanTo.rafterSpan", message: `${lt.depthFt}' lean-to exceeds the 2×6 rafter table — plan on 2×8+ rafters or a truss and verify with the supplier.`, entityIds: [lt.id] })),
};
