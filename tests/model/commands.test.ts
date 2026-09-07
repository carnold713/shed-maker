import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel, setEaveHeight, setFootprintRect, setFrameSystem, setName, setRoof, snapToModule, EXTERIOR_WALL_IDS, wallLengthFt } from "@/lib/model";

const base = () => createDefaultModel({ now: new Date("2026-01-01T00:00:00Z") });

describe("commands", () => {
  it("setFootprintRect resizes and re-derives exterior walls", () => {
    const m = setFootprintRect(base(), 30, 40);
    expect(m.footprint).toEqual({ kind: "rect", wFt: 30, dFt: 40 });
    const s = m.walls.find((w) => w.id === EXTERIOR_WALL_IDS.s)!;
    const e = m.walls.find((w) => w.id === EXTERIOR_WALL_IDS.e)!;
    expect(wallLengthFt(s)).toBe(30);
    expect(wallLengthFt(e)).toBe(40);
    expect(() => parseBuildingModel(m)).not.toThrow();
  });

  it("setFootprintRect returns the same reference when unchanged (no undo entry)", () => {
    const m = base();
    expect(setFootprintRect(m, 24, 36)).toBe(m);
  });

  it("setFootprintRect clamps to sane bounds and tolerates NaN", () => {
    const m = setFootprintRect(base(), NaN, 10_000);
    expect(m.footprint).toEqual({ kind: "rect", wFt: 4, dFt: 200 });
  });

  it("shrinking the footprint drops openings that no longer fit", () => {
    const m0 = base();
    const withOpening = {
      ...m0,
      openings: [
        { id: "o1", wallId: EXTERIOR_WALL_IDS.s, type: "manDoor" as const, offsetFt: 20, widthFt: 3, heightFt: 6.67, sillFt: 0, swing: "out" as const, hardware: [] },
        { id: "o2", wallId: EXTERIOR_WALL_IDS.s, type: "window" as const, offsetFt: 2, widthFt: 3, heightFt: 4, sillFt: 4, swing: "none" as const, hardware: [] },
      ],
    };
    const m = setFootprintRect(withOpening, 20, 36);
    expect(m.openings.map((o) => o.id)).toEqual(["o2"]);
  });

  it("setEaveHeight updates every exterior wall", () => {
    const m = setEaveHeight(base(), 12);
    expect(m.eaveHeightFt).toBe(12);
    expect(m.walls.every((w) => w.heightFt === 12)).toBe(true);
    expect(setEaveHeight(base(), 1).eaveHeightFt).toBe(6);
  });

  it("setFrameSystem switches foundation and truss spacing defaults", () => {
    const m = setFrameSystem(base(), "stickFrame");
    expect(m.foundation.kind).toBe("monolithicSlab");
    expect(m.frame.trusses.spacingIn).toBe(24);
    const back = setFrameSystem(m, "postFrame");
    expect(back.foundation.kind).toBe("embeddedPost");
    expect(back.frame.trusses.spacingIn).toBe(48);
  });

  it("setRoof patches and setName trims", () => {
    expect(setRoof(base(), { pitch: 6 }).roof.pitch).toBe(6);
    expect(setName(base(), "  My barn ").meta.name).toBe("My barn");
    const m = base();
    expect(setName(m, "   ")).toBe(m);
  });

  it("snapToModule rounds to 2' and 4'", () => {
    expect(snapToModule(23)).toBe(24);
    expect(snapToModule(25, 4)).toBe(24);
    expect(snapToModule(1)).toBe(2);
  });
});
