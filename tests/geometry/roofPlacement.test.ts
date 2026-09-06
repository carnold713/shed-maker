import { describe, expect, it } from "vitest";
import { createDefaultModel, setRoof } from "@/lib/model";
import { deriveGeometry, type BoxMember, type Vec3 } from "@/lib/geometry";

/** World position of a point given in a box's local frame (Euler XYZ, matching three.js). */
function localToWorld(b: BoxMember, local: Vec3): Vec3 {
  const [rx, ry, rz] = b.rotation;
  let [x, y, z] = local;
  // Rx
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  // Ry
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  // Rz
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  return [x + b.center[0], y + b.center[1], z + b.center[2]];
}

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("roof plane placement", () => {
  it("gable, ridge N–S: plane edges meet at the ridge and drop to the eave overhang", () => {
    const m = createDefaultModel(); // 24×36, eave 10', 4:12, 12" overhang, ridge ns
    const g = deriveGeometry(m);
    const west = g.boxes.find((b) => b.id === "roof_w")!;
    const east = g.boxes.find((b) => b.id === "roof_e")!;
    // The box centreline is the design line of the roof plane (thickness is symmetric about it).
    const halfLen = west.size[0] / 2;
    const wRidge = localToWorld(west, [halfLen, 0, 0]);
    const wEave = localToWorld(west, [-halfLen, 0, 0]);
    near(wRidge[0], 12);
    near(wRidge[1], 14); // 10 + 12 × 4/12
    near(wEave[0], -1); // 12" overhang past x=0
    near(wEave[1], 10 - 4 / 12); // eave drops 4" over the 12" overhang
    const eRidge = localToWorld(east, [-halfLen, 0, 0]);
    const eEave = localToWorld(east, [halfLen, 0, 0]);
    near(eRidge[0], 12);
    near(eRidge[1], 14);
    near(eEave[0], 25);
    near(eEave[1], 10 - 4 / 12);
  });

  it("gable, ridge E–W: south/north planes mirror across z", () => {
    const g = deriveGeometry(setRoof(createDefaultModel(), { ridgeAxis: "ew" }));
    const south = g.boxes.find((b) => b.id === "roof_s")!;
    const north = g.boxes.find((b) => b.id === "roof_n")!;
    const halfLen = south.size[2] / 2;
    const ridgeZ = -18;
    const sRidge = localToWorld(south, [0, 0, -halfLen]);
    const sEave = localToWorld(south, [0, 0, halfLen]);
    near(sRidge[2], ridgeZ);
    near(sRidge[1], 10 + 18 * (4 / 12));
    near(sEave[2], 1); // 12" past the south wall (z = 0)
    near(sEave[1], 10 - 4 / 12);
    const nRidge = localToWorld(north, [0, 0, halfLen]);
    const nEave = localToWorld(north, [0, 0, -halfLen]);
    near(nRidge[2], ridgeZ);
    near(nEave[2], -37);
    near(nEave[1], 10 - 4 / 12);
  });

  it("shed roof: high side west, low side east at the eave height", () => {
    const g = deriveGeometry(setRoof(createDefaultModel(), { form: "shed", pitch: 3 }));
    const p = g.boxes.find((b) => b.id === "roof_mono")!;
    const halfLen = p.size[0] / 2;
    const west = localToWorld(p, [-halfLen, 0, 0]);
    const east = localToWorld(p, [halfLen, 0, 0]);
    near(west[0], -1);
    near(east[0], 25);
    near(east[1], 10 - 3 / 12);
    near(west[1], 10 + 24 * (3 / 12) + 3 / 12);
  });
});
