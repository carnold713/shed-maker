import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel } from "@/lib/model";
import { addOpening } from "@/lib/model/commands";
import { addFixture } from "@/lib/model/electrical";
import { applyLook, awningsOverDoors, lightsOverDoors, recommendedCupolaIn, ridgeLengthFt, setAwning, setCupola, setTrimStyle, setWainscot } from "@/lib/model/looks";
import { deriveGeometry } from "@/lib/geometry";
import { deriveFraming } from "@/lib/framing";
import { estimateMaterials } from "@/lib/bom/estimate";
import { buildSequence } from "@/lib/bom/sequence";
import { deriveElectrical } from "@/lib/electrical/derive";
import { runRules } from "@/rules";

const base = () => createDefaultModel({ now: new Date(0) });

describe("classic barn looks", () => {
  it("cupola sized to the ridge, with a weathervane, in 3D and the estimate", () => {
    let m = base(); // 24' × 36', ridge N–S -> 36' ridge
    expect(ridgeLengthFt(m)).toBe(36);
    expect(recommendedCupolaIn(36)).toBe(42); // 36 × 1.25 = 45 -> 42 stock
    expect(recommendedCupolaIn(24)).toBe(30);
    m = setCupola(m, { enabled: true, sizeIn: 36, count: 2 });
    expect(m.roof.vents.cupola).toBe(true);
    const g = deriveGeometry(m);
    const cup = g.boxes.filter((b) => b.kind === "cupola");
    expect(cup.filter((b) => b.id.endsWith("_body"))).toHaveLength(2);
    expect(cup.some((b) => b.id.includes("vane_arrow"))).toBe(true);
    // Sits on the ridge: the body centre is above the ridge height.
    const body = cup.find((b) => b.id === "cupola_0_body")!;
    expect(body.center[1]).toBeGreaterThan(g.ridgeHeightFt);
    expect(body.layer).toBe("roofing");
    const est = estimateMaterials(m, deriveFraming(m), g);
    expect(est.lines.find((l) => l.sku === "cupola.36")?.quantity).toBe(2);
    expect(est.lines.find((l) => l.sku === "weathervane")?.quantity).toBe(2);
    expect(buildSequence(m, deriveFraming(m)).some((s) => s.title === "Cupola and weathervane")).toBe(true);
    // The size rule nudges an undersized cupola.
    const small = setCupola(m, { sizeIn: 24 });
    expect(runRules(small).findings.find((f) => f.rule === "design.roof.cupolaSize")?.fix?.args).toEqual({ sizeIn: 42 });
    expect(runRules(setCupola(m, { sizeIn: 42 })).findings.some((f) => f.rule === "design.roof.cupolaSize")).toBe(false);
    expect(() => parseBuildingModel(m)).not.toThrow();
  });

  it("awnings over the doors: brackets, rafters and a roof in 3D; the estimate counts them", () => {
    let m = addOpening(base(), { wallId: "wall_ext_s", type: "slidingDoor", widthFt: 10, heightFt: 10, id: "big" });
    m = addOpening(m, { wallId: "wall_ext_e", type: "manDoor", id: "man" });
    m = addOpening(m, { wallId: "wall_ext_n", type: "window", id: "win" });
    m = awningsOverDoors(m);
    expect(m.openings.find((o) => o.id === "big")!.awning).toEqual({ kind: "shed", depthFt: 4, brackets: "timber" });
    expect(m.openings.find((o) => o.id === "man")!.awning?.depthFt).toBe(3);
    expect(m.openings.find((o) => o.id === "win")!.awning).toBeUndefined();
    m = setAwning(m, "man", { brackets: "steel", depthFt: 2.5 });
    expect(m.openings.find((o) => o.id === "man")!.awning).toEqual({ kind: "shed", depthFt: 2.5, brackets: "steel" });
    const g = deriveGeometry(m);
    const awn = g.boxes.filter((b) => b.kind === "awning" && b.entityId === "big");
    expect(awn.some((b) => b.id.endsWith("_awn_roof"))).toBe(true);
    expect(awn.filter((b) => b.id.includes("_awn_strut_"))).toHaveLength(2);
    // The roof plane sits outside the south wall (plan y < 0 -> world z > 0) and above the door head.
    const roof = awn.find((b) => b.id.endsWith("_awn_roof"))!;
    expect(roof.center[2]).toBeGreaterThan(0);
    expect(roof.center[1]).toBeGreaterThan(10);
    const est = estimateMaterials(m, deriveFraming(m), g);
    expect(est.lines.find((l) => l.sku === "awning.bracket.timber")?.quantity).toBe(2);
    expect(est.lines.find((l) => l.sku === "awning.bracket.steel")?.quantity).toBe(2);
    expect(est.lines.find((l) => l.sku === "awning.lf")?.quantity).toBe(12 + 5);
    m = setAwning(m, "man", null);
    expect(m.openings.find((o) => o.id === "man")!.awning).toBeUndefined();
  });

  it("trim styles and wainscot draw boards and a band; door lights land over the doors", () => {
    let m = addOpening(base(), { wallId: "wall_ext_s", type: "slidingDoor", widthFt: 10, heightFt: 10, id: "big" });
    m = addOpening(m, { wallId: "wall_ext_e", type: "manDoor", id: "man" });
    m = addOpening(m, { wallId: "wall_ext_n", type: "window", id: "win" });
    expect(deriveGeometry(m).boxes.some((b) => b.kind === "trimBoard")).toBe(false);
    m = setTrimStyle(m, "craftsman");
    const g1 = deriveGeometry(m);
    expect(g1.boxes.filter((b) => b.kind === "trimBoard" && b.entityId === "win").map((b) => b.id.split("_trim_")[1]).sort()).toEqual(["apron", "cap", "h", "l", "r", "sill"]);
    m = setWainscot(m, { enabled: true, kind: "stone", heightFt: 3 });
    const g2 = deriveGeometry(m);
    const band = g2.boxes.filter((b) => b.kind === "wainscot" && b.material === "stone");
    expect(band.length).toBeGreaterThanOrEqual(6); // four walls, the south and east ones split at their doors
    const est = estimateMaterials(m, deriveFraming(m), g2);
    expect(est.lines.find((l) => l.sku === "wainscot.stone.sqft")!.quantity).toBeGreaterThan(300);
    expect(est.lines.some((l) => l.sku === "trim.1x6.lf")).toBe(true);
    // Lights: a gooseneck centred over the big door, a lantern beside the man door; the rule is satisfied after.
    m = addFixture(m, { kind: "light", x: 12, y: 18 }); // some electrical so the door-light rule applies
    expect(runRules(m).findings.some((f) => f.rule === "design.lighting.doorLights")).toBe(true);
    m = lightsOverDoors(m);
    const goose = m.electrical.fixtures.filter((f) => f.kind === "gooseneck");
    const lanterns = m.electrical.fixtures.filter((f) => f.kind === "lantern");
    expect(goose).toHaveLength(1);
    expect(goose[0]).toMatchObject({ wallId: "wall_ext_s", x: 7 + 5 });
    expect(goose[0].mountFt).toBeLessThanOrEqual(m.eaveHeightFt - 0.5);
    expect(lanterns).toHaveLength(1);
    expect(lanterns[0].mountFt).toBe(6.5);
    expect(lightsOverDoors(m).electrical.fixtures).toHaveLength(m.electrical.fixtures.length); // idempotent
    expect(runRules(m).findings.some((f) => f.rule === "design.lighting.doorLights")).toBe(false);
    const d = deriveElectrical(m);
    expect(d.circuits.find((c) => c.kind === "lighting")!.fixtureIds).toContain(goose[0].id);
    expect(deriveGeometry(m).boxes.some((b) => b.entityId === goose[0].id && b.kind === "fixture")).toBe(true);
  });

  it("one click: the classic look and back to plain", () => {
    let m = addOpening(base(), { wallId: "wall_ext_s", type: "slidingDoor", widthFt: 10, heightFt: 10, id: "big" });
    m = applyLook(m, "classic");
    expect(m.roof.cupola).toMatchObject({ enabled: true, sizeIn: 42, weathervane: true });
    expect(m.materials.trimStyle).toBe("craftsman");
    expect(m.materials.wainscot).toMatchObject({ enabled: true, kind: "stone" });
    expect(m.openings[0].awning).toBeDefined();
    expect(m.electrical.fixtures.some((f) => f.kind === "gooseneck")).toBe(true);
    expect(m.roof.covering).toBe("standingSeam");
    expect(() => parseBuildingModel(m)).not.toThrow();
    m = applyLook(m, "plain");
    expect(m.roof.cupola.enabled).toBe(false);
    expect(m.materials.trimStyle).toBe("none");
    expect(m.openings[0].awning).toBeUndefined();
  });
});
