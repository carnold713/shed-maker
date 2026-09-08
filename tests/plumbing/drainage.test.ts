import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel } from "@/lib/model";
import { addZone } from "@/lib/model/zones";
import { applyLayout } from "@/lib/model/layouts";
import { addDrain, autoDrainWashBays, autoOutlet, moveDrain, removeDrain, removeOutlet, setDrainageOptions, setOutlet, updateDrain } from "@/lib/model/drainage";
import { deriveDrainage } from "@/lib/plumbing/drainage";
import { drainageGeometry } from "@/lib/geometry/drainage";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";
import { estimateMaterials } from "@/lib/bom/estimate";
import { buildSequence } from "@/lib/bom/sequence";
import { runRules } from "@/rules";

const base = () => createDefaultModel({ now: new Date(0) }); // 24×36, slab 6" above grade

describe("drainage model", () => {
  it("adds a floor drain snapped to 6\", a trench that spans its wash bay, and an outlet on a wall", () => {
    let m = addZone(base(), { type: "wash", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "wash" });
    m = addDrain(m, { kind: "floor", x: 6.2, y: 18.3 });
    expect(m.drainage.drains[0]).toMatchObject({ kind: "floor", x: 6, y: 18.5 });
    m = addDrain(m, { kind: "trench", x: 6, y: 6 });
    expect(m.drainage.drains[1]).toMatchObject({ kind: "trench", lengthFt: 11, axis: "x", label: "Wash bay trench" });
    m = setOutlet(m, { x: 12, y: 0.4 });
    expect(m.drainage.outlet).toMatchObject({ kind: "daylight", wallId: "wall_ext_s", offsetFt: 12 });
    expect(() => parseBuildingModel(m)).not.toThrow();
    m = moveDrain(m, m.drainage.drains[0].id, 30, 40);
    expect(m.drainage.drains[0]).toMatchObject({ x: 23, y: 35 }); // clamped inside the walls
    m = updateDrain(m, m.drainage.drains[1].id, { lengthFt: 6, axis: "y" });
    expect(m.drainage.drains[1]).toMatchObject({ lengthFt: 6, axis: "y" });
    m = removeDrain(m, m.drainage.drains[0].id);
    expect(m.drainage.drains).toHaveLength(1);
    m = removeOutlet(m);
    expect(m.drainage.outlet).toBeUndefined();
  });

  it("autoDrainWashBays puts a trench in every wash bay and an outlet on the nearest wall", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse", supportBays: 1 });
    const tack = m.zones.find((z) => z.type === "tack")!;
    m = { ...m, zones: m.zones.map((z) => (z.id === tack.id ? { ...z, type: "wash" as const, name: "Wash bay" } : z)) };
    expect(runRules(m).findings.some((f) => f.rule === "mep.drainage.washBay" && f.fix?.command === "autoDrainWashBays")).toBe(true);
    m = autoDrainWashBays(m);
    expect(m.drainage.drains).toHaveLength(1);
    expect(m.drainage.drains[0].kind).toBe("trench");
    expect(["wall_ext_w", "wall_ext_s"]).toContain(m.drainage.outlet?.wallId);
    expect(autoDrainWashBays(m)).toBe(m);
    expect(runRules(m).findings.some((f) => f.rule === "mep.drainage.washBay")).toBe(false);
  });
});

describe("deriveDrainage", () => {
  it("routes a trunk and a lateral to the outlet, falls at the chosen slope, and places cleanouts", () => {
    let m = base();
    m = addDrain(m, { kind: "floor", x: 12, y: 30, id: "far" });
    m = addDrain(m, { kind: "floor", x: 6, y: 12, id: "near" });
    m = setOutlet(m, { wallId: "wall_ext_s", offsetFt: 12 });
    const d = deriveDrainage(m);
    const far = d.drains.find((x) => x.drain.id === "far")!;
    const near = d.drains.find((x) => x.drain.id === "near")!;
    expect(far.path).toEqual([{ x: 12, y: 30 }, { x: 12, y: 0 }]); // straight down to the south-wall outlet
    expect(far.runFt).toBe(30);
    expect(near.path[0]).toEqual({ x: 6, y: 12 });
    expect(near.path[1]).toEqual({ x: 12, y: 12 }); // lateral tees into the trunk
    expect(near.runFt).toBe(6 + 12);
    expect(d.pipe.totalFt).toBe(36);
    expect(d.outlet).toMatchObject({ x: 12, y: 0, invertIn: 10 + 30 * 0.25, groundIn: 6 });
    expect(d.outlet!.daylightOk).toBe(false);
    expect(d.outlet!.fallNeededIn).toBeCloseTo(17.5 + 4 + 2 - 6, 5);
    expect(d.cleanouts.map((c) => c.why)).toEqual(["head"]);
    // Enough site fall and it daylights.
    const sloped = setDrainageOptions(m, { siteFallIn: 24 });
    expect(deriveDrainage(sloped).outlet!.daylightOk).toBe(true);
    expect(runRules(m).findings.some((f) => f.rule === "mep.drainage.daylight" && f.fix?.command === "setOutletKind")).toBe(true);
    expect(runRules(sloped).findings.some((f) => f.rule === "mep.drainage.daylight")).toBe(false);
  });

  it("slab slope figures, stall warning, geometry, estimate and build step", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse" });
    const aisle = m.zones.find((z) => z.type === "aisle")!;
    const pen = m.zones.find((z) => z.type === "pen")!;
    m = addDrain(m, { kind: "floor", x: 19, y: 18, id: "a" });
    m = addDrain(m, { kind: "floor", x: 6, y: 6, id: "inStall" });
    m = autoOutlet(m);
    const d = deriveDrainage(m);
    const a = d.drains.find((x) => x.drain.id === "a")!;
    expect(a.zone?.id).toBe(aisle.id);
    expect(a.slabSlopeInPerFt).toBe(0.125);
    expect(a.farthestFt).toBeCloseTo(Math.hypot(7, 18), 1);
    expect(a.highPointIn).toBeCloseTo(Math.hypot(7, 18) * 0.125, 1);
    const r = runRules(m);
    expect(r.findings.some((f) => f.rule === "mep.drainage.inStall" && f.entityIds.includes("inStall"))).toBe(true);
    expect(r.findings.some((f) => f.rule === "mep.drainage.traps")).toBe(true);
    void pen;
    const g = drainageGeometry(m);
    expect(g.filter((b) => b.kind === "pipe").length).toBeGreaterThan(2);
    expect(g.every((b) => b.layer === "drainage")).toBe(true);
    const est = estimateMaterials(m, deriveFraming(m), deriveGeometry(m));
    expect(est.byCategory.some((c) => c.category === "plumbing")).toBe(true);
    expect(est.lines.find((l) => l.sku === "drain.floor4")?.quantity).toBe(2);
    expect(buildSequence(m, deriveFraming(m)).some((s) => s.title === "Under-slab drains")).toBe(true);
    expect(deriveDrainage(base()).drains).toHaveLength(0);
  });
});
