/**
 * Dimensional lumber: nominal names, ACTUAL dimensions, stock lengths,
 * treatment classes. SPEC §19.1. Geometry uses actual dimensions; BOM lines
 * use nominal names and stock lengths.
 *
 * Source: Industry (American Softwood Lumber Standard PS 20, S4S dry sizes).
 */
export const LUMBER_SIZES = [
  "1x4", "1x6", "1x8",
  "2x4", "2x6", "2x8", "2x10", "2x12",
  "4x4", "4x6", "6x6", "6x8",
  "3ply2x6", "3ply2x8",
] as const;
export type LumberSize = (typeof LUMBER_SIZES)[number];

/** Actual cross-section in inches: `t` is the thin dimension, `d` the deep one. */
export const LUMBER_ACTUAL_IN: Record<LumberSize, { t: number; d: number }> = {
  "1x4": { t: 0.75, d: 3.5 },
  "1x6": { t: 0.75, d: 5.5 },
  "1x8": { t: 0.75, d: 7.25 },
  "2x4": { t: 1.5, d: 3.5 },
  "2x6": { t: 1.5, d: 5.5 },
  "2x8": { t: 1.5, d: 7.25 },
  "2x10": { t: 1.5, d: 9.25 },
  "2x12": { t: 1.5, d: 11.25 },
  "4x4": { t: 3.5, d: 3.5 },
  "4x6": { t: 3.5, d: 5.5 },
  "6x6": { t: 5.5, d: 5.5 },
  "6x8": { t: 5.5, d: 7.25 },
  "3ply2x6": { t: 4.5, d: 5.5 },
  "3ply2x8": { t: 4.5, d: 7.25 },
};

/** Same, in feet (model units). */
export function actualFt(size: LumberSize): { t: number; d: number } {
  const a = LUMBER_ACTUAL_IN[size];
  return { t: a.t / 12, d: a.d / 12 };
}

/** Common stock lengths, feet. Posts come longer. */
export const STOCK_LENGTHS_FT = [8, 10, 12, 14, 16, 20] as const;
export const POST_STOCK_LENGTHS_FT = [8, 10, 12, 14, 16, 18, 20] as const;

/** Smallest stock length that covers `lengthFt`; longer pieces get the longest stock and a splice count. */
export function stockLength(lengthFt: number, stocks: readonly number[] = STOCK_LENGTHS_FT): { stockFt: number; pieces: number } {
  const max = stocks[stocks.length - 1];
  if (lengthFt <= max + 1e-9) {
    const s = stocks.find((s) => s + 1e-9 >= lengthFt) ?? max;
    return { stockFt: s, pieces: 1 };
  }
  return { stockFt: max, pieces: Math.ceil(lengthFt / max) };
}

export type Treatment = "none" | "UC3B" | "UC4B";

/** Human-readable label for a treatment class. */
export const TREATMENT_LABEL: Record<Treatment, string> = {
  none: "untreated",
  UC3B: "PT above-ground (UC3B)",
  UC4B: "PT ground-contact (UC4B)",
};

export type LumberSpecies = "SPF" | "SYP" | "DF";

/** Board feet for a nominal size and length (nominal thickness × nominal width × length / 12). */
export function boardFeet(size: LumberSize, lengthFt: number): number {
  const nominal: Record<LumberSize, [number, number]> = {
    "1x4": [1, 4], "1x6": [1, 6], "1x8": [1, 8],
    "2x4": [2, 4], "2x6": [2, 6], "2x8": [2, 8], "2x10": [2, 10], "2x12": [2, 12],
    "4x4": [4, 4], "4x6": [4, 6], "6x6": [6, 6], "6x8": [6, 8],
    "3ply2x6": [6, 6], "3ply2x8": [6, 8],
  };
  const [t, w] = nominal[size];
  return (t * w * lengthFt) / 12;
}
