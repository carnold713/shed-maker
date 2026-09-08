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
import * as drc from "@/lib/model/drainage";
import * as rc from "@/lib/model/runs";
import * as fc from "@/lib/model/fences";

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
  addRun: (input: rc.AddRunInput) => string | null;
  updateRun: (id: string, patch: Parameters<typeof rc.updateRun>[2]) => void;
  moveRun: (id: string, x: number, y: number) => void;
  resizeRun: (id: string, rect: Parameters<typeof rc.resizeRun>[2]) => void;
  removeRun: (id: string) => void;
  fitRunToHead: (id: string) => void;
  addRunGate: (runId: string, input?: rc.AddGateInput) => void;
  updateRunGate: (runId: string, gateId: string, patch: Parameters<typeof rc.updateRunGate>[3]) => void;
  removeRunGate: (runId: string, gateId: string) => void;
  /** One run per pen on an outside wall that has none yet. Returns the ids added. */
  autoRuns: () => string[];
  addFence: (input: fc.AddFenceInput) => string | null;
  updateFence: (id: string, patch: Parameters<typeof fc.updateFence>[2]) => void;
  moveFencePoint: (id: string, index: number, p: fc.Pt) => void;
  insertFencePoint: (id: string, seg: number, p: fc.Pt) => void;
  removeFencePoint: (id: string, index: number) => void;
  moveFence: (id: string, dx: number, dy: number) => void;
  removeFence: (id: string) => void;
  addFenceGate: (id: string, input?: fc.AddFenceGateInput) => void;
  updateFenceGate: (id: string, gateId: string, patch: Parameters<typeof fc.updateFenceGate>[3]) => void;
  removeFenceGate: (id: string, gateId: string) => void;
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
  /** Door on one side of a zone: interior door on a partition, outside door on an exterior wall. Returns the new id. */
  addZoneDoor: (input: dc.AddZoneDoorInput) => string | null;
  /** Sliding doors at the ends of an aisle (any outside side for other zones). Returns the ids added. */
  addEndDoors: (zoneId: string) => string[];

  addFixture: (input: ec.AddFixtureInput) => string | null;
  updateFixture: (id: string, patch: Parameters<typeof ec.updateFixture>[2]) => void;
  moveFixture: (id: string, x: number, y: number) => void;
  removeFixture: (id: string) => void;
  setElectricalService: (patch: Partial<BuildingModel["electrical"]["service"]>) => void;
  setWiringMethod: (wiring: BuildingModel["electrical"]["wiring"]) => void;
  autoPlacePanel: () => void;
  autoLightZone: (zoneId: string) => void;
  autoLightAll: () => void;
  rotateFixture: (id: string) => void;

  addDrain: (input: drc.AddDrainInput) => string | null;
  updateDrain: (id: string, patch: Parameters<typeof drc.updateDrain>[2]) => void;
  moveDrain: (id: string, x: number, y: number) => void;
  removeDrain: (id: string) => void;
  setOutlet: (input: Parameters<typeof drc.setOutlet>[1]) => void;
  removeOutlet: () => void;
  setDrainageOptions: (patch: Parameters<typeof drc.setDrainageOptions>[1]) => void;
  autoOutlet: () => void;
  autoDrainWashBays: () => void;
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
        addRun: (input) => {
          const id = input.id ?? newId("run");
          apply((m) => rc.addRun(m, { ...input, id }));
          return get().model?.runs.some((r) => r.id === id) ? id : null;
        },
        updateRun: (id, patch) => apply((m) => rc.updateRun(m, id, patch)),
        moveRun: (id, x, y) => apply((m) => rc.moveRun(m, id, x, y)),
        resizeRun: (id, rect) => apply((m) => rc.resizeRun(m, id, rect)),
        removeRun: (id) => {
          apply((m) => rc.removeRun(m, id));
          if (get().selection === id) set({ selection: null });
        },
        fitRunToHead: (id) => apply((m) => rc.fitRunToHead(m, id)),
        addRunGate: (runId, input) => apply((m) => rc.addRunGate(m, runId, input)),
        updateRunGate: (runId, gateId, patch) => apply((m) => rc.updateRunGate(m, runId, gateId, patch)),
        removeRunGate: (runId, gateId) => apply((m) => rc.removeRunGate(m, runId, gateId)),
        autoRuns: () => {
          const before = new Set(get().model?.runs.map((r) => r.id) ?? []);
          apply((m) => rc.autoRuns(m));
          return (get().model?.runs ?? []).filter((r) => !before.has(r.id)).map((r) => r.id);
        },
        addFence: (input) => {
          const id = input.id ?? newId("fence");
          apply((m) => fc.addFence(m, { ...input, id }));
          return get().model?.fences.some((f) => f.id === id) ? id : null;
        },
        updateFence: (id, patch) => apply((m) => fc.updateFence(m, id, patch)),
        moveFencePoint: (id, index, p) => apply((m) => fc.moveFencePoint(m, id, index, p)),
        insertFencePoint: (id, seg, p) => apply((m) => fc.insertFencePoint(m, id, seg, p)),
        removeFencePoint: (id, index) => apply((m) => fc.removeFencePoint(m, id, index)),
        moveFence: (id, dx, dy) => apply((m) => fc.moveFence(m, id, dx, dy)),
        removeFence: (id) => {
          apply((m) => fc.removeFence(m, id));
          if (get().selection === id) set({ selection: null });
        },
        addFenceGate: (id, input) => apply((m) => fc.addFenceGate(m, id, input)),
        updateFenceGate: (id, gateId, patch) => apply((m) => fc.updateFenceGate(m, id, gateId, patch)),
        removeFenceGate: (id, gateId) => apply((m) => fc.removeFenceGate(m, id, gateId)),
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
        addZoneDoor: (input) => {
          const id = input.id ?? newId("door");
          apply((m) => dc.addZoneDoor(m, { ...input, id }));
          const m = get().model;
          return m && (m.zones.some((z) => z.doors.some((d) => d.id === id)) || m.openings.some((o) => o.id === id)) ? id : null;
        },
        addEndDoors: (zoneId) => {
          let added: string[] = [];
          apply((m) => {
            const r = dc.addEndDoors(m, zoneId);
            added = r.added;
            return r.model;
          });
          return added;
        },

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
        rotateFixture: (id) => apply((m) => ec.rotateFixture(m, id)),

        addDrain: (input) => {
          const id = input.id ?? newId("drain");
          apply((m) => drc.addDrain(m, { ...input, id }));
          return get().model?.drainage.drains.some((d) => d.id === id) ? id : null;
        },
        updateDrain: (id, patch) => apply((m) => drc.updateDrain(m, id, patch)),
        moveDrain: (id, x, y) => apply((m) => drc.moveDrain(m, id, x, y)),
        removeDrain: (id) => {
          apply((m) => drc.removeDrain(m, id));
          if (get().selection === id) set({ selection: null });
        },
        setOutlet: (input) => apply((m) => drc.setOutlet(m, input)),
        removeOutlet: () => {
          apply((m) => drc.removeOutlet(m));
          if (get().selection === drc.OUTLET_ID) set({ selection: null });
        },
        setDrainageOptions: (patch) => apply((m) => drc.setDrainageOptions(m, patch)),
        autoOutlet: () => apply((m) => drc.autoOutlet(m)),
        autoDrainWashBays: () => apply((m) => drc.autoDrainWashBays(m)),
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
