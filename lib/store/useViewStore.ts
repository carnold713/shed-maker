"use client";

import { create } from "zustand";
import type { Layer } from "@/lib/framing/types";

export type ViewPreset = "exterior" | "framing" | "dollhouse" | "interior" | "plan";

export const ALL_LAYERS: Layer[] = ["slab", "foundation", "framing", "roofStructure", "roofing", "siding", "openings"];

export const LAYER_LABEL: Record<Layer, string> = {
  slab: "Slab",
  foundation: "Footings",
  framing: "Wall framing",
  roofStructure: "Roof structure",
  roofing: "Roofing",
  siding: "Siding",
  openings: "Doors & windows",
};

const PRESET_LAYERS: Record<ViewPreset, Layer[]> = {
  exterior: ["slab", "roofing", "siding", "openings"],
  framing: ["slab", "foundation", "framing", "roofStructure"],
  dollhouse: ["slab", "framing", "siding", "openings"],
  interior: ["slab", "framing", "roofStructure", "siding", "openings"],
  plan: ["slab", "framing", "siding", "openings"],
};

export type RenderMode = "realistic" | "white";

export interface ContextTarget {
  kind: "wall" | "opening" | "member" | "roof" | "footprint" | "empty" | "viewport";
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

  setPreset: (p: ViewPreset) => void;
  toggleLayer: (l: Layer) => void;
  setLayers: (ls: Layer[]) => void;
  setRenderMode: (m: RenderMode) => void;
  setCutHeight: (ft: number | null) => void;
  requestFit: () => void;
  openContextMenu: (t: ContextTarget) => void;
  closeContextMenu: () => void;
  setHovered: (id: string | null) => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  preset: "exterior",
  visibleLayers: new Set(PRESET_LAYERS.exterior),
  renderMode: "realistic",
  cutHeightFt: null,
  fitNonce: 0,
  contextMenu: null,
  hovered: null,

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
}));
