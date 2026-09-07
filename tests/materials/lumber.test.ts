import { describe, expect, it } from "vitest";
import { LUMBER_ACTUAL_IN, LUMBER_SIZES, actualFt, boardFeet, stockLength } from "@/rules/materials/lumber";

describe("lumber table", () => {
  it("uses real S4S dimensions, never nominal", () => {
    expect(LUMBER_ACTUAL_IN["2x4"]).toEqual({ t: 1.5, d: 3.5 });
    expect(LUMBER_ACTUAL_IN["2x6"]).toEqual({ t: 1.5, d: 5.5 });
    expect(LUMBER_ACTUAL_IN["2x12"]).toEqual({ t: 1.5, d: 11.25 });
    expect(LUMBER_ACTUAL_IN["6x6"]).toEqual({ t: 5.5, d: 5.5 });
    expect(LUMBER_ACTUAL_IN["3ply2x6"]).toEqual({ t: 4.5, d: 5.5 });
    for (const s of LUMBER_SIZES) {
      const a = LUMBER_ACTUAL_IN[s];
      const nominalT = s.startsWith("3ply") ? 6 : Number(s.split("x")[0]);
      expect(a.t).toBeLessThan(nominalT);
      expect(a.d).toBeLessThan(Number(s.split("x")[1]));
    }
  });

  it("converts to feet", () => {
    expect(actualFt("2x6")).toEqual({ t: 0.125, d: 5.5 / 12 });
  });

  it("rounds up to stock lengths and splices beyond the longest", () => {
    expect(stockLength(7.5)).toEqual({ stockFt: 8, pieces: 1 });
    expect(stockLength(8)).toEqual({ stockFt: 8, pieces: 1 });
    expect(stockLength(11.9)).toEqual({ stockFt: 12, pieces: 1 });
    expect(stockLength(17)).toEqual({ stockFt: 20, pieces: 1 });
    expect(stockLength(36)).toEqual({ stockFt: 20, pieces: 2 });
  });

  it("computes board feet from nominal size", () => {
    expect(boardFeet("2x4", 12)).toBe(8);
    expect(boardFeet("6x6", 16)).toBe(48);
  });
});
