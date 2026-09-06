"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import type { BuildingModel, ConstructionMethod, Roof } from "@/lib/model/schema";
import * as cmd from "@/lib/model/commands";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface ProjectState {
  projectId: string | null;
  model: BuildingModel | null;
  /** The exact model reference last confirmed persisted. Dirty == model !== savedModel. */
  savedModel: BuildingModel | null;
  saving: boolean;
  saveError: string | null;
  lastSavedAt: string | null;
  selection: string | null;

  load: (projectId: string, model: BuildingModel) => void;
  select: (entityId: string | null) => void;
  markSaving: () => void;
  markSaved: (model: BuildingModel, at: string) => void;
  markSaveError: (message: string) => void;

  setFootprintRect: (wFt: number, dFt: number) => void;
  setEaveHeight: (ft: number) => void;
  setMethod: (m: ConstructionMethod) => void;
  setRoof: (patch: Partial<Roof>) => void;
  setName: (name: string) => void;
  snapFootprintToModule: (moduleFt?: 2 | 4) => void;
}

type ModelUpdater = (m: BuildingModel) => BuildingModel;

export const useProjectStore = create<ProjectState>()(
  temporal(
    (set, get) => {
      const apply = (fn: ModelUpdater) => {
        const { model } = get();
        if (!model) return;
        const next = fn(model);
        if (next === model) return;
        set({ model: next });
      };
      return {
        projectId: null,
        model: null,
        savedModel: null,
        saving: false,
        saveError: null,
        lastSavedAt: null,
        selection: null,

        load: (projectId, model) => {
          set({ projectId, model, savedModel: model, saving: false, saveError: null, selection: null });
          useProjectStore.temporal.getState().clear();
        },
        select: (entityId) => set({ selection: entityId }),
        markSaving: () => set({ saving: true, saveError: null }),
        markSaved: (model, at) => set({ savedModel: model, saving: false, lastSavedAt: at }),
        markSaveError: (message) => set({ saving: false, saveError: message }),

        setFootprintRect: (w, d) => apply((m) => cmd.setFootprintRect(m, w, d)),
        setEaveHeight: (ft) => apply((m) => cmd.setEaveHeight(m, ft)),
        setMethod: (method) => apply((m) => cmd.setMethod(m, method)),
        setRoof: (patch) => apply((m) => cmd.setRoof(m, patch)),
        setName: (name) => apply((m) => cmd.setName(m, name)),
        snapFootprintToModule: (moduleFt = 2) =>
          apply((m) =>
            m.footprint.kind === "rect"
              ? cmd.setFootprintRect(m, cmd.snapToModule(m.footprint.wFt, moduleFt), cmd.snapToModule(m.footprint.dFt, moduleFt))
              : m,
          ),
      };
    },
    {
      // Only the model participates in undo/redo; save state and selection do not.
      partialize: (s) => ({ model: s.model }),
      limit: 200,
      equality: (a, b) => a.model === b.model,
    },
  ),
);

export function selectSaveStatus(s: ProjectState): SaveStatus {
  if (!s.model) return "idle";
  if (s.saving) return "saving";
  if (s.saveError) return "error";
  return s.model === s.savedModel ? "saved" : "dirty";
}

/** Undo/redo helpers bound to the temporal store. */
export function useTemporal() {
  return useStoreWithEqualityFn(
    useProjectStore.temporal,
    (s) => ({
      undo: s.undo,
      redo: s.redo,
      canUndo: s.pastStates.length > 0,
      canRedo: s.futureStates.length > 0,
    }),
    shallow,
  );
}
