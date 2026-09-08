import { describe, expect, it } from "vitest";
import { createDefaultModel } from "@/lib/model";
import { applyLayout } from "@/lib/model/layouts";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";
import { estimateMaterials, formatUsd } from "@/lib/bom/estimate";
import { autoLightAll } from "@/lib/model/electrical";
import { PRICES, unitCost } from "@/rules/materials/prices";

const base = () => createDefaultModel({ now: new Date(0) });

describe("materials estimate", () => {
  it("prices every category with placeholder unit costs and a ±15% band", () => {
    const m = base();
    const est = estimateMaterials(m, deriveFraming(m), deriveGeometry(m));
    expect(est.total).toBeGreaterThan(5000);
    expect(est.total).toBeLessThan(60000);
    expect(est.low).toBeCloseTo(est.total * 0.85, 0);
    expect(est.high).toBeCloseTo(est.total * 1.15, 0);
    const cats = est.byCategory.map((c) => c.category);
    for (const c of ["lumber", "posts", "trusses", "roofSteel", "siding", "trim", "concrete", "hardware"]) expect(cats).toContain(c);
    expect(est.lines.every((l) => l.cost >= 0 && Number.isFinite(l.cost))).toBe(true);
    expect(PRICES.every((p) => p.source === "placeholder")).toBe(true);
    expect(formatUsd(1234.5)).toBe("$1,235");
  });

  it("interior and electrical add their own categories; price overrides change the total", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse" });
    m = autoLightAll(m);
    const est = estimateMaterials(m, deriveFraming(m), deriveGeometry(m));
    expect(est.byCategory.some((c) => c.category === "interior")).toBe(true);
    expect(est.byCategory.some((c) => c.category === "electrical")).toBe(true);
    expect(est.lines.find((l) => l.sku === "elec.panel")).toBeTruthy();
    expect(est.lines.find((l) => l.sku === "elec.lightStrip")?.quantity).toBe(m.electrical.fixtures.filter((f) => f.kind === "light").length);
    const doubled = { ...m, priceOverrides: { "lumber.spf": unitCost("lumber.spf") * 2 } };
    const est2 = estimateMaterials(doubled, deriveFraming(doubled), deriveGeometry(doubled));
    const lumber = est.lines.find((l) => l.sku === "lumber.spf")!;
    expect(est2.total - est.total).toBeCloseTo(lumber.cost, 0);
  });
});
