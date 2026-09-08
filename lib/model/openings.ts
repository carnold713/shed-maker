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
    label: "Entry door",
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
    label: "Sliding door",
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
  rollUpDoor: {
    type: "rollUpDoor",
    label: "Roll-up door",
    widthFt: 10,
    heightFt: 10,
    sillFt: 0,
    swing: "none",
    sizes: [
      [8, 8],
      [10, 10],
      [12, 12],
      [14, 14],
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

export const DOOR_TYPES: OpeningType[] = ["manDoor", "doubleDoor", "dutchDoor", "slidingDoor", "overheadDoor", "rollUpDoor"];

/** Palette entries for the exterior tools (SPEC §4.6–4.7 "a bunch of options"). */
export interface PaletteEntry {
  key: string;
  label: string;
  type: OpeningType;
  widthFt: number;
  heightFt: number;
  sillFt?: number;
  swing?: OpeningPreset["swing"];
  variant?: string;
}

const f = (a: number, b = 0) => a + b / 12;

export const DOOR_PALETTE: PaletteEntry[] = [
  { key: "man36", label: "Entry door 3'", type: "manDoor", widthFt: 3, heightFt: f(6, 8) },
  { key: "man32", label: "Entry door 2'8\"", type: "manDoor", widthFt: f(2, 8), heightFt: f(6, 8) },
  { key: "manHL", label: "Entry door with window", type: "manDoor", widthFt: 3, heightFt: f(6, 8), variant: "halfLight" },
  { key: "dbl6", label: "Double door 6'", type: "doubleDoor", widthFt: 6, heightFt: f(6, 8) },
  { key: "dbl8", label: "Double door 8'", type: "doubleDoor", widthFt: 8, heightFt: 7 },
  { key: "dutch", label: "Dutch door 4' (stall)", type: "dutchDoor", widthFt: 4, heightFt: 8 },
  { key: "slide8", label: "Sliding door 8' × 8'", type: "slidingDoor", widthFt: 8, heightFt: 8 },
  { key: "slide10", label: "Sliding door 10' × 10'", type: "slidingDoor", widthFt: 10, heightFt: 10 },
  { key: "slide12", label: "Sliding door 12' × 12'", type: "slidingDoor", widthFt: 12, heightFt: 12 },
  { key: "slideBi16", label: "Sliding pair 16' × 12'", type: "slidingDoor", widthFt: 16, heightFt: 12, swing: "biParting" },
  { key: "oh9", label: "Overhead door 9' × 8'", type: "overheadDoor", widthFt: 9, heightFt: 8 },
  { key: "oh10", label: "Overhead door 10' × 10'", type: "overheadDoor", widthFt: 10, heightFt: 10 },
  { key: "oh12", label: "Overhead door 12' × 12'", type: "overheadDoor", widthFt: 12, heightFt: 12 },
  { key: "oh16", label: "Overhead door 16' × 12'", type: "overheadDoor", widthFt: 16, heightFt: 12 },
  { key: "ru10", label: "Roll-up door 10' × 10'", type: "rollUpDoor", widthFt: 10, heightFt: 10 },
  { key: "ru12", label: "Roll-up door 12' × 12'", type: "rollUpDoor", widthFt: 12, heightFt: 12 },
];

export const WINDOW_PALETTE: PaletteEntry[] = [
  { key: "w23", label: "Sliding window 2' × 3'", type: "window", widthFt: 2, heightFt: 3, sillFt: 4, variant: "slider" },
  { key: "w33", label: "Sliding window 3' × 3'", type: "window", widthFt: 3, heightFt: 3, sillFt: 4, variant: "slider" },
  { key: "w34", label: "Sliding window 3' × 4'", type: "window", widthFt: 3, heightFt: 4, sillFt: 4, variant: "slider" },
  { key: "w34sh", label: "Single-hung window 3' × 4'", type: "window", widthFt: 3, heightFt: 4, sillFt: 4, variant: "singleHung" },
  { key: "w44", label: "Fixed window 4' × 4'", type: "window", widthFt: 4, heightFt: 4, sillFt: 4, variant: "fixed" },
  { key: "w46", label: "Fixed window 4' × 6'", type: "window", widthFt: 4, heightFt: 6, sillFt: 3, variant: "fixed" },
  { key: "w64", label: "Picture window 6' × 4'", type: "window", widthFt: 6, heightFt: 4, sillFt: 3, variant: "fixed" },
  { key: "w32aw", label: "Awning window 3' × 2'", type: "window", widthFt: 3, heightFt: 2, sillFt: 5, variant: "awning" },
  { key: "w62tr", label: "Transom window 6' × 2'", type: "window", widthFt: 6, heightFt: 2, sillFt: 7, variant: "transom" },
];

export const WINDOW_VARIANTS = ["slider", "singleHung", "fixed", "awning", "hopper", "transom"] as const;

export function isDoor(type: OpeningType): boolean {
  return type !== "window";
}

/** Headroom needed above an overhead door for the track and springs, feet (Industry: 12" standard lift). */
export const OVERHEAD_DOOR_HEADROOM_FT = 1;
/** Headroom for a roll-up coil door's barrel, feet (Industry: 16–20" for a 10–12' door). */
export const ROLLUP_DOOR_HEADROOM_FT = 1.5;

export function headroomFor(type: OpeningType): number {
  return type === "overheadDoor" ? OVERHEAD_DOOR_HEADROOM_FT : type === "rollUpDoor" ? ROLLUP_DOOR_HEADROOM_FT : 0;
}

/** Doors that get a concrete apron outside (vehicles, carts, hay). */
export function needsApron(type: OpeningType): boolean {
  return type === "overheadDoor" || type === "rollUpDoor" || type === "slidingDoor";
}

/** Sliding door leaf overlaps the opening by this much on each side, feet (SPEC §4.6: 4–6"). */
export const SLIDING_LEAF_OVERLAP_FT = 0.5;
/** Sliding door leaf hangs this far off the wall face, feet (SPEC §19.3: ~3"). */
export const SLIDING_LEAF_STANDOFF_FT = 0.25;
