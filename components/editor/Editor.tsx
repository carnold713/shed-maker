"use client";

import { useEffect } from "react";
import type { BuildingModel } from "@/lib/model/schema";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { STEPS, useViewStore, type Step } from "@/lib/store/useViewStore";
import { finishDraft, undoDraftPoint } from "@/lib/site/fenceDraft";
import { useAutosave } from "./useAutosave";
import { ContextMenuHost } from "./ContextMenuHost";
import { Rail } from "./Rail";
import { TopBar } from "./TopBar";
import { Stage } from "./Stage";
import { StatusBar } from "./StatusBar";
import { Dock } from "./Dock";
import { ownerStep } from "./selectionOwner";

/**
 * Editor shell (ADR-0012, UX audit §2): a step rail on the left, one stage
 * with a top bar and a status bar, and one dock panel on the right that
 * shows either the active step or the selected item.
 */
export function Editor({ projectId, initialModel, initialStep }: { projectId: string; initialModel: BuildingModel; initialStep?: Step }) {
  const load = useProjectStore((s) => s.load);
  const loadedId = useProjectStore((s) => s.projectId);
  const setStep = useViewStore((s) => s.setStep);

  useEffect(() => {
    if (loadedId !== projectId) {
      load(projectId, initialModel);
      setStep(initialStep && STEPS.some((s) => s.id === initialStep) ? initialStep : "layout");
    }
  }, [projectId, initialModel, load, loadedId, initialStep, setStep]);

  useAutosave();
  useKeyboardShortcuts();
  useSelectionOwnership();

  if (loadedId !== projectId) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted">Loading project…</div>;
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Rail />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Stage />
          <Dock />
        </div>
        <StatusBar />
      </main>
      <ContextMenuHost />
    </div>
  );
}

/** Changing step keeps the selection only when that step owns it (UX audit §3.1). */
function useSelectionOwnership() {
  const step = useViewStore((s) => s.step);
  useEffect(() => {
    const ps = useProjectStore.getState();
    if (!ps.selection || !ps.model) return;
    const owner = ownerStep(ps.model, ps.selection);
    if (owner && owner !== step && step !== "check") ps.select(null);
  }, [step]);
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (inField && e.key === "Escape") {
        target.blur();
        return;
      }
      if (inField) return;
      const ps = useProjectStore.getState();
      const vs = useViewStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.altKey) {
        const t = useProjectStore.temporal.getState();
        const k = e.key.toLowerCase();
        if (k === "z" && e.shiftKey) {
          e.preventDefault();
          t.redo();
        } else if (k === "z") {
          e.preventDefault();
          t.undo();
        } else if (k === "y") {
          e.preventDefault();
          t.redo();
        } else if (k === "d") {
          const zone = ps.selection ? ps.model?.zones.find((z) => z.id === ps.selection) : undefined;
          if (zone) {
            e.preventDefault();
            ps.duplicateZone(zone.id, ps.model?.roof.ridgeAxis === "ns" ? "n" : "e");
          }
        } else if (/^[1-7]$/.test(e.key)) {
          e.preventDefault();
          const step = STEPS[Number(e.key) - 1];
          if (step) vs.setStep(step.id);
        }
        return;
      }
      if (e.altKey) return;

      const sel = ps.selection;
      const model = ps.model;
      const opening = sel ? model?.openings.find((o) => o.id === sel) : undefined;
      const zone = sel ? model?.zones.find((z) => z.id === sel) : undefined;
      const leanTo = sel ? model?.leanTos.find((l) => l.id === sel) : undefined;
      const fixture = sel ? model?.electrical.fixtures.find((f) => f.id === sel) : undefined;
      const door = sel ? model?.zones.flatMap((z) => z.doors).find((d) => d.id === sel) : undefined;
      const drain = sel ? model?.drainage.drains.find((d) => d.id === sel) : undefined;
      const run = sel ? model?.runs.find((r) => r.id === sel) : undefined;
      const fence = sel ? model?.fences.find((f) => f.id === sel) : undefined;
      // Drawing a fence: Enter finishes the line, Backspace takes the last corner back.
      if (vs.tool === "fence" && vs.fenceDraft.length) {
        if (e.key === "Enter") {
          e.preventDefault();
          finishDraft(false);
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          undoDraftPoint();
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (opening) ps.removeOpening(opening.id);
        else if (zone) ps.removeZone(zone.id);
        else if (leanTo) ps.removeLeanTo(leanTo.id);
        else if (fixture) ps.removeFixture(fixture.id);
        else if (door) ps.removeInteriorDoor(door.id);
        else if (drain) ps.removeDrain(drain.id);
        else if (run) ps.removeRun(run.id);
        else if (fence) ps.removeFence(fence.id);
        else if (sel === "drain_outlet") ps.removeOutlet();
        else return;
        e.preventDefault();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        if (zone) {
          e.preventDefault();
          const step = e.shiftKey ? 4 : 1;
          const xs = zone.polygon.map((p) => p.x);
          const ys = zone.polygon.map((p) => p.y);
          const x = Math.min(...xs) + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0);
          const y = Math.min(...ys) + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0);
          ps.moveZone(zone.id, Math.max(0, x), Math.max(0, y), vs.autoGrow);
        } else if (opening && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          const step = (e.shiftKey ? 1 : 1 / 12) * (e.key === "ArrowLeft" ? -1 : 1);
          ps.moveOpening(opening.id, opening.offsetFt + step);
        } else if (fixture) {
          e.preventDefault();
          const step = e.shiftKey ? 2 : 0.5;
          ps.moveFixture(fixture.id, fixture.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), fixture.y + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0));
        }
        return;
      }
      if (fixture && fixture.kind === "light" && e.key.toLowerCase() === "r" && !e.shiftKey) {
        e.preventDefault();
        ps.rotateFixture(fixture.id);
        return;
      }
      // Escape ladder: menu → tool → selection.
      if (e.key === "Escape") {
        if (vs.contextMenu) vs.closeContextMenu();
        else if (vs.tool !== "select") vs.setTool("select");
        else ps.select(null);
        return;
      }
      const k = e.key.toLowerCase();
      // Tool letters: only the tools of the active step.
      const stepTools: Partial<Record<Step, Record<string, typeof vs.tool>>> = {
        layout: { v: "select", s: "pen", p: "pen", r: "room", a: "aisle", d: "interiorDoor", e: "erase" },
        outside: { v: "select", d: "door", w: "window", l: "leanTo", e: "erase" },
        building: { v: "select", d: "drain", e: "erase" },
        site: { v: "select", r: "run", f: "fence", e: "erase" },
        electrical: { v: "select", l: "fixture", e: "erase" },
      };
      const tools = stepTools[vs.step];
      if (tools && tools[k]) {
        vs.setTool(tools[k]);
        return;
      }
      if (k === "f") vs.requestFit();
      else if (k === "i") vs.setIsometric(!vs.isometric);
      else if (e.key === "`") vs.setPreset(vs.preset === "framing" ? "exterior" : "framing");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
