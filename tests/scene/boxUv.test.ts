import { describe, expect, it } from "vitest";
import { cornerUv, faceAxes } from "@/components/scene/boxUv";

describe("box texture orientation", () => {
  it("wood grain runs along the member's long axis on every side face", () => {
    const post: [number, number, number] = [0.5, 10, 0.5]; // 6×6 post, 10' tall
    expect(faceAxes(post, 0, "grain")).toEqual({ u: 2, v: 1 });
    expect(faceAxes(post, 2, "grain")).toEqual({ u: 0, v: 1 });
    expect(faceAxes(post, 1, "grain").v).not.toBe(1); // end grain: v along something else
    const girt: [number, number, number] = [16, 0.46, 0.125]; // 2×6 laid flat along x
    expect(faceAxes(girt, 2, "grain")).toEqual({ u: 1, v: 0 });
    expect(faceAxes(girt, 1, "grain")).toEqual({ u: 2, v: 0 });
  });

  it("steel ribs are vertical on wall skins and run down the slope on roof planes", () => {
    const skin: [number, number, number] = [24, 10, 0.06];
    expect(faceAxes(skin, 2, "ribsVertical")).toEqual({ u: 0, v: 1 });
    // Roof plane with the ridge N–S: size [slope 12.6, thick, along 37]; ribs down the slope (x).
    const roofNS: [number, number, number] = [12.6, 0.1, 37];
    expect(faceAxes(roofNS, 1, "ribsSlope")).toEqual({ u: 2, v: 0 });
    const roofEW: [number, number, number] = [37, 0.1, 12.6];
    expect(faceAxes(roofEW, 1, "ribsSlope")).toEqual({ u: 0, v: 2 });
  });

  it("corner coordinates are in feet from the face's corner", () => {
    const size: [number, number, number] = [8, 4, 0.5];
    expect(cornerUv([-4, -2, 0.25], size, 2, "ribsVertical")).toEqual([0, 0]);
    expect(cornerUv([4, 2, 0.25], size, 2, "ribsVertical")).toEqual([8, 4]);
  });
});
