import { describe, expect, it } from "vitest";
import { addLeanTo, addOpening, createDefaultModel, leanToHeights, leanToPolygon, leanToSpan, parseBuildingModel, removeLeanTo, setEaveHeight, updateLeanTo } from "@/lib/model";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";
import { runRules } from "@/rules";

const base = () => createDefaultModel({ now: new Date(0) }); // 24×36, eave 10'

describe("lean-tos", () => {
  it("adds one per side with defaults, validates, and resolves its span and heights", () => {
    const m = addLeanTo(base(), { side: "e" });
    expect(m.leanTos).toHaveLength(1);
    expect(m.leanTos[0]).toMatchObject({ side: "e", depthFt: 12, pitch: 3, enclosed: false, slab: true, dropIn: 6 });
    expect(() => parseBuildingModel(m)).not.toThrow();
    expect(addLeanTo(m, { side: "e" })).toBe(m); // one per side
    const span = leanToSpan(m, m.leanTos[0]);
    expect(span).toMatchObject({ wallId: "wall_ext_e", u0: 0, u1: 36, lengthFt: 36 });
    const h = leanToHeights(m, m.leanTos[0]);
    expect(h.highFt).toBe(9.5);
    expect(h.lowFt).toBeCloseTo(6.5, 9); // 12' at 3:12 drops 3'
    const poly = leanToPolygon(m, m.leanTos[0]);
    expect(poly.map((p) => [p.x, p.y])).toEqual([
      [24, 0],
      [24, 36],
      [36, 36],
      [36, 0],
    ]);
  });

  it("update clamps depth, partial spans resolve, remove works", () => {
    let m = addLeanTo(base(), { side: "s", depthFt: 10, offsetFt: 4, lengthFt: 12 });
    expect(leanToSpan(m, m.leanTos[0])).toMatchObject({ u0: 4, u1: 16, lengthFt: 12 });
    m = updateLeanTo(m, m.leanTos[0].id, { depthFt: 40 });
    expect(m.leanTos[0].depthFt).toBe(24);
    expect(updateLeanTo(m, m.leanTos[0].id, { depthFt: 24 })).toBe(m);
    expect(removeLeanTo(m, m.leanTos[0].id).leanTos).toHaveLength(0);
  });

  it("frames the lean-to: outer posts ≤ 8' apart, 2-ply header, ledger, rafters at 24\", purlins", () => {
    const m = addLeanTo(base(), { side: "e" }); // 36' wall
    const fs = deriveFraming(m);
    const posts = fs.members.filter((x) => x.kind === "post" && x.entityId === m.leanTos[0].id);
    expect(posts).toHaveLength(6); // 36 / 8 -> 5 bays, 6 posts
    // Posts stand on the outer edge, 12' east of the east wall.
    for (const p of posts) expect(p.center[0]).toBeCloseTo(24 + 12 - 5.5 / 24, 6);
    expect(fs.members.filter((x) => x.kind === "header" && x.entityId === m.leanTos[0].id)).toHaveLength(2);
    expect(fs.members.filter((x) => x.kind === "carrier" && x.entityId === m.leanTos[0].id)).toHaveLength(1);
    const rafters = fs.members.filter((x) => x.kind === "trussTopChord" && x.entityId === m.leanTos[0].id);
    expect(rafters.length).toBe(19); // 36' / 2' + end rafter
    expect(rafters[0].lengthFt).toBeCloseTo(12 / Math.cos(Math.atan2(3, 12)), 9);
    expect(fs.posts.filter((p) => p.wallId === "wall_ext_e").length).toBeGreaterThan(6);
  });

  it("geometry adds a roof plane, a pad, and siding when enclosed", () => {
    const open = deriveGeometry(addLeanTo(base(), { side: "n" }));
    expect(open.boxes.some((b) => b.kind === "roofPlane" && b.entityId.startsWith("lt_"))).toBe(true);
    expect(open.boxes.some((b) => b.kind === "slab" && b.entityId.startsWith("lt_"))).toBe(true);
    expect(open.boxes.some((b) => b.kind === "leanToSkin")).toBe(false);
    const closed = deriveGeometry(addLeanTo(base(), { side: "n", enclosed: true, slab: false }));
    expect(closed.boxes.filter((b) => b.kind === "leanToSkin")).toHaveLength(3);
    expect(closed.boxes.some((b) => b.kind === "slab" && b.entityId.startsWith("lt_"))).toBe(false);
  });

  it("lean-to roof planes fall away from the wall on all four sides", () => {
    const rot = (b: { rotation: [number, number, number] }, v: [number, number, number]) => {
      // three.js Euler XYZ: M = Rx·Ry·Rz, so a vector sees Rz first, then Ry, then Rx.
      const [rx, ry, rz] = b.rotation;
      let [x, y, z] = v;
      [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
      [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
      [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
      return [x, y, z] as [number, number, number];
    };
    for (const side of ["n", "s", "e", "w"] as const) {
      const m = addLeanTo(base(), { side });
      const roof = deriveGeometry(m).boxes.find((b) => b.kind === "roofPlane" && b.entityId.startsWith("lt_"))!;
      // Local +z runs outward from the wall: that end must be lower and further from the building centre.
      const outer = rot(roof, [0, 0, roof.size[2] / 2]);
      const inner = rot(roof, [0, 0, -roof.size[2] / 2]);
      expect(outer[1]).toBeLessThan(inner[1] - 2);
      const cx = 12;
      const cz = -18;
      const dOut = Math.hypot(roof.center[0] + outer[0] - cx, roof.center[2] + outer[2] - cz);
      const dIn = Math.hypot(roof.center[0] + inner[0] - cx, roof.center[2] + inner[2] - cz);
      expect(dOut).toBeGreaterThan(dIn + 8);
    }
  });

  it("warns when the outer edge drops below 7' and offers to raise the eave", () => {
    const m = addLeanTo(base(), { side: "w", depthFt: 12, pitch: 3 }); // low edge 6.5'
    const f = runRules(m).findings.find((x) => x.rule === "design.leanTo.clearance")!;
    expect(f.severity).toBe("warn");
    expect(f.fix?.args?.ft).toBe(11);
    expect(runRules(setEaveHeight(m, 11)).findings.some((x) => x.rule === "design.leanTo.clearance")).toBe(false);
    expect(runRules(addLeanTo(base(), { side: "w", depthFt: 16 })).findings.some((x) => x.rule === "structural.leanTo.rafterSpan")).toBe(true);
  });
});

describe("concrete pad and exterior openings", () => {
  it("renders slab and gravel base under the building and aprons outside vehicle doors", () => {
    let m = addOpening(base(), { wallId: "wall_ext_e", type: "overheadDoor", offsetFt: 12, heightFt: 8, id: "oh" });
    m = addOpening(m, { wallId: "wall_ext_s", type: "manDoor", offsetFt: 4, id: "man" });
    const g = deriveGeometry(m);
    expect(g.boxes.some((b) => b.id === "slab")).toBe(true);
    expect(g.boxes.some((b) => b.kind === "gravel")).toBe(true);
    const aprons = g.boxes.filter((b) => b.kind === "apron");
    expect(aprons.map((a) => a.entityId)).toEqual(["oh"]);
    expect(aprons[0].size[0]).toBe(12); // 10' door + 1' each side
    expect(aprons[0].center[0]).toBeCloseTo(24 + 4, 9); // 8' deep, centred 4' east of the east wall
    const off = deriveGeometry({ ...m, foundation: { ...m.foundation, slab: { ...m.foundation.slab, aprons: false } } });
    expect(off.boxes.some((b) => b.kind === "apron")).toBe(false);
  });

  it("roll-up doors get a coil, need 18\" of headroom, and half-light man doors get glazing", () => {
    let m = addOpening(base(), { wallId: "wall_ext_e", type: "rollUpDoor", offsetFt: 12, widthFt: 10, heightFt: 10, id: "ru" });
    expect(deriveGeometry(m).boxes.some((b) => b.kind === "coil" && b.entityId === "ru")).toBe(true);
    const f = runRules(m).findings.find((x) => x.rule === "structural.openings.overheadHeadroom")!;
    expect(f.fix?.args?.ft).toBe(12); // 10 + 1.5 -> 12
    m = addOpening(m, { wallId: "wall_ext_s", type: "manDoor", offsetFt: 4, variant: "halfLight", id: "hl" });
    expect(deriveGeometry(m).boxes.some((b) => b.kind === "glazing" && b.entityId === "hl")).toBe(true);
    expect(() => parseBuildingModel(m)).not.toThrow();
  });
});
