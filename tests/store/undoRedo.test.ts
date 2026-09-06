// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultModel } from "@/lib/model";
import { selectSaveStatus, useProjectStore } from "@/lib/store/useProjectStore";

const store = useProjectStore;
const temporal = () => useProjectStore.temporal.getState();

describe("project store undo/redo + save state", () => {
  beforeEach(() => {
    store.getState().load("p1", createDefaultModel({ now: new Date(0) }));
  });

  it("starts saved with empty history", () => {
    expect(selectSaveStatus(store.getState())).toBe("saved");
    expect(temporal().pastStates).toHaveLength(0);
  });

  it("edits push history and mark dirty; undo/redo walk it", () => {
    store.getState().setFootprintRect(30, 40);
    store.getState().setEaveHeight(12);
    expect(temporal().pastStates).toHaveLength(2);
    expect(selectSaveStatus(store.getState())).toBe("dirty");

    temporal().undo();
    expect(store.getState().model!.eaveHeightFt).toBe(10);
    expect(store.getState().model!.footprint).toEqual({ kind: "rect", wFt: 30, dFt: 40 });

    temporal().undo();
    expect(store.getState().model!.footprint).toEqual({ kind: "rect", wFt: 24, dFt: 36 });
    // Back at the loaded reference => saved.
    expect(selectSaveStatus(store.getState())).toBe("saved");

    temporal().redo();
    expect(store.getState().model!.footprint).toEqual({ kind: "rect", wFt: 30, dFt: 40 });
    expect(selectSaveStatus(store.getState())).toBe("dirty");
  });

  it("no-op edits do not create history entries", () => {
    store.getState().setFootprintRect(24, 36);
    expect(temporal().pastStates).toHaveLength(0);
  });

  it("a new edit after undo discards the redo stack", () => {
    store.getState().setFootprintRect(30, 40);
    temporal().undo();
    store.getState().setEaveHeight(14);
    expect(temporal().futureStates).toHaveLength(0);
    expect(store.getState().model!.footprint).toEqual({ kind: "rect", wFt: 24, dFt: 36 });
  });

  it("markSaved clears dirty only for the saved reference", () => {
    store.getState().setFootprintRect(30, 40);
    const sent = store.getState().model!;
    store.getState().markSaving();
    store.getState().setEaveHeight(14); // edit while in flight
    store.getState().markSaved(sent, new Date().toISOString());
    expect(selectSaveStatus(store.getState())).toBe("dirty");
  });

  it("load resets history", () => {
    store.getState().setFootprintRect(30, 40);
    store.getState().load("p2", createDefaultModel());
    expect(temporal().pastStates).toHaveLength(0);
    expect(store.getState().projectId).toBe("p2");
  });
});
