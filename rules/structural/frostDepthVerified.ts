import type { Rule } from "../types";

/**
 * Post embedment and footing depth key off frost depth (IRC R403.1.4.1).
 * The zip lookup is an estimate; the user must confirm with the building department.
 */
export const frostDepthVerified: Rule = {
  id: "structural.site.frostDepthVerified",
  title: "Frost depth set and verified",
  source: "IRC:R403.1.4.1",
  rationale:
    "Footings and embedded posts must extend below the frost line. Frost depth varies by jurisdiction; verify locally.",
  applies: () => true,
  evaluate: (m) => {
    if (m.site.frostDepthIn === undefined) {
      return [
        {
          severity: "error",
          rule: "structural.site.frostDepthVerified",
          message: "Frost depth is not set. Post embedment and footing depth cannot be sized.",
          entityIds: ["site"],
        },
      ];
    }
    if (!m.site.verified.frost) {
      return [
        {
          severity: "warn",
          rule: "structural.site.frostDepthVerified",
          message: `Frost depth ${m.site.frostDepthIn}" is an estimate — verify with your local building department.`,
          entityIds: ["site"],
        },
      ];
    }
    return [];
  },
};
