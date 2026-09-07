import { describe, expect, it } from "vitest";
import { addOpening, createDefaultModel, setRoof } from "@/lib/model";
import { deriveGeometry, gableRiseFt, planToWorld, skinPieces } from "@/lib/geometry";
import { openingSpans, roofParams } from "@/lib/framing";

const base = () => createDefaultModel({ now: new Date(0) });

describe("deriveGeometry", () => {
  it("maps plan north to world -z", () => {
    expect(planToWorld(3, 5, 1)).toEqual([3, 1, -5]);
  });

  it("gable rise follows pitch over half span", () => {
    expect(gableRiseFt(24, 4)).toBe(4);
    expect(gableRiseFt(30, 6)).toBe(7.5);
  });

  it("produces slab, 4 wall skins, 2 roof planes, 2 gable ends and framing for the default gable", () => {
    const g = deriveGeometry(base());
    expect(g.boxes.filter((b) => b.kind === "slab")).toHaveLength(1);
    expect(g.boxes.filter((b) => b.kind === "wallSkin")).toHaveLength(4);
    expect(g.boxes.filter((b) => b.kind === "roofPlane")).toHaveLength(2);
    expect(g.polygons.filter((p) => p.kind === "gableEnd")).toHaveLength(2);
    expect(g.boxes.filter((b) => b.kind === "framing").length).toBeGreaterThan(50);
    // Every box declares a layer and a material.
    for (const b of g.boxes) {
      expect(b.layer).toBeTruthy();
      expect(b.material).toBeTruthy();
    }
  });

  it("ridge height = eave + heel + purlin + panel + rise", () => {
    const m = base(); // 24 span, 4:12, heel 6", 2x4 purlin on edge
    const rp = roofParams(m);
    const theta = Math.atan2(4, 12);
    const expected = 10 + 0.5 + 3.5 / 12 / Math.cos(theta) + 4 + 0.75 / 12 / Math.cos(theta);
    expect(rp.ridgeHeightFt).toBeCloseTo(expected, 9);
    expect(deriveGeometry(m).ridgeHeightFt).toBeCloseTo(expected, 9);
  });

  it("gable ends land on the correct walls for each ridge axis", () => {
    const ns = deriveGeometry(base());
    expect(ns.polygons.map((p) => p.entityId).sort()).toEqual(["wall_ext_n", "wall_ext_s"]);
    const ew = deriveGeometry(setRoof(base(), { ridgeAxis: "ew" }));
    expect(ew.polygons.map((p) => p.entityId).sort()).toEqual(["wall_ext_e", "wall_ext_w"]);
  });

  it("shed roof yields a single plane and two sloped infills", () => {
    const g = deriveGeometry(setRoof(base(), { form: "shed", pitch: 3 }));
    expect(g.boxes.filter((b) => b.kind === "roofPlane")).toHaveLength(1);
    expect(g.polygons).toHaveLength(2);
  });

  it("wall skins sit on the wall line, outside it, at half height", () => {
    const g = deriveGeometry(base());
    const south = g.boxes.find((b) => b.kind === "wallSkin" && b.entityId === "wall_ext_s")!;
    expect(south.center[0]).toBeCloseTo(12, 9);
    expect(south.center[1]).toBeCloseTo(5, 9);
    expect(south.center[2]).toBeCloseTo(0.75 / 24, 9); // siding half-thickness south (+z) of the line
    expect(south.size[0]).toBeCloseTo(24, 9);
    expect(south.size[1]).toBeCloseTo(10, 9);
    const east = g.boxes.find((b) => b.kind === "wallSkin" && b.entityId === "wall_ext_e")!;
    expect(east.center[0]).toBeCloseTo(24 + 0.75 / 24, 9);
    expect(east.center[2]).toBeCloseTo(-18, 9);
  });

  it("cuts the skin around a door and a window", () => {
    let m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 4, id: "d" });
    m = addOpening(m, { wallId: "wall_ext_s", type: "window", offsetFt: 14, id: "w" });
    const pieces = skinPieces(24, 10, openingSpans(m, "wall_ext_s"));
    // left of door, above door, between, below window, above window, right of window
    expect(pieces.length).toBe(6);
    const total = pieces.reduce((a, p) => a + (p.u1 - p.u0) * (p.h1 - p.h0), 0);
    expect(total).toBeCloseTo(24 * 10 - 3 * (6 + 8 / 12) - 3 * 4, 9);
    const g = deriveGeometry(m);
    expect(g.boxes.filter((b) => b.kind === "wallSkin" && b.entityId === "wall_ext_s")).toHaveLength(6);
    expect(g.boxes.filter((b) => b.kind === "doorLeaf" && b.entityId === "d")).toHaveLength(1);
    expect(g.boxes.filter((b) => b.kind === "glazing" && b.entityId === "w")).toHaveLength(1);
  });

  it("sliding doors hang outside the wall, wider than the opening", () => {
    const m = addOpening(base(), { wallId: "wall_ext_e", type: "slidingDoor", offsetFt: 10, id: "s" });
    const leaf = deriveGeometry(m).boxes.find((b) => b.id === "s_leaf")!;
    expect(leaf.size[0]).toBeCloseTo(9, 9); // 8' + 6" each side
    expect(leaf.center[0]).toBeGreaterThan(24 + 0.25); // east of the east wall line by the standoff
  });

  it("is a snapshot-stable derivation of the default model", () => {
    const g = deriveGeometry(base());
    expect({ boxes: g.boxes.length, polygons: g.polygons.length, ridge: g.ridgeHeightFt, bounds: g.bounds, kinds: countBy(g.boxes.map((b) => b.kind)) }).toMatchSnapshot();
  });
});

function countBy(xs: string[]) {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}
