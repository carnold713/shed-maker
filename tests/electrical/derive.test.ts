import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel } from "@/lib/model";
import { addZone } from "@/lib/model/zones";
import { applyLayout } from "@/lib/model/layouts";
import { addOpening } from "@/lib/model/commands";
import { addFixture, autoLightAll, autoLightZone, autoPlacePanel, lightsNeededFor, moveFixture, removeFixture, setElectricalService, updateFixture } from "@/lib/model/electrical";
import { deriveElectrical } from "@/lib/electrical/derive";
import { electricalGeometry } from "@/lib/geometry/electrical";
import { runRules } from "@/rules";

const base = () => createDefaultModel({ now: new Date(0) }); // 24×36, ridge N–S, 10' eave

describe("electrical fixtures", () => {
  it("places lights on the ceiling, snaps wall devices to the nearest wall and validates", () => {
    let m = addFixture(base(), { kind: "light", x: 6.2, y: 6.1 });
    expect(m.electrical.fixtures[0]).toMatchObject({ kind: "light", x: 6, y: 6, watts: 40, volts: 120, mountFt: 9 });
    m = addFixture(m, { kind: "outlet", x: 1.4, y: 10.3 }); // near the west wall
    const o = m.electrical.fixtures[1];
    expect(o.wallId).toBe("wall_ext_w");
    expect(o.x).toBe(0);
    expect(o.y).toBe(10.5);
    expect(() => parseBuildingModel(m)).not.toThrow();
    m = moveFixture(m, o.id, 12, 0.5); // onto the south wall
    expect(m.electrical.fixtures[1]).toMatchObject({ wallId: "wall_ext_s", x: 12, y: 0 });
    m = updateFixture(m, o.id, { kind: "switch" });
    expect(m.electrical.fixtures[1].watts).toBe(0);
    m = removeFixture(m, o.id);
    expect(m.electrical.fixtures).toHaveLength(1);
  });

  it("only one panel; autoPlacePanel picks a room wall, else beside the man door", () => {
    let m = addOpening(base(), { wallId: "wall_ext_s", type: "manDoor", centerFt: 6, widthFt: 3, heightFt: 6.67, sillFt: 0, swing: "out" });
    m = autoPlacePanel(m);
    const panel = m.electrical.fixtures.find((f) => f.kind === "panel")!;
    expect(panel).toMatchObject({ wallId: "wall_ext_s", y: 0 });
    expect(panel.x).toBeCloseTo(6 + 1.5 + 2.5, 6);
    expect(autoPlacePanel(m)).toBe(m); // idempotent
    let t = addZone(base(), { type: "tack", rect: { x: 0, y: 0, w: 12, d: 8 } });
    t = autoPlacePanel(t);
    expect(t.electrical.fixtures[0]).toMatchObject({ kind: "panel", wallId: "wall_ext_s" });
  });

  it("lights a stall to 10 fc with one strip, an aisle needs more, and autoLight fills them", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse" });
    const aisle = m.zones.find((z) => z.type === "aisle")!;
    const stall = m.zones.find((z) => z.type === "pen")!;
    expect(lightsNeededFor(m, stall)).toBe(1); // 144 sq ft × 10 fc / 0.5 = 2880 lm < 4400
    expect(lightsNeededFor(m, aisle)).toBe(5); // 14×36 × 20 / 0.5 = 20160 lm / 4400 = 4.6
    m = autoLightZone(m, aisle.id);
    expect(m.electrical.fixtures.filter((f) => f.kind === "light")).toHaveLength(5);
    expect(lightsNeededFor(m, aisle)).toBe(0);
    m = autoLightAll(m);
    expect(m.electrical.fixtures.filter((f) => f.kind === "light")).toHaveLength(5 + 6);
    expect(m.electrical.fixtures.some((f) => f.kind === "panel")).toBe(true);
  });
});

describe("deriveElectrical", () => {
  it("groups lights on 15 A circuits, outlets on 20 A GFCI, heaters on their own 2-pole breaker, and sizes wire", () => {
    let m = autoPlacePanel(base());
    for (let i = 0; i < 4; i++) m = addFixture(m, { kind: "light", x: 12, y: 4 + i * 8 });
    for (let i = 0; i < 3; i++) m = addFixture(m, { kind: "outlet", x: 0, y: 6 + i * 10 });
    m = addFixture(m, { kind: "heater", x: 24, y: 30 });
    const d = deriveElectrical(m);
    expect(d.panel.placed).toBe(true);
    const lighting = d.circuits.filter((c) => c.kind === "lighting");
    expect(lighting).toHaveLength(1);
    expect(lighting[0]).toMatchObject({ breakerAmps: 15, volts: 120, wireAwg: 14, gfci: false, connectedWatts: 160 });
    const rec = d.circuits.find((c) => c.kind === "receptacle")!;
    expect(rec).toMatchObject({ breakerAmps: 20, wireAwg: 12, gfci: true, connectedWatts: 540 });
    const heater = d.circuits.find((c) => c.kind === "dedicated")!;
    expect(heater).toMatchObject({ volts: 240, poles: 2, breakerAmps: 30, wireAwg: 10 });
    expect(heater.designWatts).toBe(6250);
    expect(d.load.breakerSpaces).toBe(4);
    expect(d.load.demandVa).toBe(Math.round(160 * 1.25 + 540 + 5000));
    expect(d.load.utilisationPct).toBe(Math.round(((160 * 1.25 + 540 + 5000) / 240 / 100) * 100));
    expect(d.load.feederAwg).toBe("3 AWG");
    // Routes start at the panel and reach every device.
    for (const c of d.circuits) {
      const r = d.routes.find((x) => x.circuitId === c.id)!;
      expect(r.points[0]).toEqual({ x: d.panel.x, y: d.panel.y });
      expect(r.lengthFt).toBeGreaterThan(0);
      expect(c.wireFt).toBeGreaterThan(c.runFt);
      expect(c.voltageDropPct).toBeLessThanOrEqual(3);
    }
    // Wall runs follow the walls: every receptacle route point is on the perimeter.
    const recRoute = d.routes.find((x) => x.circuitId === rec.id)!;
    for (const p of recRoute.points) expect(p.x === 0 || p.x === 24 || p.y === 0 || p.y === 36).toBe(true);
  });

  it("splits circuits at 80 % of the breaker and upsizes long runs for voltage drop", () => {
    let m = autoPlacePanel(base());
    for (let i = 0; i < 40; i++) m = addFixture(m, { kind: "light", x: 4 + (i % 4) * 5, y: 2 + Math.floor(i / 4) * 3.4 });
    const d = deriveElectrical(m);
    const lighting = d.circuits.filter((c) => c.kind === "lighting");
    expect(lighting.length).toBeGreaterThanOrEqual(2);
    for (const c of lighting) expect(c.designWatts).toBeLessThanOrEqual(1440 + 1e-6);
    let far = setElectricalService(autoPlacePanel(createDefaultModel({ now: new Date(0), wFt: 40, dFt: 200 })), { feederLengthFt: 400 });
    for (let i = 0; i < 20; i++) far = addFixture(far, { kind: "waterer", x: 40, y: 190 - i });
    const dd = deriveElectrical(far);
    expect(dd.circuits.some((c) => c.upsizedForDrop)).toBe(true);
    expect(dd.load.feederDropPct).toBeGreaterThan(3);
    expect(runRules(far).findings.some((f) => f.rule === "mep.electrical.voltageDrop")).toBe(true);
  });

  it("reports zone lighting and produces geometry with fixtures, runs and drops on the electrical layer", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse" });
    m = autoLightAll(m);
    const d = deriveElectrical(m);
    expect(d.zoneLighting.every((z) => z.moreLights === 0)).toBe(true);
    const g = electricalGeometry(m);
    expect(g.filter((b) => b.kind === "fixture")).toHaveLength(m.electrical.fixtures.length);
    expect(g.some((b) => b.kind === "wire" && b.size[1] > 0.5)).toBe(true); // a vertical drop
    expect(g.every((b) => b.layer === "electrical")).toBe(true);
  });
});

describe("electrical rules", () => {
  it("warns without a panel, flags under-lit zones with a fix, devices in pens, and heaters in stalls", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse" });
    m = addFixture(m, { kind: "light", x: 19, y: 18 });
    let r = runRules(m);
    expect(r.findings.find((f) => f.rule === "mep.electrical.panel")?.fix?.command).toBe("autoPlacePanel");
    const lit = r.findings.filter((f) => f.rule === "mep.electrical.lightingLevel");
    expect(lit.length).toBe(m.zones.length); // one light in the aisle isn't enough for anything
    expect(lit[0].fix?.command).toBe("autoLightZone");
    const stall = m.zones.find((z) => z.type === "pen")!;
    m = addFixture(m, { kind: "outlet", x: 6, y: 6 }); // inside a stall, off the walls
    m = addFixture(m, { kind: "heater", x: 6, y: 8 });
    m = addFixture(m, { kind: "light", x: 6, y: 4, mountFt: 6 });
    r = runRules(m);
    expect(r.findings.some((f) => f.rule === "mep.electrical.animalReach" && f.entityIds.includes(stall.id))).toBe(true);
    expect(r.findings.some((f) => f.rule === "mep.electrical.heaterPlacement")).toBe(true);
    expect(r.findings.some((f) => f.rule === "mep.electrical.luminaireProtection" && f.fix?.command === "setFixtureMount")).toBe(true);
    expect(r.findings.some((f) => f.rule === "mep.electrical.equipotential")).toBe(true);
    expect(r.findings.some((f) => f.rule === "mep.electrical.agriculturalWiring")).toBe(true);
  });

  it("flags a service that is too small and offers the next size", () => {
    let m = autoPlacePanel(base());
    m = setElectricalService(m, { amps: 60 });
    for (let i = 0; i < 3; i++) m = addFixture(m, { kind: "heater", x: 24, y: 6 + i * 8 });
    const f = runRules(m).findings.find((x) => x.rule === "mep.electrical.serviceCapacity");
    expect(f?.severity).toBe("warn");
    expect(f?.fix).toMatchObject({ command: "setServiceAmps", args: { amps: 100 } });
  });

  it("asks for a switch beside each man door and offers to add it", () => {
    let m = addOpening(base(), { wallId: "wall_ext_e", type: "manDoor", centerFt: 10, widthFt: 3, heightFt: 6.67, sillFt: 0, swing: "out" });
    m = addFixture(m, { kind: "light", x: 12, y: 18 });
    const f = runRules(m).findings.find((x) => x.rule === "mep.electrical.switchAtEntry")!;
    expect(f.fix?.command).toBe("addFixtureAt");
    const sw = addFixture(m, { kind: "switch", x: Number(f.fix!.args!.x), y: Number(f.fix!.args!.y), wallId: String(f.fix!.args!.wallId) });
    expect(runRules(sw).findings.some((x) => x.rule === "mep.electrical.switchAtEntry")).toBe(false);
  });
});
