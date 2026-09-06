import { describe, expect, it } from "vitest";
import { createDefaultModel, setRoof } from "@/lib/model";
import { deriveGeometry, gableRiseFt, planToWorld } from "@/lib/geometry";

describe("deriveGeometry", () => {
  it("maps plan north to world -z", () => {
    expect(planToWorld(3, 5, 1)).toEqual([3, 1, -5]);
  });

  it("gable rise follows pitch over half span", () => {
    expect(gableRiseFt(24, 4)).toBe(4); // 12' run × 4/12
    expect(gableRiseFt(30, 6)).toBe(7.5);
  });

  it("produces slab, 4 wall panels, 2 roof planes and 2 gable ends for the default gable", () => {
    const g = deriveGeometry(createDefaultModel());
    expect(g.boxes.filter((b) => b.kind === "slab")).toHaveLength(1);
    expect(g.boxes.filter((b) => b.kind === "wallPanel")).toHaveLength(4);
    expect(g.boxes.filter((b) => b.kind === "roofPlane")).toHaveLength(2);
    expect(g.polygons.filter((p) => p.kind === "gableEnd")).toHaveLength(2);
    expect(g.ridgeHeightFt).toBe(14); // 10' eave + 24' span at 4:12
  });

  it("gable ends land on the correct walls for each ridge axis", () => {
    const ns = deriveGeometry(createDefaultModel());
    expect(ns.polygons.map((p) => p.entityId).sort()).toEqual(["wall_ext_n", "wall_ext_s"]);
    const ew = deriveGeometry(setRoof(createDefaultModel(), { ridgeAxis: "ew" }));
    expect(ew.polygons.map((p) => p.entityId).sort()).toEqual(["wall_ext_e", "wall_ext_w"]);
    expect(ew.ridgeHeightFt).toBe(10 + gableRiseFt(36, 4));
  });

  it("shed roof yields a single plane and full-span rise", () => {
    const g = deriveGeometry(setRoof(createDefaultModel(), { form: "shed", pitch: 3 }));
    expect(g.boxes.filter((b) => b.kind === "roofPlane")).toHaveLength(1);
    expect(g.polygons).toHaveLength(0);
    expect(g.ridgeHeightFt).toBe(10 + 24 * (3 / 12));
  });

  it("wall panels sit on the wall centreline at half height", () => {
    const g = deriveGeometry(createDefaultModel());
    const south = g.boxes.find((b) => b.entityId === "wall_ext_s")!;
    expect(south.center).toEqual([12, 5, -0]);
    expect(south.size[0]).toBe(24);
    expect(south.size[1]).toBe(10);
    const east = g.boxes.find((b) => b.entityId === "wall_ext_e")!;
    expect(east.center).toEqual([24, 5, -18]);
  });

  it("is a snapshot-stable derivation of the default model", () => {
    expect(deriveGeometry(createDefaultModel({ now: new Date(0) }))).toMatchSnapshot();
  });
});
