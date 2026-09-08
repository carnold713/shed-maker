import { describe, expect, it } from "vitest";
import { createFromWizard, describeWizard, fitSize, WIZARD_DEFAULTS } from "@/lib/model/wizard";
import { parseBuildingModel } from "@/lib/model";
import { runRules } from "@/rules";

describe("new-barn wizard", () => {
  it("sizes a centre-aisle barn to the stall count", () => {
    expect(fitSize({ species: "horse", count: 4, layout: "centerAisle" })).toEqual({ wFt: 38, dFt: 24 });
    expect(fitSize({ species: "horse", count: 5, layout: "centerAisle" })).toEqual({ wFt: 38, dFt: 36 });
    expect(fitSize({ species: "goat", count: 6, layout: "shedRow" })).toEqual({ wFt: 12, dFt: 24 });
    expect(describeWizard(WIZARD_DEFAULTS)).toContain("4 horse stalls");
  });

  it("builds a complete barn: exactly N stalls, aisle-end doors, a window per stall, lights and a panel", () => {
    const m = createFromWizard({ ...WIZARD_DEFAULTS, count: 5 }, new Date(0));
    expect(() => parseBuildingModel(m)).not.toThrow();
    expect(m.zones.filter((z) => z.type === "pen")).toHaveLength(5);
    expect(m.zones.some((z) => z.type === "aisle")).toBe(true);
    expect(m.openings.filter((o) => o.type === "slidingDoor")).toHaveLength(2);
    expect(m.openings.filter((o) => o.type === "window")).toHaveLength(5);
    expect(m.electrical.fixtures.some((f) => f.kind === "panel")).toBe(true);
    expect(m.electrical.fixtures.filter((f) => f.kind === "light").length).toBeGreaterThanOrEqual(6);
    expect(m.electrical.fixtures.some((f) => f.kind === "switch")).toBe(true);
    expect(m.meta.name).toBe("Horse barn");
    const r = runRules(m);
    expect(r.errors).toBe(0);
  });

  it("shed row gets Dutch doors outside and a window beside each; empty layout is the default barn", () => {
    const m = createFromWizard({ ...WIZARD_DEFAULTS, layout: "shedRow", count: 3, species: "goat" }, new Date(0));
    expect(m.zones.filter((z) => z.type === "pen")).toHaveLength(3);
    expect(m.openings.filter((o) => o.type === "dutchDoor")).toHaveLength(3);
    expect(m.openings.filter((o) => o.type === "window")).toHaveLength(3);
    expect(m.openings.filter((o) => o.type === "manDoor")).toHaveLength(1);
    const e = createFromWizard({ ...WIZARD_DEFAULTS, layout: "empty" }, new Date(0));
    expect(e.zones).toHaveLength(0);
    expect(e.footprint).toEqual({ kind: "rect", wFt: 24, dFt: 36 });
  });

  it("custom size smaller than the stalls grows to fit", () => {
    const m = createFromWizard({ ...WIZARD_DEFAULTS, size: "custom", wFt: 24, dFt: 24 }, new Date(0));
    expect(m.footprint.kind === "rect" && m.footprint.wFt).toBe(38);
    expect(m.zones.filter((z) => z.type === "pen")).toHaveLength(4);
  });
});
