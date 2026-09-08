import { describe, expect, it } from "vitest";
import { addOpening, addLeanTo, createDefaultModel } from "@/lib/model";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";
import { designProgress, quickQuantities } from "@/lib/bom/quick";

describe("quick quantities", () => {
  it("summarises posts, lumber, steel, siding and concrete for the default barn", () => {
    const m = createDefaultModel();
    const q = quickQuantities(m, deriveFraming(m), deriveGeometry(m));
    expect(q.posts).toBe(16);
    expect(q.trussCount).toBe(10);
    expect(q.floorSqFt).toBe(864);
    expect(q.boardFeet).toBeGreaterThan(1500);
    expect(q.pieces["6x6"]).toBe(16);
    // Two roof planes of (12 + 1)/cos θ × 38 each.
    const theta = Math.atan2(4, 12);
    expect(q.roofSqFt).toBe(Math.round(2 * (13 / Math.cos(theta)) * 38));
    // Four wall skins (24×10 ×2 + 36×10 ×2) + two gable triangles above the eave.
    expect(q.sidingSqFt).toBeGreaterThan(1200);
    // 4" slab over 864 sq ft ≈ 288 cu ft ≈ 10.7 cu yd, plus collars.
    expect(q.concreteCuYd).toBeGreaterThan(10.5);
    expect(q.concreteCuYd).toBeLessThan(16);
  });

  it("grows with aprons and lean-to pads", () => {
    let m = addOpening(createDefaultModel(), { wallId: "wall_ext_e", type: "overheadDoor", offsetFt: 12, heightFt: 8 });
    const base = quickQuantities(m, deriveFraming(m), deriveGeometry(m));
    m = addLeanTo(m, { side: "s" });
    const withLeanTo = quickQuantities(m, deriveFraming(m), deriveGeometry(m));
    expect(withLeanTo.concreteCuYd).toBeGreaterThan(base.concreteCuYd);
    expect(withLeanTo.posts).toBe(base.posts + 4); // 24' wall -> 4 lean-to posts
  });

  it("design progress reflects the model", () => {
    const m = createDefaultModel();
    const steps = designProgress(m, 0);
    expect(steps.find((s) => s.id === "footprint")?.done).toBe(true);
    expect(steps.find((s) => s.id === "doors")?.done).toBe(false);
    expect(steps.find((s) => s.id === "site")?.done).toBe(false);
    const withDoor = addOpening(m, { wallId: "wall_ext_s", type: "manDoor" });
    expect(designProgress(withDoor, 0).find((s) => s.id === "doors")?.done).toBe(true);
    expect(designProgress(withDoor, 2).find((s) => s.id === "checks")?.done).toBe(false);
  });
});
