import { describe, expect, it } from "vitest";
import { addOpening, centerOpening, createDefaultModel, flipOpeningSwing, moveOpening, parseBuildingModel, removeOpening, setFootprintRect, updateOpening } from "@/lib/model";

const base = () => createDefaultModel({ now: new Date(0) });

describe("opening commands", () => {
  it("adds an opening with catalog defaults, centred when no offset is given", () => {
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor" });
    expect(m.openings).toHaveLength(1);
    const o = m.openings[0];
    expect(o.widthFt).toBe(3);
    expect(o.heightFt).toBeCloseTo(6 + 8 / 12, 9);
    expect(o.offsetFt).toBeCloseTo(10.5, 9);
    expect(o.swing).toBe("out");
    expect(() => parseBuildingModel(m)).not.toThrow();
  });

  it("windows default to a 4' sill", () => {
    const m = addOpening(base(), { wallId: "wall_ext_e", type: "window", centerFt: 18 });
    expect(m.openings[0]).toMatchObject({ sillFt: 4, widthFt: 3, heightFt: 4 });
    expect(m.openings[0].offsetFt).toBe(16.5);
  });

  it("clamps to the wall and snaps to 1\"", () => {
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 7.377 });
    expect(m.openings[0].offsetFt).toBeCloseTo(Math.round(7.377 * 12) / 12, 9);
    const far = moveOpening(m, m.openings[0].id, 99);
    expect(far.openings[0].offsetFt).toBe(21);
    const neg = moveOpening(m, m.openings[0].id, -5);
    expect(neg.openings[0].offsetFt).toBe(0);
  });

  it("changing type keeps the centre and takes the new preset size", () => {
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 10 });
    const id = m.openings[0].id;
    const sliding = updateOpening(m, id, { type: "slidingDoor" });
    expect(sliding.openings[0].widthFt).toBe(8);
    expect(sliding.openings[0].offsetFt).toBeCloseTo(11.5 - 4, 9);
    expect(sliding.openings[0].swing).toBe("slideRight");
  });

  it("no-op updates return the same reference", () => {
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 10 });
    expect(updateOpening(m, m.openings[0].id, { offsetFt: 10 })).toBe(m);
    expect(removeOpening(m, "nope")).toBe(m);
    expect(addOpening(m, { wallId: "missing", type: "window" })).toBe(m);
  });

  it("flip, center on wall, center in bay", () => {
    const m = addOpening(base(), { wallId: "wall_ext_e", type: "manDoor", offsetFt: 3 });
    const id = m.openings[0].id;
    expect(flipOpeningSwing(m, id).openings[0].swing).toBe("in");
    expect(centerOpening(m, id, "wall").openings[0].offsetFt).toBe(16.5);
    // East wall is a bearing wall on 8' bays: bay 0 centre = 4'.
    expect(centerOpening(m, id, "bay").openings[0].offsetFt).toBe(2.5);
    expect(centerOpening(moveOpening(m, id, 26), id, "bay").openings[0].offsetFt).toBe(26.5); // bay 24–32 => centre 28
    expect(centerOpening(moveOpening(m, id, 33), id, "bay").openings[0].offsetFt).toBe(32.5); // remainder bay 32–36 => centre 34
  });

  it("removes openings and drops those that stop fitting after a resize", () => {
    let m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 20 });
    expect(removeOpening(m, m.openings[0].id).openings).toHaveLength(0);
    m = setFootprintRect(m, 20, 36);
    expect(m.openings).toHaveLength(0);
  });
});
