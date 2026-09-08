"use client";

import { create } from "zustand";
import type { Layer } from "@/lib/framing/types";

export type ViewPreset = "exterior" | "framing" | "dollhouse" | "interior" | "plan";

export const ALL_LAYERS: Layer[] = ["slab", "foundation", "framing", "roofStructure", "roofing", "siding", "openings", "interior", "electrical"];

export const LAYER_LABEL: Record<Layer, string> = {
  slab: "Slab",
  foundation: "Footings",
  framing: "Wall framing",
  roofStructure: "Roof structure",
  roofing: "Roofing",
  siding: "Siding",
  openings: "Doors & windows",
  interior: "Stalls & rooms",
  electrical: "Electrical",
};

const PRESET_LAYERS: Record<ViewPreset, Layer[]> = {
  exterior: ["slab", "roofing", "siding", "openings", "interior", "electrical"],
  framing: ["slab", "foundation", "framing", "roofStructure", "interior", "electrical"],
  dollhouse: ["slab", "framing", "siding", "openings", "interior", "electrical"],
  interior: ["slab", "framing", "roofStructure", "siding", "openings", "interior", "electrical"],
  plan: ["slab", "framing", "siding", "openings", "interior", "electrical"],
};

/** Plain-English names for the 3D presets (UX audit §4). */
export const PRESET_LABEL: Record<ViewPreset, string> = { exterior: "Outside", framing: "Framing", dollhouse: "Cutaway", interior: "Inside", plan: "Plan" };

/** Editor steps (ADR-0012): the rail walks through them; each shows one dock panel and its own tools. */
export type Step = "project" | "layout" | "building" | "outside" | "electrical" | "check" | "plans";
export const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: "project", label: "Project", hint: "Name, animals, site" },
  { id: "layout", label: "Layout", hint: "Stalls, aisle, rooms, doors" },
  { id: "building", label: "Building", hint: "Size, height, roof, frame" },
  { id: "outside", label: "Outside", hint: "Doors, windows, lean-tos, concrete" },
  { id: "electrical", label: "Electrical", hint: "Lights, outlets, panel" },
  { id: "check", label: "Check", hint: "Problems and fixes" },
  { id: "plans", label: "Plans", hint: "Blueprints, materials, cost" },
];
/** 3D preset that best shows each step's work. */
const STEP_PRESET: Partial<Record<Step, ViewPreset>> = { layout: "dollhouse", building: "exterior", outside: "exterior", electrical: "dollhouse", check: "exterior" };

export type StageView = "plan" | "both" | "3d";
/** Default stage split per step (UX audit §2.2); the user's choice sticks per step. */
export const STEP_STAGE_VIEW: Record<Step, StageView> = { project: "3d", layout: "both", building: "both", outside: "both", electrical: "both", check: "both", plans: "3d" };
/** Plan share of the stage in "both", per step. */
export const STEP_PLAN_PCT: Record<Step, number> = { project: 50, layout: 58, building: 42, outside: 50, electrical: 58, check: 50, plans: 50 };

export type RenderMode = "realistic" | "white";

export type PlanTool = "select" | "pen" | "aisle" | "room" | "door" | "window" | "leanTo" | "interiorDoor" | "fixture" | "erase";

export interface ContextTarget {
  kind: "wall" | "opening" | "member" | "roof" | "footprint" | "empty" | "viewport" | "zone" | "leanTo" | "interiorDoor" | "fixture";
  /** Plan position under the cursor, feet (empty-space menus). */
  planX?: number;
  planY?: number;
  id?: string;
  /** For walls: position along the wall under the cursor, feet. */
  uFt?: number;
  /** Where the menu opens, in viewport pixels. */
  x: number;
  y: number;
  /** Which surface opened it. */
  from: "plan" | "3d";
}

export interface ViewState {
  preset: ViewPreset;
  visibleLayers: Set<Layer>;
  renderMode: RenderMode;
  /** Horizontal cut height above finished floor, feet; null = no cut. */
  cutHeightFt: number | null;
  /** Bumps when the camera should re-fit. */
  fitNonce: number;
  contextMenu: ContextTarget | null;
  hovered: string | null;
  /** Plan drawing tool (SPEC §21.2 hotkeys P/A/R). */
  tool: PlanTool;
  toolSpecies: string;
  toolRoomType: string;
  /** Palette keys for the door / window tools (see lib/model/openings DOOR_PALETTE / WINDOW_PALETTE). */
  toolDoorKey: string;
  toolWindowKey: string;
  /** Door type for the interior-door tool and fixture kind for the electrical tool. */
  toolInteriorDoorType: string;
  toolFixtureKind: string;
  /** Orthographic isometric camera (game-like) instead of perspective. */
  isometric: boolean;
  /** Grow the building automatically when a zone lands outside it (SPEC §18.2 "Just do it"). */
  autoGrow: boolean;
  /** Which editor step is active and how the stage is split (per step). */
  step: Step;
  stageViews: Record<Step, StageView>;
  /** Plan share of the stage in "both", per step (user-draggable). */
  stagePlanPcts: Record<Step, number>;
  /** Contextual status line: what the pointer is over, or what the armed tool will do. */
  hint: string | null;

  setPreset: (p: ViewPreset) => void;
  toggleLayer: (l: Layer) => void;
  setLayers: (ls: Layer[]) => void;
  setRenderMode: (m: RenderMode) => void;
  setCutHeight: (ft: number | null) => void;
  requestFit: () => void;
  openContextMenu: (t: ContextTarget) => void;
  closeContextMenu: () => void;
  setHovered: (id: string | null) => void;
  setTool: (t: PlanTool) => void;
  setToolSpecies: (s: string) => void;
  setToolRoomType: (t: string) => void;
  setToolDoorKey: (k: string) => void;
  setToolWindowKey: (k: string) => void;
  setAutoGrow: (v: boolean) => void;
  setIsometric: (v: boolean) => void;
  setToolInteriorDoorType: (t: string) => void;
  setToolFixtureKind: (k: string) => void;
  setStep: (s: Step) => void;
  setStageView: (v: StageView) => void;
  setStagePlanPct: (pct: number) => void;
  setHint: (h: string | null) => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  preset: "exterior",
  visibleLayers: new Set(PRESET_LAYERS.exterior),
  renderMode: "realistic",
  cutHeightFt: null,
  fitNonce: 0,
  contextMenu: null,
  hovered: null,
  tool: "select",
  toolSpecies: "horse",
  toolRoomType: "tack",
  toolDoorKey: "man36",
  toolWindowKey: "w34",
  autoGrow: true,
  isometric: false,
  toolInteriorDoorType: "stallSlide",
  toolFixtureKind: "light",
  step: "layout",
  stageViews: { ...STEP_STAGE_VIEW },
  stagePlanPcts: { ...STEP_PLAN_PCT },
  hint: null,

  setPreset: (preset) =>
    set({
      preset,
      visibleLayers: new Set(PRESET_LAYERS[preset]),
      cutHeightFt: preset === "dollhouse" ? 4 : null,
    }),
  toggleLayer: (l) =>
    set((s) => {
      const next = new Set(s.visibleLayers);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return { visibleLayers: next };
    }),
  setLayers: (ls) => set({ visibleLayers: new Set(ls) }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setCutHeight: (cutHeightFt) => set({ cutHeightFt }),
  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
  openContextMenu: (contextMenu) => set({ contextMenu }),
  closeContextMenu: () => set({ contextMenu: null }),
  setHovered: (hovered) => set({ hovered }),
  setTool: (tool) => set({ tool }),
  setToolSpecies: (toolSpecies) => set({ toolSpecies, tool: "pen" }),
  setToolRoomType: (toolRoomType) => set({ toolRoomType, tool: "room" }),
  setToolDoorKey: (toolDoorKey) => set({ toolDoorKey, tool: "door" }),
  setToolWindowKey: (toolWindowKey) => set({ toolWindowKey, tool: "window" }),
  setAutoGrow: (autoGrow) => set({ autoGrow }),
  setIsometric: (isometric) => set({ isometric }),
  setToolInteriorDoorType: (toolInteriorDoorType) => set({ toolInteriorDoorType, tool: "interiorDoor" }),
  setToolFixtureKind: (toolFixtureKind) => set({ toolFixtureKind, tool: "fixture" }),
  setStep: (step) =>
    set((s) => {
      const preset = STEP_PRESET[step];
      return {
        step,
        tool: "select",
        contextMenu: null,
        ...(preset && preset !== s.preset ? { preset, visibleLayers: new Set(PRESET_LAYERS[preset]), cutHeightFt: preset === "dollhouse" ? 4 : null } : {}),
      };
    }),
  setStageView: (v) => set((s) => ({ stageViews: { ...s.stageViews, [s.step]: v } })),
  setStagePlanPct: (pct) => set((s) => ({ stagePlanPcts: { ...s.stagePlanPcts, [s.step]: Math.min(75, Math.max(25, pct)) } })),
  setHint: (hint) => set((s) => (s.hint === hint ? {} : { hint })),
}));

/** Stage split for the active step. */
export function selectStageView(s: ViewState): StageView {
  return s.stageViews[s.step];
}
