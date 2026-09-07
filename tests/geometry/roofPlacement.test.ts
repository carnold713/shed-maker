import { describe, expect, it } from "vitest";
import { createDefaultModel, setRoof } from "@/lib/model";
import { deriveGeometry, type BoxMember, type Vec3 } from "@/lib/geometry";
import { roofParams } from "@/lib/framing";

/** World position of a point given in a box's local frame (Euler XYZ, matching three.js). */
function localToWorld(b: BoxMember, local: Vec3): Vec3 {
  const [rx, ry, rz] = b.rotation;
  let [x, y, z] = local;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  return [x + b.center[0], y + b.center[1], z + b.center[2]];
}

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("roof plane placement", () => {
  it("gable, ridge N–S: panel centreline runs from the ridge down to the eave overhang tip", () => {
    const m = createDefaultModel(); // 24×36, eave 10', 4:12, 12" overhang, ridge ns
    const rp = roofParams(m);
    const g = deriveGeometry(m);
    const west = g.boxes.find((b) => b.id === "roof_w")!;
    const east = g.boxes.find((b) => b.id === "roof_e")!;
    const halfLen = west.size[0] / 2;
    const mid = west.size[1] / 2 / Math.cos(rp.theta); // panel centreline sits half a panel (vertical) above the purlins
    const wRidge = localToWorld(west, [halfLen, 0, 0]);
    const wEave = localToWorld(west, [-halfLen, 0, 0]);
    near(wRidge[0], 12);
    near(wRidge[1], rp.ridgeHeightFt - mid);
    near(wEave[0], -1);
    near(wEave[1], rp.datumAtWall - 4 / 12 + mid); // purlin top drops 4" over the 12" overhang
    const eRidge = localToWorld(east, [-halfLen, 0, 0]);
    const eEave = localToWorld(east, [halfLen, 0, 0]);
    near(eRidge[0], 12);
    near(eRidge[1], rp.ridgeHeightFt - mid);
    near(eEave[0], 25);
    near(eEave[1], rp.datumAtWall - 4 / 12 + mid);
  });

  it("gable, ridge E–W: south/north planes mirror across z", () => {
    const m = setRoof(createDefaultModel(), { ridgeAxis: "ew" });
    const rp = roofParams(m);
    const g = deriveGeometry(m);
    const south = g.boxes.find((b) => b.id === "roof_s")!;
    const north = g.boxes.find((b) => b.id === "roof_n")!;
    const halfLen = south.size[2] / 2;
    const mid = south.size[1] / 2 / Math.cos(rp.theta);
    const sRidge = localToWorld(south, [0, 0, -halfLen]);
    const sEave = localToWorld(south, [0, 0, halfLen]);
    near(sRidge[2], -18);
    near(sRidge[1], rp.ridgeHeightFt - mid);
    near(sEave[2], 1);
    near(sEave[1], rp.datumAtWall - 4 / 12 + mid);
    const nRidge = localToWorld(north, [0, 0, halfLen]);
    const nEave = localToWorld(north, [0, 0, -halfLen]);
    near(nRidge[2], -18);
    near(nEave[2], -37);
    near(nEave[1], rp.datumAtWall - 4 / 12 + mid);
  });

  it("shed roof: high side west, low side east", () => {
    const m = setRoof(createDefaultModel(), { form: "shed", pitch: 3 });
    const rp = roofParams(m);
    const p = deriveGeometry(m).boxes.find((b) => b.id === "roof_mono")!;
    const halfLen = p.size[0] / 2;
    const mid = p.size[1] / 2 / Math.cos(rp.theta);
    const west = localToWorld(p, [-halfLen, 0, 0]);
    const east = localToWorld(p, [halfLen, 0, 0]);
    near(west[0], -1);
    near(east[0], 25);
    near(east[1], rp.datumAtWall - 3 / 12 + mid);
    near(west[1], rp.datumAtWall + 24 * (3 / 12) + 3 / 12 + mid);
  });

  it("purlins and top chords sit under the roofing at the wall line", () => {
    const m = createDefaultModel();
    const rp = roofParams(m);
    const g = deriveGeometry(m);
    const purlins = g.boxes.filter((b) => b.id.startsWith("purlin_0_"));
    expect(purlins.length).toBeGreaterThan(3);
    // The last purlin of plane 0 sits at the ridge; its top face must meet the roofing underside there.
    const ridgePurlin = purlins[purlins.length - 1];
    const thick = ridgePurlin.size[0];
    const depth = ridgePurlin.size[1];
    const across = 12 - (thick / 2) * Math.cos(rp.theta);
    const topAt = rp.datumAtWall + across * (rp.pitch / 12);
    const top = localToWorld(ridgePurlin, [0, depth / 2, 0]);
    near(top[1], topAt - (depth / 2) * Math.sin(rp.theta) * Math.tan(rp.theta));
    // The first purlin of plane 0 hangs at the eave tail, below the wall datum by the overhang drop.
    const eavePurlin = purlins[0];
    const tail = localToWorld(eavePurlin, [0, depth / 2, 0]);
    expect(tail[1]).toBeLessThan(rp.datumAtWall);
    expect(tail[0]).toBeLessThan(0);
  });
});
