"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import type { BuildingModel, Frame, FrameSystem, Opening, Roof } from "@/lib/model/schema";
import * as cmd from "@/lib/model/commands";
import * as zc from "@/lib/model/zones";
import { applyLayout, type LayoutOptions, type LayoutPattern } from "@/lib/model/layouts";
import * as lc from "@/lib/model/leanTos";
import * as dc from "@/lib/model/interiorDoors";
import * as ec from "@/lib/model/electrical";

import { newId } from "@/lib/model/ids";

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
  setFrameSystem: (s: FrameSystem) => void;
  setFrame: (patch: Parameters<typeof cmd.setFrame>[1]) => void;
  setRoof: (patch: Partial<Roof>) => void;
  setName: (name: string) => void;
  setNotes: (notes: string) => void;
  snapFootprintToModule: (moduleFt?: 2 | 4) => void;
  addOpening: (input: cmd.AddOpeningInput) => string | null;
  updateOpening: (id: string, patch: Partial<Omit<Opening, "id" | "wallId">>) => void;
  moveOpening: (id: string, offsetFt: number) => void;
  removeOpening: (id: string) => void;
  flipOpeningSwing: (id: string) => void;
  centerOpening: (id: string, on?: "wall" | "bay") => void;
  /** Run `fn` as one undo step (drags call many commands). */
  transaction: (fn: () => void) => void;

  addZone: (input: zc.AddZoneInput) => string | null;
  updateZone: (id: string, patch: Parameters<typeof zc.updateZone>[2]) => void;
  moveZone: (id: string, x: number, y: number, autoGrow?: boolean) => void;
  resizeZone: (id: string, rect: zc.Rect, autoGrow?: boolean) => void;
  removeZone: (id: string) => void;
  duplicateZone: (id: string, dir?: "e" | "w" | "n" | "s") => void;
  arrayZone: (id: string, count: number, dir?: "e" | "w" | "n" | "s") => void;
  splitZone: (id: string, parts?: number, axis?: "x" | "y") => void;
  setOutsideAccess: (id: string, on: boolean) => void;
  growToFitZones: () => void;
  fitEnvelopeToZones: () => void;
  applyLayout: (pattern: LayoutPattern, opts?: LayoutOptions) => void;
  addLeanTo: (input: lc.AddLeanToInput) => string | null;
  updateLeanTo: (id: string, patch: Parameters<typeof lc.updateLeanTo>[2]) => void;
  removeLeanTo: (id: string) => void;
  setSlab: (patch: Partial<BuildingModel["foundation"]["slab"]>) => void;
  setSite: (patch: Partial<Omit<BuildingModel["site"], "verified">> & { verified?: Partial<BuildingModel["site"]["verified"]> }) => void;
  setPriceOverride: (sku: string, unitCost: number | null) => void;
  setMaterialColor: (key: "sidingColor" | "roofColor" | "trimColor", value: string) => void;

  addInteriorDoor: (input: dc.AddInteriorDoorInput) => string | null;
  updateInteriorDoor: (id: string, patch: Parameters<typeof dc.updateInteriorDoor>[2]) => void;
  moveInteriorDoor: (id: string, offsetFt: number) => void;
  removeInteriorDoor: (id: string) => void;
  setAutoDoor: (zoneId: string, on: boolean) => void;

  addFixture: (input: ec.AddFixtureInput) => string | null;
  updateFixture: (id: string, patch: Parameters<typeof ec.updateFixture>[2]) => void;
  moveFixture: (id: string, x: number, y: number) => void;
  removeFixture: (id: string) => void;
  setElectricalService: (patch: Partial<BuildingModel["electrical"]["service"]>) => void;
  setWiringMethod: (wiring: BuildingModel["electrical"]["wiring"]) => void;
  autoPlacePanel: () => void;
  autoLightZone: (zoneId: string) => void;
  autoLightAll: () => void;
}

type FramePatch = Partial<{ [K in keyof Frame]: Frame[K] extends object ? Partial<Frame[K]> : Frame[K] }>;

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
        setFrameSystem: (system) => apply((m) => cmd.setFrameSystem(m, system)),
        setFrame: (patch: FramePatch) => apply((m) => cmd.setFrame(m, patch)),
        addOpening: (input) => {
          const id = input.id ?? newId("op");
          apply((m) => cmd.addOpening(m, { ...input, id }));
          return get().model?.openings.some((o) => o.id === id) ? id : null;
        },
        updateOpening: (id, patch) => apply((m) => cmd.updateOpening(m, id, patch)),
        moveOpening: (id, offsetFt) => apply((m) => cmd.moveOpening(m, id, offsetFt)),
        removeOpening: (id) => {
          apply((m) => cmd.removeOpening(m, id));
          if (get().selection === id) set({ selection: null });
        },
        flipOpeningSwing: (id) => apply((m) => cmd.flipOpeningSwing(m, id)),
        centerOpening: (id, on = "wall") => apply((m) => cmd.centerOpening(m, id, on)),
        addZone: (input) => {
          const id = input.id ?? newId("zone");
          apply((m) => zc.addZone(m, { ...input, id }));
          return get().model?.zones.some((z) => z.id === id) ? id : null;
        },
        updateZone: (id, patch) => apply((m) => zc.updateZone(m, id, patch)),
        moveZone: (id, x, y, autoGrow) => apply((m) => zc.moveZone(m, id, x, y, { autoGrow })),
        resizeZone: (id, rect, autoGrow) => apply((m) => zc.resizeZone(m, id, rect, { autoGrow })),
        removeZone: (id) => {
          apply((m) => zc.removeZone(m, id));
          if (get().selection === id) set({ selection: null });
        },
        duplicateZone: (id, dir) => apply((m) => zc.duplicateZone(m, id, dir)),
        arrayZone: (id, count, dir) => apply((m) => zc.arrayZone(m, id, count, dir)),
        splitZone: (id, parts, axis) => apply((m) => zc.splitZone(m, id, parts, axis)),
        setOutsideAccess: (id, on) => apply((m) => zc.setOutsideAccess(m, id, on)),
        growToFitZones: () => apply((m) => zc.growToFitZones(m)),
        fitEnvelopeToZones: () => apply((m) => zc.fitEnvelopeToZones(m)),
        applyLayout: (pattern, opts) => apply((m) => applyLayout(m, pattern, opts)),
        addLeanTo: (input) => {
          const id = input.id ?? newId("lt");
          apply((m) => lc.addLeanTo(m, { ...input, id }));
          return get().model?.leanTos.some((l) => l.id === id) ? id : null;
        },
        updateLeanTo: (id, patch) => apply((m) => lc.updateLeanTo(m, id, patch)),
        removeLeanTo: (id) => {
          apply((m) => lc.removeLeanTo(m, id));
          if (get().selection === id) set({ selection: null });
        },
        setSlab: (patch) => apply((m) => ({ ...m, foundation: { ...m.foundation, slab: { ...m.foundation.slab, ...patch } }, meta: { ...m.meta, updatedAt: new Date().toISOString() } })),
        setSite: (patch) =>
          apply((m) => {
            const { verified, ...rest } = patch;
            const site = { ...m.site, ...rest, verified: { ...m.site.verified, ...(verified ?? {}) } };
            return JSON.stringify(site) === JSON.stringify(m.site) ? m : { ...m, site, meta: { ...m.meta, updatedAt: new Date().toISOString() } };
          }),
        setPriceOverride: (sku, unitCost) =>
          apply((m) => {
            const priceOverrides = { ...m.priceOverrides };
            if (unitCost === null || !Number.isFinite(unitCost)) delete priceOverrides[sku];
            else priceOverrides[sku] = Math.max(0, unitCost);
            return JSON.stringify(priceOverrides) === JSON.stringify(m.priceOverrides) ? m : { ...m, priceOverrides, meta: { ...m.meta, updatedAt: new Date().toISOString() } };
          }),
        setMaterialColor: (key, value) => apply((m) => (m.materials[key] === value ? m : { ...m, materials: { ...m.materials, [key]: value }, meta: { ...m.meta, updatedAt: new Date().toISOString() } })),

        addInteriorDoor: (input) => {
          const id = input.id ?? newId("door");
          apply((m) => dc.addInteriorDoor(m, { ...input, id }));
          return get().model?.zones.some((z) => z.doors.some((d) => d.id === id)) ? id : null;
        },
        updateInteriorDoor: (id, patch) => apply((m) => dc.updateInteriorDoor(m, id, patch)),
        moveInteriorDoor: (id, offsetFt) => apply((m) => dc.moveInteriorDoor(m, id, offsetFt)),
        removeInteriorDoor: (id) => {
          apply((m) => dc.removeInteriorDoor(m, id));
          if (get().selection === id) set({ selection: null });
        },
        setAutoDoor: (zoneId, on) => apply((m) => dc.setAutoDoor(m, zoneId, on)),

        addFixture: (input) => {
          const id = input.id ?? newId("fx");
          apply((m) => ec.addFixture(m, { ...input, id }));
          return get().model?.electrical.fixtures.some((f) => f.id === id) ? id : null;
        },
        updateFixture: (id, patch) => apply((m) => ec.updateFixture(m, id, patch)),
        moveFixture: (id, x, y) => apply((m) => ec.moveFixture(m, id, x, y)),
        removeFixture: (id) => {
          apply((m) => ec.removeFixture(m, id));
          if (get().selection === id) set({ selection: null });
        },
        setElectricalService: (patch) => apply((m) => ec.setElectricalService(m, patch)),
        setWiringMethod: (wiring) => apply((m) => ec.setWiringMethod(m, wiring)),
        autoPlacePanel: () => apply((m) => ec.autoPlacePanel(m)),
        autoLightZone: (zoneId) => apply((m) => ec.autoLightZone(m, zoneId)),
        autoLightAll: () => apply((m) => ec.autoLightAll(m)),
        transaction: (fn) => {
          const temporal = useProjectStore.temporal.getState();
          const start = get().model;
          temporal.pause();
          try {
            fn();
          } finally {
            const end = get().model;
            if (start && end && end !== start) {
              // Rewind untracked, then replay tracked so history holds exactly one step.
              set({ model: start });
              temporal.resume();
              set({ model: end });
            } else {
              temporal.resume();
            }
          }
        },
        setRoof: (patch) => apply((m) => cmd.setRoof(m, patch)),
        setName: (name) => apply((m) => cmd.setName(m, name)),
        setNotes: (notes) => apply((m) => cmd.setNotes(m, notes)),
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
