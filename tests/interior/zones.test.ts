import { describe, expect, it } from "vitest";
import { addZone, applyLayout, arrayZone, createDefaultModel, duplicateZone, envelopeForZones, fitEnvelopeToZones, moveZone, parseBuildingModel, removeZone, resizeZone, snapCoordinate, splitZone, updateZone, zoneRect } from "@/lib/model";
import { derivePartitions, outsideAccessRequests } from "@/lib/interior/partitions";
import { runRules } from "@/rules";

const base = () => createDefaultModel({ now: new Date(0) }); // 24×36, ridge N–S, 8' bays

describe("zones", () => {
  it("adds a pen snapped to the grid with species defaults and a name", () => {
    const m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0.3, y: 0.2, w: 11.9, d: 11.8 } });
    expect(m.zones).toHaveLength(1);
    expect(zoneRect(m.zones[0])).toEqual({ x: 0, y: 0, w: 12, d: 12 });
    expect(m.zones[0].name).toBe("Horse 1");
    expect(m.zones[0].flooring).toBe("concreteMats");
    expect(() => parseBuildingModel(m)).not.toThrow();
  });

  it("snaps to bay lines and to neighbouring zone edges", () => {
    const m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 } });
    expect(snapCoordinate(m, "y", 16.4)).toBe(16); // bay line
    expect(snapCoordinate(m, "x", 12.4)).toBe(12); // zone edge
    expect(snapCoordinate(m, "x", 12.7)).toBe(13); // plain grid
  });

  it("auto-grows the building on the bay module when a pen lands outside", () => {
    const m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 36, w: 12, d: 12 } });
    expect(m.footprint).toEqual({ kind: "rect", wFt: 24, dFt: 48 }); // 36 + 12 = 48, on 8' bays
    const wide = addZone(base(), { type: "pen", species: "horse", rect: { x: 24, y: 0, w: 12, d: 12 } });
    expect(wide.footprint).toEqual({ kind: "rect", wFt: 36, dFt: 36 });
    const m2 = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 36, w: 12, d: 12 }, autoGrow: false });
    expect(m2.footprint.kind === "rect" && m2.footprint.dFt).toBe(36);
    expect(runRules(m2).findings.some((f) => f.rule === "design.zones.insideFootprint" && f.fix?.command === "growToFitZones")).toBe(true);
  });

  it("move, resize, duplicate, array, split, remove", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "a" });
    m = moveZone(m, "a", 12.3, 0);
    expect(zoneRect(m.zones[0]).x).toBe(12);
    m = resizeZone(m, "a", { x: 12, y: 0, w: 12, d: 14 });
    expect(zoneRect(m.zones[0]).d).toBe(14);
    m = duplicateZone(m, "a", "n");
    expect(m.zones).toHaveLength(2);
    expect(zoneRect(m.zones[1])).toEqual({ x: 12, y: 14, w: 12, d: 14 });
    expect(m.zones[1].name).toBe("Horse 2");
    m = arrayZone(m, m.zones[1].id, 2, "n");
    expect(m.zones).toHaveLength(4);
    expect(m.footprint.kind === "rect" && m.footprint.dFt).toBe(56); // 4 × 14 = 56 on 8' bays
    m = splitZone(m, "a", 2, "x");
    expect(m.zones).toHaveLength(5);
    expect(m.zones.filter((z) => z.name.startsWith("Horse 1")).map((z) => zoneRect(z).w)).toEqual([6, 6]);
    m = removeZone(m, "a");
    expect(m.zones).toHaveLength(4);
    expect(updateZone(m, "nope", { name: "x" })).toBe(m);
  });

  it("changing a pen to a room drops species; rooms keep names", () => {
    const m = addZone(base(), { type: "pen", species: "goat", rect: { x: 0, y: 0, w: 5, d: 6 }, id: "g" });
    const tack = updateZone(m, "g", { type: "tack" });
    expect(tack.zones[0].species).toBeUndefined();
  });

  it("fitEnvelopeToZones shrink-wraps on the modules", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 } });
    m = addZone(m, { type: "aisle", rect: { x: 12, y: 0, w: 12, d: 12 } });
    expect(envelopeForZones(m, { shrink: true })).toEqual({ wFt: 24, dFt: 16 });
    const fitted = fitEnvelopeToZones(m);
    expect(fitted.footprint).toEqual({ kind: "rect", wFt: 24, dFt: 16 });
  });
});

describe("outside access doors", () => {
  it("adds a Dutch door centred on the pen's exterior edge, follows moves, and is removed with the pen", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 12, y: 12, w: 12, d: 12 }, id: "p", outsideAccess: true });
    let door = m.openings.find((o) => o.zoneId === "p")!;
    expect(door).toMatchObject({ type: "dutchDoor", wallId: "wall_ext_e", widthFt: 4 });
    expect(door.offsetFt).toBe(16); // centre 18 - 2
    m = moveZone(m, "p", 12, 20);
    door = m.openings.find((o) => o.zoneId === "p")!;
    expect(door.offsetFt).toBe(24);
    m = moveZone(m, "p", 4, 12); // no longer on an exterior wall
    expect(m.openings.some((o) => o.zoneId === "p")).toBe(false);
    m = moveZone(m, "p", 0, 12); // west wall
    expect(m.openings.find((o) => o.zoneId === "p")?.wallId).toBe("wall_ext_w");
    m = removeZone(m, "p");
    expect(m.openings).toHaveLength(0);
  });
});

describe("layouts", () => {
  it("centre-aisle on a 24×36: 3 × 12' stalls each side + 14' aisle, width 12+14+12", () => {
    const m = applyLayout(base(), "centerAisle", { species: "horse" });
    expect(m.footprint).toEqual({ kind: "rect", wFt: 38, dFt: 36 });
    expect(m.zones.filter((z) => z.type === "pen")).toHaveLength(6);
    expect(m.zones.filter((z) => z.type === "aisle")).toHaveLength(1);
    expect(zoneRect(m.zones.find((z) => z.type === "aisle")!)).toEqual({ x: 12, y: 0, w: 14, d: 36 });
    const report = runRules(m);
    expect(report.errors).toBe(0);
    expect(report.findings.some((f) => f.rule === "animals.pen.minimumSize")).toBe(false);
    expect(report.findings.some((f) => f.rule === "framing.partitions.onPostLine")).toBe(true); // 12' stalls on 8' bays
    const onGrid = applyLayout(base(), "centerAisle", { species: "horse", stallFt: 8 });
    expect(onGrid.zones.filter((z) => z.type === "pen")).toHaveLength(8);
  });

  it("centre-aisle with support bays swaps the first bays for tack/feed", () => {
    const m = applyLayout(base(), "centerAisle", { species: "horse", supportBays: 2, aisleFt: 12 });
    expect(m.zones.map((z) => z.type).filter((t) => t !== "pen" && t !== "aisle").sort()).toEqual(["feed", "tack"]);
  });

  it("shed-row: one row of stalls opening outside", () => {
    const m = applyLayout(base(), "shedRow", { species: "goat", stallFt: 8, depthFt: 10 });
    expect(m.zones).toHaveLength(4);
    expect(m.zones.every((z) => z.outsideAccess)).toBe(true);
    expect(m.footprint).toEqual({ kind: "rect", wFt: 10, dFt: 36 });
    expect(runRules(m).findings.some((f) => f.rule === "design.pen.access")).toBe(false);
  });

  it("clear removes all zones", () => {
    expect(applyLayout(applyLayout(base(), "centerAisle"), "clear").zones).toHaveLength(0);
  });
});

describe("partitions derived from zones", () => {
  it("shared edges become one partition; exterior edges are skipped; pens facing the aisle get a door", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "p1" });
    m = addZone(m, { type: "pen", species: "horse", rect: { x: 0, y: 12, w: 12, d: 12 }, id: "p2" });
    m = addZone(m, { type: "aisle", rect: { x: 12, y: 0, w: 12, d: 24 }, id: "aisle" });
    const parts = derivePartitions(m);
    // p1|p2 shared wall at y=12 (x 0..12), p1|aisle at x=12 (y 0..12), p2|aisle at x=12 (y 12..24). The aisle's north edge at y=24 is a partition (open side) too.
    const between = parts.find((p) => p.zones.map((z) => z?.id).sort().join() === "p1,p2");
    expect(between).toMatchObject({ x0: 0, y0: 12, x1: 12, y1: 12, kind: "stall", kickFt: 4, topFt: 7.5 });
    const fronts = parts.filter((p) => p.zones.some((z) => z?.id === "aisle") && p.zones.some((z) => z?.type === "pen"));
    expect(fronts).toHaveLength(2);
    for (const f of fronts) {
      expect(f.doors).toHaveLength(1);
      expect(f.doors[0].widthFt).toBe(4);
      expect(f.doors[0].u).toBeCloseTo(4, 9); // centred on a 12' front
    }
    expect(parts.every((p) => !(p.x0 === 0 && p.x1 === 0) && !(p.y0 === 0 && p.y1 === 0))).toBe(true);
  });

  it("rooms get full-height partitions and flags post-line alignment", () => {
    let m = addZone(base(), { type: "tack", rect: { x: 0, y: 0, w: 12, d: 8 }, id: "t" });
    m = addZone(m, { type: "aisle", rect: { x: 12, y: 0, w: 12, d: 8 }, id: "a" });
    const parts = derivePartitions(m);
    const wall = parts.find((p) => p.zones.some((z) => z?.id === "t") && p.zones.some((z) => z?.id === "a"))!;
    expect(wall.kind).toBe("full");
    expect(wall.kickFt).toBe(10);
    const north = parts.find((p) => p.y0 === 8 && p.y1 === 8 && p.zones.some((z) => z?.id === "t"))!;
    expect(north.onPostLine).toBe(true); // y = 8 on 8' bays
  });

  it("outside access requests report the wall side and centre", () => {
    const m = addZone(base(), { type: "pen", species: "horse", rect: { x: 12, y: 12, w: 12, d: 12 }, outsideAccess: true });
    const req = outsideAccessRequests(m);
    expect(req).toHaveLength(1);
    expect(req[0]).toMatchObject({ side: "e", centerFt: 18 });
    const corner = addZone(base(), { type: "pen", species: "horse", rect: { x: 12, y: 0, w: 12, d: 12 }, outsideAccess: true });
    expect(outsideAccessRequests(corner)[0].side).toBe("s"); // south wins at a corner
  });
});

describe("zone rules", () => {
  it("flags overlaps, undersized pens, narrow aisles and pens without access", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 10, d: 10 }, id: "small" });
    m = addZone(m, { type: "pen", species: "horse", rect: { x: 5, y: 5, w: 12, d: 12 }, id: "over", autoGrow: false });
    m = addZone(m, { type: "aisle", rect: { x: 0, y: 20, w: 8, d: 16 }, id: "aisle" });
    const rules = runRules(m).findings.map((f) => f.rule);
    expect(rules).toContain("design.zones.overlap");
    expect(rules).toContain("animals.pen.minimumSize");
    expect(rules).toContain("design.aisle.minWidth");
    expect(rules).toContain("design.pen.access");
    const goats = addZone(base(), { type: "pen", species: "goat", rect: { x: 0, y: 0, w: 10, d: 10 }, headCount: 8, outsideAccess: true });
    expect(runRules(goats).findings.some((f) => f.rule === "animals.pen.minimumSize")).toBe(true); // 100 < 8 × 20
  });
});
