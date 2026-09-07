import type { OpeningType } from "./schema";

/**
 * Opening catalog defaults (SPEC §4.6–4.7, Appendix B). Sizes are unit
 * sizes in feet; rough openings are derived by framing rules.
 */
export interface OpeningPreset {
  type: OpeningType;
  label: string;
  widthFt: number;
  heightFt: number;
  sillFt: number;
  swing: "in" | "out" | "slideLeft" | "slideRight" | "biParting" | "none";
  /** Common alternative sizes [w, h] offered in menus. */
  sizes: [number, number][];
  exteriorOnly?: boolean;
}

const ft = (f: number, i = 0) => f + i / 12;

export const OPENING_PRESETS: Record<OpeningType, OpeningPreset> = {
  manDoor: {
    type: "manDoor",
    label: "Man door",
    widthFt: 3,
    heightFt: ft(6, 8),
    sillFt: 0,
    swing: "out",
    sizes: [
      [ft(2, 8), ft(6, 8)],
      [ft(2, 10), ft(6, 8)],
      [3, ft(6, 8)],
      [3, 7],
    ],
  },
  doubleDoor: {
    type: "doubleDoor",
    label: "Double door",
    widthFt: 6,
    heightFt: ft(6, 8),
    sillFt: 0,
    swing: "out",
    sizes: [
      [5, ft(6, 8)],
      [6, ft(6, 8)],
      [6, 7],
      [8, 7],
    ],
  },
  dutchDoor: {
    type: "dutchDoor",
    label: "Dutch door",
    widthFt: 4,
    heightFt: 8,
    sillFt: 0,
    swing: "out",
    sizes: [
      [4, 7],
      [4, 8],
    ],
  },
  slidingDoor: {
    type: "slidingDoor",
    label: "Sliding barn door",
    widthFt: 8,
    heightFt: 8,
    sillFt: 0,
    swing: "slideRight",
    sizes: [
      [6, 7],
      [8, 8],
      [10, 8],
      [10, 10],
      [12, 10],
      [12, 12],
      [16, 12],
    ],
  },
  overheadDoor: {
    type: "overheadDoor",
    label: "Overhead door",
    widthFt: 10,
    heightFt: 10,
    sillFt: 0,
    swing: "none",
    sizes: [
      [8, 7],
      [9, 8],
      [10, 8],
      [10, 10],
      [12, 10],
      [12, 12],
      [14, 12],
      [16, 8],
      [16, 12],
    ],
  },
  stallDoor: {
    type: "stallDoor",
    label: "Stall door",
    widthFt: 4,
    heightFt: 8,
    sillFt: 0,
    swing: "slideRight",
    sizes: [
      [4, 7],
      [4, 8],
    ],
  },
  interiorDoor: {
    type: "interiorDoor",
    label: "Interior door",
    widthFt: 3,
    heightFt: ft(6, 8),
    sillFt: 0,
    swing: "in",
    sizes: [
      [ft(2, 8), ft(6, 8)],
      [3, ft(6, 8)],
    ],
  },
  window: {
    type: "window",
    label: "Window",
    widthFt: 3,
    heightFt: 4,
    sillFt: 4,
    swing: "none",
    sizes: [
      [2, 3],
      [3, 3],
      [3, 4],
      [4, 4],
      [4, 6],
      [6, 4],
    ],
  },
};

export const DOOR_TYPES: OpeningType[] = ["manDoor", "doubleDoor", "dutchDoor", "slidingDoor", "overheadDoor"];

export function isDoor(type: OpeningType): boolean {
  return type !== "window";
}

/** Headroom needed above an overhead door for the track and springs, feet (Industry: 12" standard lift). */
export const OVERHEAD_DOOR_HEADROOM_FT = 1;

/** Sliding door leaf overlaps the opening by this much on each side, feet (SPEC §4.6: 4–6"). */
export const SLIDING_LEAF_OVERLAP_FT = 0.5;
/** Sliding door leaf hangs this far off the wall face, feet (SPEC §19.3: ~3"). */
export const SLIDING_LEAF_STANDOFF_FT = 0.25;
