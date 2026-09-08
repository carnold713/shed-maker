import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel } from "@/lib/model";
import { addFence, addFenceGate, fenceAreaSqFt, fenceLengthFt, fenceSegmentAt, fenceSegments, fenceVertexAt, formatArea, insertFencePoint, moveFence, moveFencePoint, removeFence, removeFencePoint, snapFencePoint, updateFence } from "@/lib/model/fences";
import { deriveFencing } from "@/lib/site/fencing";
import { siteGeometry } from "@/lib/geometry/site";
import { siteExtent } from "@/lib/model/runs";
import { runRules } from "@/rules";
import { estimateMaterials } from "@/lib/bom/estimate";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";

const base = () => createDefaultModel({ now: new Date(0) });

describe("free fence lines", () => {
  it("a closed paddock: length, area in acres, corner and line posts, a gate on the longest side", () => {
    // 200' × 150' paddock east of the barn (24' × 36').
    let m = addFence(base(), { points: [{ x: 40, y: -50 }, { x: 240, y: -50 }, { x: 240, y: 100 }, { x: 40, y: 100 }], closed: true, id: "p" });
    const f = m.fences[0];
    expect(f.name).toBe("Paddock 1");
    expect(f.closed).toBe(true);
    expect(fenceSegments(f)).toHaveLength(4);
    expect(fenceLengthFt(f)).toBe(700);
    expect(fenceAreaSqFt(f)).toBe(30000);
    expect(formatArea(30000)).toBe("0.69 acres");
    expect(formatArea(1200)).toBe("1,200 sq ft");
    m = addFenceGate(m, "p", { widthFt: 12 });
    expect(m.fences[0].gates[0]).toMatchObject({ seg: 0, widthFt: 12, offsetFt: 94 }); // centred on the first 200' side
    const t = deriveFencing(m);
    expect(t.fences[0]).toMatchObject({ name: "Paddock 1", closed: true, lengthFt: 700, areaSqFt: 30000, corners: 4, gatePosts: 2 });
    expect(t.fences[0].linePosts).toBe(2 * (25 - 1) + 2 * (Math.ceil(150 / 8) - 1));
    expect(t.totalFenceFt).toBe(700);
    expect(t.gates).toEqual([{ widthFt: 12, count: 1 }]);
    expect(siteExtent(m)).toEqual({ x: 0, y: -50, w: 240, d: 150 });
    expect(() => parseBuildingModel(m)).not.toThrow();
    // 3D: posts at every corner and along the sides, mesh panels, a gate frame.
    const g = siteGeometry(m);
    expect(g.filter((b) => b.kind === "fencePost").length).toBeGreaterThan(80);
    expect(g.filter((b) => b.kind === "gate")).toHaveLength(1);
    expect(g.some((b) => b.kind === "fencePanel")).toBe(true);
    // Estimate: rolls of no-climb for 688' of fence.
    const est = estimateMaterials(m, deriveFraming(m), deriveGeometry(m));
    expect(est.lines.find((l) => l.sku === "fence.noClimb.roll")?.quantity).toBe(Math.ceil(688 / 100));
  });

  it("an open lane, editing corners, moving, snapping and the gate rule", () => {
    let m = addFence(base(), { points: [{ x: 30, y: 0.2 }, { x: 60, y: 0 }, { x: 60, y: 40 }], id: "l" });
    expect(m.fences[0].name).toBe("Fence line 1");
    expect(m.fences[0].points[0]).toEqual({ x: 30, y: 0 }); // snapped to the half foot
    expect(fenceAreaSqFt(m.fences[0])).toBe(0);
    m = insertFencePoint(m, "l", 0, { x: 45, y: 10 });
    expect(m.fences[0].points).toHaveLength(4);
    m = moveFencePoint(m, "l", 1, { x: 45.3, y: 12.2 });
    expect(m.fences[0].points[1]).toEqual({ x: 45.5, y: 12 });
    m = removeFencePoint(m, "l", 1);
    expect(m.fences[0].points).toHaveLength(3);
    expect(fenceVertexAt(m, { x: 60.5, y: 40.5 }, 2)?.index).toBe(2);
    expect(fenceSegmentAt(m, { x: 62, y: 20 }, 3)?.seg.i).toBe(1);
    m = moveFence(m, "l", 10, 0);
    expect(m.fences[0].points[0]).toEqual({ x: 40, y: 0 });
    // Closing needs three corners; a two-point line stays open.
    expect(updateFence(m, "l", { closed: true }).fences[0].closed).toBe(true);
    const two = addFence(base(), { points: [{ x: 0, y: 40 }, { x: 24, y: 40 }], closed: true, id: "t" });
    expect(two.fences[0].closed).toBe(false);
    // Snapping: near the barn's corner it lands on the corner.
    expect(snapFencePoint(base(), { x: 24.8, y: 36.6 })).toEqual({ x: 24, y: 36 });
    expect(snapFencePoint(base(), { x: 100.3, y: 50.2 })).toEqual({ x: 100.5, y: 50 });
    // Rule: a closed paddock without a gate is an info finding with a fix.
    const closed = addFence(base(), { points: [{ x: 40, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 40 }], closed: true, id: "c" });
    const f = runRules(closed).findings.find((x) => x.rule === "site.fence.gate");
    expect(f?.fix?.command).toBe("addFenceGate");
    expect(runRules(addFenceGate(closed, "c", { widthFt: 12 })).findings.some((x) => x.rule === "site.fence.gate")).toBe(false);
    m = removeFence(m, "l");
    expect(m.fences).toHaveLength(0);
  });
});
