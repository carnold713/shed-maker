import { describe, expect, it } from "vitest";
import { formatFtIn, parseFtIn } from "@/lib/units";

describe("units", () => {
  it("formats feet-inches to 1/16", () => {
    expect(formatFtIn(24)).toBe(`24'`);
    expect(formatFtIn(24.5)).toBe(`24' 6"`);
    expect(formatFtIn(0.5)).toBe(`6"`);
    expect(formatFtIn(10 + 3.5 / 12)).toBe(`10' 3 1/2"`);
    expect(formatFtIn(1 / 12 / 16)).toBe(`0 1/16"`);
    expect(formatFtIn(11.99999)).toBe(`12'`);
    expect(formatFtIn(0)).toBe(`0'`);
  });

  it("parses common feet-inches inputs", () => {
    expect(parseFtIn("24")).toBe(24);
    expect(parseFtIn("24'")).toBe(24);
    expect(parseFtIn("24.5")).toBe(24.5);
    expect(parseFtIn(`24' 6"`)).toBe(24.5);
    expect(parseFtIn("24-6")).toBe(24.5);
    expect(parseFtIn(`10' 3 1/2"`)).toBeCloseTo(10 + 3.5 / 12, 10);
    expect(parseFtIn("abc")).toBeNull();
    expect(parseFtIn("")).toBeNull();
  });
});
