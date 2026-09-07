import { describe, expect, it } from "vitest";
import { addOpening, createDefaultModel, setFootprintRect, setFrame, setFrameSystem } from "@/lib/model";
import { deriveFraming, postLinesForWall } from "@/lib/framing";
import { LUMBER_ACTUAL_IN } from "@/rules/materials/lumber";

const base = () => createDefaultModel({ now: new Date(0) });
const wall = (m: ReturnType<typeof base>, id: string) => m.walls.find((w) => w.id === id)!;

describe("post-frame generator", () => {
  it("lays posts on the bay module along bearing walls with corners at both ends", () => {
    const m = base(); // 24×36, ridge N–S => E/W walls bear, 36' long, 8' bays
    const lines = postLinesForWall(m, wall(m, "wall_ext_e"));
    const inset = (1.5 + 5.5 / 2) / 12; // girt + half post
    expect(lines[0]).toMatchObject({ role: "corner" });
    expect(lines[0].u).toBeCloseTo(inset, 9);
    expect(lines.at(-1)!.u).toBeCloseTo(36 - inset, 9);
    expect(lines.filter((l) => l.role === "bay").map((l) => l.u)).toEqual([8, 16, 24, 32]);
  });

  it("end walls never exceed 8' post spacing even on 12' bays", () => {
    const m = setFrame(base(), { bayFt: 12 });
    const side = postLinesForWall(m, wall(m, "wall_ext_e")).filter((l) => l.role === "bay").map((l) => l.u);
    expect(side).toEqual([12, 24]);
    const end = postLinesForWall(m, wall(m, "wall_ext_s")).filter((l) => l.role === "endwall").map((l) => l.u);
    expect(end).toEqual([8, 16]);
  });

  it("drops the post inside a wide opening and adds jamb posts", () => {
    const m = addOpening(base(), { wallId: "wall_ext_e", type: "overheadDoor", offsetFt: 12, widthFt: 10, heightFt: 8 });
    const lines = postLinesForWall(m, wall(m, "wall_ext_e"));
    expect(lines.some((l) => l.role === "bay" && l.u === 16)).toBe(false);
    const jambs = lines.filter((l) => l.role === "jamb").map((l) => l.u);
    expect(jambs[0]).toBeCloseTo(12 - 5.5 / 24, 9);
    expect(jambs[1]).toBeCloseTo(22 + 5.5 / 24, 9);
  });

  it("generates members with actual dimensions and rule references", () => {
    const fs = deriveFraming(base());
    const posts = fs.members.filter((m) => m.kind === "post");
    // E and W walls: 2 corner (one per wall start) + 4 bay each = 12; S and N end walls: 2 endwall each = 4.
    expect(posts).toHaveLength(12 + 4 + 2 * 0);
    for (const p of posts) {
      expect(p.size[0]).toBeCloseTo(5.5 / 12, 9);
      expect(p.size[2]).toBeCloseTo(5.5 / 12, 9);
      expect(p.size[1]).toBeCloseTo(10 + 4, 9); // eave + 48" embedment
      expect(p.treatment).toBe("UC4B");
      expect(p.ruleRef).toMatch(/^framing\.postFrame\./);
    }
    const girts = fs.members.filter((m) => m.kind === "girt");
    for (const g of girts) {
      expect(g.size[1]).toBeCloseTo(LUMBER_ACTUAL_IN["2x6"].d / 12, 9);
      expect(g.size[2]).toBeCloseTo(1.5 / 12, 9);
    }
    const carriers = fs.members.filter((m) => m.kind === "carrier");
    expect(carriers).toHaveLength(4); // 2 plies × 2 bearing walls
    expect(carriers[0].size[1]).toBeCloseTo(11.25 / 12, 9);
    expect(fs.posts).toHaveLength(posts.length);
    expect(fs.posts[0].concreteCuFt).toBeGreaterThan(0);
  });

  it("girts run at ≤ 24\" OC with an eave girt whose top is at the eave", () => {
    const fs = deriveFraming(base());
    const rows = [...new Set(fs.members.filter((m) => m.kind === "girt" && m.entityId === "wall_ext_s").map((m) => +(m.center[1] + m.size[1] / 2).toFixed(4)))].sort((a, b) => a - b);
    expect(rows.at(-1)).toBeCloseTo(10, 4);
    for (let i = 1; i < rows.length; i++) expect(rows[i] - rows[i - 1]).toBeLessThanOrEqual(2 + 1e-6);
  });

  it("girts are interrupted at openings", () => {
    const m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", offsetFt: 2.5 });
    const fs = deriveFraming(m);
    const lowGirts = fs.members.filter((x) => x.kind === "girt" && x.entityId === "wall_ext_s" && x.center[1] < 6);
    // Each low row is split in two around the door.
    const rows = new Set(lowGirts.map((g) => g.center[1].toFixed(3)));
    expect(lowGirts.length).toBe(rows.size * 2);
    expect(fs.members.some((x) => x.kind === "header" && x.entityId === "wall_ext_s")).toBe(true);
  });

  it("truss spec matches the model and counts every truss", () => {
    const fs = deriveFraming(base());
    expect(fs.trussSpec).toMatchObject({ spanFt: 24, pitch: 4, heelIn: 6, spacingIn: 48, count: 10, bearingWalls: ["wall_ext_w", "wall_ext_e"] });
    expect(fs.members.filter((m) => m.kind === "trussBottomChord")).toHaveLength(10);
    expect(fs.members.filter((m) => m.kind === "trussTopChord")).toHaveLength(20);
    expect(fs.members.filter((m) => m.kind === "purlin").length).toBeGreaterThan(10);
  });

  it("footprint changes regenerate the layout", () => {
    const fs = deriveFraming(setFootprintRect(base(), 30, 40));
    expect(fs.trussSpec?.spanFt).toBe(30);
    expect(fs.trussSpec?.count).toBe(11);
  });

  it("stick-frame shell generates plates, studs, and opening framing", () => {
    const m = addOpening(setFrameSystem(base(), "stickFrame"), { wallId: "wall_ext_s", type: "window", offsetFt: 8 });
    const fs = deriveFraming(m);
    expect(fs.members.filter((x) => x.kind === "plate" && x.entityId === "wall_ext_s").length).toBeGreaterThanOrEqual(4); // 3 plates + sill
    const studs = fs.members.filter((x) => x.kind === "stud" && x.entityId === "wall_ext_s");
    expect(studs.length).toBeGreaterThan(10);
    expect(studs.some((s) => s.note === "king stud")).toBe(true);
    expect(studs.some((s) => s.note === "jack stud")).toBe(true);
    expect(fs.members.filter((x) => x.kind === "header")).toHaveLength(2);
    expect(fs.posts).toHaveLength(0);
  });
});
