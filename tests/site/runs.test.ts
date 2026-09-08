import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel } from "@/lib/model";
import { addZone, setOutsideAccess } from "@/lib/model/zones";
import { addRun, addRunGate, autoRuns, defaultRunDepth, fitRunToHead, moveRun, outerSide, penAtWall, removeRun, resizeRun, runEdges, runRectOnWall, siteExtent, updateRun } from "@/lib/model/runs";
import { deriveFencing } from "@/lib/site/fencing";
import { siteGeometry } from "@/lib/geometry/site";
import { latLngToPlan, parseLatLng, planBearingDeg, planToLatLng, siteFrame } from "@/lib/site/geo";
import { runRules } from "@/rules";
import { estimateMaterials } from "@/lib/bom/estimate";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";

// 24' × 36' default barn: south wall y = 0, west wall x = 0.
const base = () => createDefaultModel({ now: new Date(0) });

describe("outdoor runs", () => {
  it("hangs a run on the pen's outside wall, sized for its animals, with a walk gate on the far side", () => {
    let m = addZone(base(), { type: "pen", species: "alpaca", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "p1", name: "Alpaca 1" });
    m = { ...m, zones: m.zones.map((z) => (z.id === "p1" ? { ...z, headCount: 3 } : z)) };
    m = setOutsideAccess(m, "p1", true); // Dutch door lands on the first exterior edge (south)
    m = addRun(m, { zoneId: "p1", id: "r1" });
    const r = m.runs.find((x) => x.id === "r1")!;
    expect(r.name).toBe("Alpaca 1 run");
    expect(r.species).toBe("alpaca");
    expect(r.headCount).toBe(3);
    // Off the south wall: same 12' frontage, deep enough for 3 × 200 sq ft (50' → 50).
    expect(r.rect).toEqual({ x: 0, y: -50, w: 12, d: 50 });
    expect(defaultRunDepth("alpaca", 3, 12)).toBe(50);
    expect(r.fence).toEqual({ kind: "noClimb", heightFt: 5, topRail: false });
    expect(r.gates).toHaveLength(1);
    expect(r.gates[0]).toMatchObject({ side: "s", widthFt: 4 });
    expect(outerSide(m, r)).toBe("s");
    const edges = runEdges(m, r);
    expect(edges.find((e) => e.side === "n")?.onBuilding).toBe(true);
    expect(edges.filter((e) => e.onBuilding)).toHaveLength(1);
    expect(() => parseBuildingModel(m)).not.toThrow();
    expect(siteExtent(m)).toEqual({ x: 0, y: -50, w: 24, d: 86 });
  });

  it("a pen on two outside walls gets its run on the wall with its door", () => {
    // 12' × 12' pen in the south-west corner: south and west walls are both outside walls; the door is on the west.
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "c" });
    m = { ...m, openings: [...m.openings, { id: "dd", wallId: "wall_ext_w", type: "dutchDoor", offsetFt: 36 - 8, widthFt: 4, heightFt: 7, sillFt: 0, swing: "out", hardware: [] }] };
    m = addRun(m, { zoneId: "c", id: "r" });
    expect(m.runs[0].rect).toMatchObject({ x: -50, y: 0, w: 50, d: 12 });
    expect(m.runs[0].gates[0].side).toBe("w");
  });

  it("wall-click runs, pens found along a wall, and staying outside the walls", () => {
    let m = addZone(base(), { type: "pen", species: "goat", rect: { x: 12, y: 24, w: 12, d: 12 }, id: "g" });
    expect(penAtWall(m, "e", 30)?.id).toBe("g"); // east wall runs south→north; the pen spans y 24–36
    expect(penAtWall(m, "e", 10)).toBeNull();
    expect(runRectOnWall(m, "s", 12, 24, 20)).toEqual({ x: 0, y: -20, w: 24, d: 20 });
    expect(runRectOnWall(m, "n", 6, 8, 10)).toEqual({ x: 14, y: 36, w: 8, d: 10 }); // north wall runs east→west
    m = addRun(m, { side: "w", offsetFt: 18, widthFt: 20, depthFt: 30, species: "horse", id: "w1" });
    expect(m.runs[0].rect).toEqual({ x: -30, y: 8, w: 30, d: 20 });
    // Moving it into the building pushes it back out; resizing keeps a 4' minimum.
    m = moveRun(m, "w1", -10, 8);
    expect(m.runs[0].rect.x).toBe(-30);
    m = resizeRun(m, "w1", { x: -30, y: 8, w: 2, d: 2 });
    expect(m.runs[0].rect).toMatchObject({ w: 4, d: 4 });
    m = removeRun(m, "w1");
    expect(m.runs).toHaveLength(0);
  });

  it("auto runs, growing to the recommended area, gates that don't stack", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "h1" });
    m = addZone(m, { type: "pen", species: "horse", rect: { x: 12, y: 0, w: 12, d: 12 }, id: "h2" });
    m = addZone(m, { type: "tack", rect: { x: 0, y: 24, w: 12, d: 12 }, id: "t" });
    m = autoRuns(m, ["a", "b"]);
    expect(m.runs.map((r) => r.id)).toEqual(["a", "b"]);
    expect(m.runs[0].rect).toEqual({ x: 0, y: -50, w: 12, d: 50 }); // 600 sq ft recommended → 50' deep
    expect(autoRuns(m).runs).toHaveLength(2); // idempotent
    m = updateRun(m, "a", { rect: { x: 0, y: -12, w: 12, d: 12 }, headCount: 2 });
    m = fitRunToHead(m, "a");
    expect(m.runs[0].rect).toEqual({ x: 0, y: -100, w: 12, d: 100 }); // 2 × 600 / 12
    m = addRunGate(m, "a", { side: "w", widthFt: 12, offsetFt: 10, id: "g2" });
    expect(m.runs[0].gates).toHaveLength(2);
    expect(addRunGate(m, "a", { side: "w", widthFt: 4, offsetFt: 12 })).toBe(m); // overlaps g2
  });

  it("fencing takeoff shares the line between neighbouring runs and counts posts, rolls and gates", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "h1" });
    m = addZone(m, { type: "pen", species: "horse", rect: { x: 12, y: 0, w: 12, d: 12 }, id: "h2" });
    m = autoRuns(m, ["a", "b"]);
    const f = deriveFencing(m);
    // Each run 12 × 50 off the south wall: fence = 50 + 12 + 50 = 112'; the shared 50' line counts once.
    expect(f.runs[0].fenceFt).toBe(112);
    expect(f.runs[1].fenceFt).toBe(62);
    expect(f.runs[1].sharedFt).toBe(50);
    expect(f.totalFenceFt).toBe(174);
    const k = f.byKind[0];
    expect(k.kind).toBe("noClimb");
    expect(k.rolls).toBe(Math.ceil((174 - 8) / 100)); // two 4' gates come out of the wire
    expect(k.gatePosts).toBe(4);
    expect(k.braces).toBeGreaterThan(0);
    expect(f.gates).toEqual([{ widthFt: 4, count: 2 }]);
    // Estimate carries a fencing category.
    const est = estimateMaterials(m, deriveFraming(m), deriveGeometry(m));
    expect(est.byCategory.some((c) => c.category === "fencing" && c.cost > 0)).toBe(true);
    // 3D: grass, posts, mesh panels and a gate per run.
    const g = siteGeometry(m);
    expect(g.filter((b) => b.kind === "ground")).toHaveLength(2);
    expect(g.some((b) => b.kind === "fencePost")).toBe(true);
    expect(g.some((b) => b.kind === "fencePanel")).toBe(true);
    expect(g.filter((b) => b.kind === "gate")).toHaveLength(2);
    expect(g.every((b) => b.layer === "site")).toBe(true);
  });

  it("rules: too small, low fence, wrong fence, no door from the stall, overlapping the building", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "h1" });
    m = addRun(m, { zoneId: "h1", id: "r" });
    m = updateRun(m, "r", { rect: { x: 0, y: -12, w: 12, d: 12 }, fence: { kind: "wovenWire", heightFt: 4 } });
    const ids = runRules(m).findings.map((f) => f.rule);
    expect(ids).toContain("site.run.space");
    expect(ids).toContain("site.run.fenceHeight");
    expect(ids).toContain("site.run.fenceKind");
    expect(ids).toContain("site.run.penDoor");
    m = setOutsideAccess(m, "h1", true);
    m = fitRunToHead(m, "r");
    m = updateRun(m, "r", { fence: { kind: "noClimb", heightFt: 5 } });
    const after = runRules(m).findings.filter((f) => f.rule.startsWith("site.run."));
    expect(after.filter((f) => f.severity !== "info")).toHaveLength(0);
    const bad = { ...m, runs: m.runs.map((r) => ({ ...r, rect: { x: 2, y: 2, w: 10, d: 10 } })) };
    expect(runRules(bad).findings.some((f) => f.rule === "site.run.building" && f.severity === "error")).toBe(true);
  });
});

describe("placing the plan on the earth", () => {
  it("projects plan feet to lat/lng around the footprint centre and back, honouring orientation", () => {
    let m = base();
    m = { ...m, site: { ...m.site, lat: 40, lng: -82, orientationDeg: 0 } };
    const f = siteFrame(m)!;
    expect(f.centerFt).toEqual({ x: 12, y: 18 });
    const c = planToLatLng(f, { x: 12, y: 18 });
    expect(c.lat).toBeCloseTo(40, 9);
    expect(c.lng).toBeCloseTo(-82, 9);
    // 100' north of the centre ≈ 30.48 m ≈ 0.000274° of latitude.
    const n = planToLatLng(f, { x: 12, y: 118 });
    expect(n.lat - 40).toBeCloseTo(30.48 / 111320, 9);
    expect(n.lng).toBeCloseTo(-82, 9);
    const back = latLngToPlan(f, n);
    expect(back.x).toBeCloseTo(12, 6);
    expect(back.y).toBeCloseTo(118, 6);
    // Turned 90° clockwise, plan north points east.
    const f90 = { ...f, orientationDeg: 90 };
    const e = planToLatLng(f90, { x: 12, y: 118 });
    expect(e.lat).toBeCloseTo(40, 9);
    expect(e.lng).toBeGreaterThan(-82);
    expect(planBearingDeg(f90, { x: 0, y: 1 })).toBeCloseTo(90, 6);
    expect(planBearingDeg(f, { x: 1, y: 0 })).toBeCloseTo(90, 6);
    expect(siteFrame(base())).toBeNull();
    expect(parseLatLng("40.1, -82.2")).toEqual({ lat: 40.1, lng: -82.2 });
    expect(parseLatLng("hello")).toBeNull();
  });
});
