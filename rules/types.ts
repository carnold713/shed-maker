import type { BuildingModel } from "@/lib/model/schema";

/**
 * Rule citation conventions — SPEC Appendix A.
 * `source` must be one of the forms below so docs/RULES_INDEX.md can be generated.
 */
export type RuleSource =
  | `IRC:${string}`
  | `NDS${string}`
  | `APA:${string}`
  | `NFBA:${string}`
  | `ASCE7:${string}`
  | "Industry"
  | `Species:${string}`
  | `NEC:${string}`
  | `ASABE:${string}`
  | `MWPS:${string}`
  | "User";

export type Severity = "error" | "warn" | "info";

export interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  entityIds: string[];
  /** Optional one-click fix descriptor; the UI maps `command` to a store action. */
  fix?: { label: string; command: string; args?: Record<string, unknown> };
}

export interface Rule {
  id: string;
  title: string;
  source: RuleSource;
  /** Short human explanation shown on hover (provenance). */
  rationale: string;
  applies: (model: BuildingModel) => boolean;
  evaluate: (model: BuildingModel) => Finding[];
}

export interface ValidationReport {
  findings: Finding[];
  errors: number;
  warnings: number;
  infos: number;
  /** True when no `error` findings exist. Saving is never blocked; "construction-ready" is. */
  constructionReady: boolean;
}
