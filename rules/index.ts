import type { BuildingModel } from "@/lib/model/schema";
import type { Rule, ValidationReport } from "./types";
import { footprintModule } from "./design/footprintModule";
import { clearSpanLimit } from "./structural/clearSpanLimit";
import { frostDepthVerified } from "./structural/frostDepthVerified";
import { openingCornerClearance, openingFitsWall, openingOnPostLine, openingsOverlap, overheadDoorHeadroom } from "./framing/openings";
import { aisleMinWidth, partitionOnPostLine, penHasAccess, penMinimumSize, zonesInsideFootprint, zonesOverlap } from "./design/zones";

export * from "./types";

/** Registry. Order is the order findings are reported in. */
export const RULES: Rule[] = [
  frostDepthVerified,
  clearSpanLimit,
  openingFitsWall,
  openingsOverlap,
  overheadDoorHeadroom,
  openingCornerClearance,
  openingOnPostLine,
  zonesInsideFootprint,
  zonesOverlap,
  penMinimumSize,
  aisleMinWidth,
  penHasAccess,
  partitionOnPostLine,
  footprintModule,
];

export function runRules(model: BuildingModel, rules: Rule[] = RULES): ValidationReport {
  const findings = rules.flatMap((r) => (r.applies(model) ? r.evaluate(model) : []));
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warn").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  return { findings, errors, warnings, infos, constructionReady: errors === 0 };
}

export function getRule(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}
