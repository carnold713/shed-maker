import type { Rule } from "../types";

const MODULE_FT = 2;

/**
 * Wall lengths off the 2' module waste sheet goods (4×8 sheathing, 36"-cover
 * steel panels, 2' OC truss/purlin layouts). Informational only.
 */
export const footprintModule: Rule = {
  id: "design.footprint.module",
  title: "Footprint on 2' module",
  source: "Industry",
  rationale:
    "Sheet goods are 4×8 and trusses/purlins lay out on 2' centers; dimensions off the 2' module add cut waste.",
  applies: (m) => m.footprint.kind === "rect",
  evaluate: (m) => {
    if (m.footprint.kind !== "rect") return [];
    const off: string[] = [];
    const isOff = (v: number) => Math.abs(v / MODULE_FT - Math.round(v / MODULE_FT)) > 1e-6;
    if (isOff(m.footprint.wFt)) off.push(`width ${m.footprint.wFt}'`);
    if (isOff(m.footprint.dFt)) off.push(`depth ${m.footprint.dFt}'`);
    if (off.length === 0) return [];
    return [
      {
        severity: "info",
        rule: "design.footprint.module",
        message: `Footprint ${off.join(" and ")} not on the 2' module — adds sheet-goods waste.`,
        entityIds: ["footprint"],
        fix: { label: "Snap to 2' module", command: "snapFootprintToModule", args: { moduleFt: 2 } },
      },
    ];
  },
};
