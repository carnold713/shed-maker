import { describe, expect, it } from "vitest";
import { addOpening, createDefaultModel, setFrameSystem, updateOpening } from "@/lib/model";
import { runRules } from "@/rules";

const base = () => createDefaultModel({ now: new Date(0) });
const findings = (m: ReturnType<typeof base>, rule: string) => runRules(m).findings.filter((f) => f.rule === rule);

describe("opening rules", () => {
  it("flags openings within 12\" of a corner — error in post-frame, warn in stick", () => {
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 0.5 });
    expect(findings(m, "framing.openings.cornerClearance")[0]?.severity).toBe("error");
    const stick = setFrameSystem(m, "stickFrame");
    expect(findings(stick, "framing.openings.cornerClearance")[0]?.severity).toBe("warn");
    const ok = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 2 });
    expect(findings(ok, "framing.openings.cornerClearance")).toHaveLength(0);
  });

  it("flags overlapping openings", () => {
    let m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 4, id: "a" });
    m = addOpening(m, { wallId: "wall_ext_s", type: "window", offsetFt: 5, id: "b" });
    const f = findings(m, "framing.openings.overlap");
    expect(f).toHaveLength(1);
    expect(f[0].entityIds).toEqual(["a", "b"]);
  });

  it("warns when a small opening crosses a post line and offers a bay-centre fix", () => {
    // South wall of a 24×36 with ridge N–S is an end wall: posts at 8' and 16'.
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 7 });
    const f = findings(m, "framing.openings.postLine");
    expect(f).toHaveLength(1);
    expect(f[0].fix?.command).toBe("centerOpeningInBay");
    const centred = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 2.5 });
    expect(findings(centred, "framing.openings.postLine")).toHaveLength(0);
  });

  it("errors when an overhead door has no headroom under the eave", () => {
    const m = addOpening(base(), { wallId: "wall_ext_e", type: "overheadDoor", offsetFt: 10, widthFt: 10, heightFt: 10 });
    const f = findings(m, "structural.openings.overheadHeadroom");
    expect(f).toHaveLength(1);
    expect(f[0].fix?.args?.ft).toBe(11);
    const ok = updateOpening(m, m.openings[0].id, { heightFt: 8 });
    expect(findings(ok, "structural.openings.overheadHeadroom")).toHaveLength(0);
  });

  it("commands keep openings inside the wall so fitsWall stays quiet", () => {
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "slidingDoor", offsetFt: 40, widthFt: 12 });
    expect(m.openings[0].offsetFt).toBe(12);
    expect(findings(m, "design.openings.fitsWall")).toHaveLength(0);
  });
});
