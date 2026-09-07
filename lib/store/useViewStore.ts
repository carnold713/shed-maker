"use client";

import { create } from "zustand";
import type { Layer } from "@/lib/framing/types";

export type ViewPreset = "exterior" | "framing" | "dollhouse" | "interior" | "plan";

export const ALL_LAYERS: Layer[] = ["slab", "foundation", "framing", "roofStructure", "roofing", "siding", "openings", "interior"];

export const LAYER_LABEL: Record<Layer, string> = {
  slab: "Slab",
  foundation: "Footings",
  framing: "Wall framing",
  roofStructure: "Roof structure",
  roofing: "Roofing",
  siding: "Siding",
  openings: "Doors & windows",
  interior: "Pens & partitions",
};

const PRESET_LAYERS: Record<ViewPreset, Layer[]> = {
  exterior: ["slab", "roofing", "siding", "openings", "interior"],
  framing: ["slab", "foundation", "framing", "roofStructure", "interior"],
  dollhouse: ["slab", "framing", "siding", "openings", "interior"],
  interior: ["slab", "framing", "roofStructure", "siding", "openings", "interior"],
  plan: ["slab", "framing", "siding", "openings", "interior"],
};

export type RenderMode = "realistic" | "white";

export type PlanTool = "select" | "pen" | "aisle" | "room" | "door" | "window" | "leanTo" | "erase";

export interface ContextTarget {
  kind: "wall" | "opening" | "member" | "roof" | "footprint" | "empty" | "viewport" | "zone" | "leanTo";
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
  /** Orthographic isometric camera (game-like) instead of perspective. */
  isometric: boolean;
  /** Grow the building automatically when a zone lands outside it (SPEC §18.2 "Just do it"). */
  autoGrow: boolean;

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
}));
