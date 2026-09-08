import { describe, expect, it } from "vitest";
import { createDefaultModel } from "@/lib/model";
import { applyLayout } from "@/lib/model/layouts";
import { addLeanTo } from "@/lib/model/leanTos";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";
import { cutList, pickStock, rafterCuts, staggerRun } from "@/lib/bom/cutlist";
import { hardwareSchedule } from "@/lib/bom/hardware";
import { buildSequence } from "@/lib/bom/sequence";
import { needsKneeBraces } from "@/lib/framing/postFrame";

const base = () => createDefaultModel({ now: new Date(0) }); // 24×36, 10' eave, 8' bays

describe("cut list", () => {
  it("staggers girts two bays per stick with odd rows starting on one bay; purlins lap 12\" past the truss", () => {
    expect(staggerRun(36, 8, 0)).toEqual([16, 20]);
    expect(staggerRun(36, 8, 1)).toEqual([8, 16, 12]);
    expect(staggerRun(40, 8, 0)).toEqual([16, 16, 8]);
    expect(staggerRun(12, 8, 0)).toEqual([12]);
    const purlins = staggerRun(36, 4, 0, 1);
    expect(purlins[0]).toBe(13); // 3 spaces + 12" lap from a 14' stick
    expect(purlins.reduce((a, b) => a + b, 0)).toBeGreaterThan(36);
  });

  it("pairs pieces on a stick and nests 45° brace cuts", () => {
    expect(pickStock(3.875, "girt")).toEqual({ stockFt: 8, piecesPerStick: 2 });
    expect(pickStock(5.16, "kneeBrace", 7.75 / 12)).toMatchObject({ stockFt: 10, piecesPerStick: 2 });
    expect(pickStock(13.5, "post")).toEqual({ stockFt: 14, piecesPerStick: 1 });
  });

  it("birdsmouth for a 2×6 at 3:12 on a 3\" header: ¾\" heel, HAP ≈ 4 15/16\", within the ¼-depth limit", () => {
    const c = rafterCuts(3, 3);
    expect(c.heelIn).toBeCloseTo(0.75, 2);
    expect(c.hapIn).toBeCloseTo(4.92, 1);
    expect(c.ok).toBe(true);
    expect(rafterCuts(4, 3).depthPerpIn).toBeCloseTo(0.949, 2);
  });

  it("lists posts with the carrier notch, knee braces at 45°, lean-to rafters with a birdsmouth, and a truss order line", () => {
    let m = base();
    expect(needsKneeBraces(m)).toBe(true); // 10' eave
    m = addLeanTo(m, { side: "w", depthFt: 10, id: "lt_w" });
    const framing = deriveFraming(m);
    const cl = cutList(m, framing);
    const posts = cl.lines.filter((l) => l.kind === "post" && l.label === "Post");
    expect(posts.some((l) => l.ends === "S / S + N")).toBe(true);
    expect(cl.notes.some((n) => n.note.includes("notch on the inside face"))).toBe(true);
    const brace = cl.lines.find((l) => l.kind === "kneeBrace")!;
    expect(brace.ends).toBe("45 / 45");
    expect(brace.cutLengthFt).toBeCloseTo(3 * Math.SQRT2 + 11 / 12, 2);
    expect(brace.piecesPerStick).toBe(2);
    expect(brace.count).toBe(framing.members.filter((x) => x.kind === "kneeBrace").length);
    const rafter = cl.lines.find((l) => l.label.startsWith("Lean-to Rafter"))!;
    expect(rafter.ends).toBe("P / B");
    expect(cl.notes.find((n) => n.kind === "Lean-to Rafter")?.note).toContain("birdsmouth on the header");
    expect(cl.orders[0].count).toBe(framing.trussSpec!.count);
    expect(cl.lines.every((l) => l.kind !== "trussBottomChord" && l.kind !== "trussWeb")).toBe(true);
    // Girts are cut into stock-length pieces, never a 36' member.
    expect(Math.max(...cl.lines.filter((l) => l.kind === "girt").map((l) => l.cutLengthFt))).toBeLessThanOrEqual(20);
    expect(cl.wastePct).toBeGreaterThanOrEqual(0);
    expect(cl.wastePct).toBeLessThan(25);
    expect(cl.stock.reduce((a, s) => a + s.count, 0)).toBeGreaterThan(20);
  });
});

describe("hardware schedule and build sequence", () => {
  it("counts per the Builder's table: cleats, carrier bolts, ties, spacer blocks, panel screws, stall hardware", () => {
    const m = applyLayout(base(), "centerAisle", { species: "horse" });
    const framing = deriveFraming(m);
    const hw = hardwareSchedule(m, framing, deriveGeometry(m));
    const posts = framing.posts.length;
    const bearing = framing.posts.filter((p) => p.role !== "endwall").length;
    const trusses = framing.trussSpec!.count;
    expect(hw.find((h) => h.sku === "hw.upliftBlock")?.quantity).toBe(posts * 2);
    expect(hw.find((h) => h.sku === "hw.carriageBolt" && h.group === "Carriers & girts")?.quantity).toBe(bearing * 2);
    expect(hw.find((h) => h.sku === "hw.hurricaneTie" && h.group === "Trusses & purlins")?.quantity).toBe(trusses * 2);
    expect(hw.find((h) => h.sku === "hw.spacerBlock")?.quantity).toBe((trusses - 1) * 2);
    expect(hw.find((h) => h.sku === "hw.braceBlock")?.quantity).toBe(framing.members.filter((x) => x.kind === "kneeBrace").length);
    expect(hw.find((h) => h.sku === "hw.panelScrew" && h.description.startsWith("#10 × 1\" panel"))!.quantity).toBeGreaterThan(1000);
    expect(hw.find((h) => h.sku === "hw.mat")?.quantity).toBe(6 * 6);
    expect(hw.find((h) => h.sku === "hw.stallHanger")?.quantity).toBe(12); // 6 sliding stall doors × 2
    expect(hw.every((h) => h.note.length > 0)).toBe(true);
  });

  it("build sequence is ordered and parametrised by the model", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse" });
    const framing = deriveFraming(m);
    const steps = buildSequence(m, framing);
    expect(steps.map((s) => s.n)).toEqual(steps.map((_, i) => i + 1));
    expect(steps[0].title).toBe("Site prep");
    expect(steps.find((s) => s.title === "Dig the holes")?.what).toContain(`${framing.posts.length} holes`);
    expect(steps.find((s) => s.title === "Batter boards and lines")?.check).toContain("52'"); // 38×36 -> 52' 4"
    expect(steps.some((s) => s.title === "Stalls and rooms")).toBe(true);
    expect(steps.some((s) => s.title === "Electrical rough-in")).toBe(false);
    m = { ...m, electrical: { ...m.electrical, fixtures: [{ id: "f", kind: "light", x: 5, y: 5, mountFt: 9, watts: 40, volts: 120, rotationDeg: 0 }] } };
    expect(buildSequence(m, framing).some((s) => s.title === "Electrical rough-in")).toBe(true);
  });
});
