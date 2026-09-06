import type { Rule } from "../types";

/** Clear-span truss widths beyond ~60' leave prescriptive territory for light-frame barns. */
export const clearSpanLimit: Rule = {
  id: "structural.roof.clearSpanLimit",
  title: "Truss clear span within common prescriptive range",
  source: "NFBA:Post-Frame Building Design Manual",
  rationale:
    "Wood trusses over 60' clear span are routinely built but require engineered design and manufacturer review; flag it early.",
  applies: (m) => m.footprint.kind === "rect",
  evaluate: (m) => {
    if (m.footprint.kind !== "rect") return [];
    const span = m.roof.ridgeAxis === "ns" ? m.footprint.wFt : m.footprint.dFt;
    if (span <= 60) return [];
    return [
      {
        severity: "warn",
        rule: "structural.roof.clearSpanLimit",
        message: `Truss span ${span}' exceeds 60' — engineer stamp required for the roof system.`,
        entityIds: ["roof"],
      },
    ];
  },
};
