import { describe, expect, it } from "vitest";
import { createDefaultModel, setFootprintRect } from "@/lib/model";
import { RULES, getRule, runRules } from "@/rules";

describe("rules runner", () => {
  it("every rule has an id, title, citation and rationale", () => {
    for (const r of RULES) {
      expect(r.id).toMatch(/^[a-z]+\.[a-zA-Z]+\.[a-zA-Z]+$/);
      expect(r.title.length).toBeGreaterThan(3);
      expect(r.source.length).toBeGreaterThan(0);
      expect(r.rationale.length).toBeGreaterThan(10);
    }
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it("default model: frost unverified warning only, construction-ready", () => {
    const report = runRules(createDefaultModel());
    expect(report.errors).toBe(0);
    expect(report.warnings).toBe(1);
    expect(report.findings[0].rule).toBe("structural.site.frostDepthVerified");
    expect(report.constructionReady).toBe(true);
  });

  it("missing frost depth is an error that blocks construction-ready", () => {
    const m = createDefaultModel();
    const report = runRules({ ...m, site: { ...m.site, frostDepthIn: undefined } });
    expect(report.errors).toBe(1);
    expect(report.constructionReady).toBe(false);
  });

  it("off-module footprint yields an info with a fix", () => {
    const report = runRules(setFootprintRect(createDefaultModel(), 23, 36));
    const f = report.findings.find((x) => x.rule === "design.footprint.module")!;
    expect(f.severity).toBe("info");
    expect(f.message).toContain("width 23'");
    expect(f.fix?.command).toBe("snapFootprintToModule");
  });

  it("spans over 60' warn for engineer stamp", () => {
    const report = runRules(setFootprintRect(createDefaultModel(), 64, 80));
    expect(report.findings.some((f) => f.rule === "structural.roof.clearSpanLimit")).toBe(true);
    expect(getRule("structural.roof.clearSpanLimit")?.source).toMatch(/^NFBA:/);
  });
});
