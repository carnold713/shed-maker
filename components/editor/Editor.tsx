"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { BuildingModel } from "@/lib/model/schema";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { PlanView } from "@/components/plan/PlanView";
import { Inspector } from "@/components/inspector/Inspector";
import { CheckPanel } from "@/components/inspector/CheckPanel";
import type { ViewMode } from "./Toolbar";
import { useAutosave } from "./useAutosave";
import { ContextMenuHost } from "./ContextMenuHost";
import { Rail } from "./Rail";
import { ProjectPanel } from "./ProjectPanel";
import { StageHeader } from "./StageHeader";
import { BottomCards } from "./BottomCards";
import { InspectorDock } from "./InspectorDock";

// The 3D bundle stays out of the initial route (SPEC §12).
const Viewer = dynamic(() => import("@/components/scene/Viewer").then((m) => m.Viewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading 3D…</div>,
});

/**
 * Editor shell (reference layout): icon rail · project panel · stage.
 * The stage hosts the 3D view, the plan, or both, with the title and
 * actions floating on top, the inspector docked on the right, and the
 * materials / checks cards along the bottom.
 */
export function Editor({ projectId, initialModel }: { projectId: string; initialModel: BuildingModel }) {
  const load = useProjectStore((s) => s.load);
  const loadedId = useProjectStore((s) => s.projectId);
  const selection = useProjectStore((s) => s.selection);
  const [view, setView] = useState<ViewMode>("split");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [checksOpen, setChecksOpen] = useState(false);
  const [projectDrawer, setProjectDrawer] = useState(false);

  useEffect(() => {
    if (loadedId !== projectId) load(projectId, initialModel);
  }, [projectId, initialModel, load, loadedId]);

  // Selecting something always reveals the inspector.
  useEffect(() => {
    if (selection) setInspectorOpen(true);
  }, [selection]);

  useAutosave();
  useKeyboardShortcuts();

  if (loadedId !== projectId) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted">Loading project…</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      <Rail view={view} onView={setView} onCheck={() => setChecksOpen((v) => !v)} onPack={() => setChecksOpen(false)} onProject={() => setProjectDrawer((v) => !v)} projectOpen={projectDrawer} />
      {/* Project panel: in flow on wide screens, a drawer elsewhere. */}
      <div className="hidden 2xl:flex">
        <ProjectPanel />
      </div>
      {projectDrawer ? (
        <div className="absolute inset-y-0 left-16 z-30 flex shadow-2xl 2xl:hidden" data-testid="project-drawer">
          <ProjectPanel />
        </div>
      ) : null}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f3f0ea]">
        <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
        {/* stage content */}
        <div className="absolute inset-0 flex">
          {view !== "3d" ? (
            <div className={`${view === "split" ? "w-[46%] border-r border-border/60" : "w-full"} relative min-w-0 pt-28`}>
              <PlanView />
            </div>
          ) : null}
          {view !== "plan" ? (
            <div className={`${view === "split" ? "w-[54%]" : "w-full"} relative min-w-0`}>
              <Viewer />
            </div>
          ) : null}
        </div>

        <StageHeader />

        {/* view-mode chips for tests / quick switching */}
        <div className="glass absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-1 p-1 text-xs">
          {(["split", "3d", "plan"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`chip ${view === v ? "chip-on" : ""}`} aria-pressed={view === v}>
              {v === "split" ? "Split" : v === "3d" ? "3D" : "Plan"}
            </button>
          ))}
        </div>

        </div>
        <InspectorDock open={inspectorOpen} onToggle={() => setInspectorOpen((v) => !v)}>
          {checksOpen ? <CheckPanel /> : null}
          <Inspector />
          {!checksOpen ? <CheckPanel /> : null}
        </InspectorDock>
        </div>

        <BottomCards
          onOpenChecks={() => {
            setChecksOpen(true);
            setInspectorOpen(true);
          }}
        />
      </main>
      <ContextMenuHost />
    </div>
  );
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (inField && e.key === "Escape") {
        target.blur();
      } else if (inField) return;
      const ps = useProjectStore.getState();
      const vs = useViewStore.getState();
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const sel = ps.selection;
        const opening = sel ? ps.model?.openings.find((o) => o.id === sel) : undefined;
        const zone = sel ? ps.model?.zones.find((z) => z.id === sel) : undefined;
        const leanTo = sel ? ps.model?.leanTos.find((l) => l.id === sel) : undefined;
        if ((e.key === "Delete" || e.key === "Backspace") && opening) {
          e.preventDefault();
          ps.removeOpening(opening.id);
          return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && zone) {
          e.preventDefault();
          ps.removeZone(zone.id);
          return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && leanTo) {
          e.preventDefault();
          ps.removeLeanTo(leanTo.id);
          return;
        }
        if (zone && e.key.toLowerCase() === "d") {
          e.preventDefault();
          ps.duplicateZone(zone.id, ps.model?.roof.ridgeAxis === "ns" ? "n" : "e");
          return;
        }
        if (zone && e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = e.shiftKey ? 4 : 1;
          const xs = zone.polygon.map((p) => p.x);
          const ys = zone.polygon.map((p) => p.y);
          const x = Math.min(...xs) + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0);
          const y = Math.min(...ys) + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0);
          ps.moveZone(zone.id, Math.max(0, x), Math.max(0, y), vs.autoGrow);
          return;
        }
        if (opening && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          const step = (e.shiftKey ? 1 : 1 / 12) * (e.key === "ArrowLeft" ? -1 : 1);
          ps.moveOpening(opening.id, opening.offsetFt + step);
          return;
        }
        const toolKeys: Record<string, "select" | "pen" | "aisle" | "room" | "erase" | "door" | "window" | "leanTo"> = { v: "select", p: "pen", a: "aisle", r: "room", e: "erase", d: "door", w: "window", l: "leanTo" };
        if (toolKeys[e.key.toLowerCase()]) {
          vs.setTool(toolKeys[e.key.toLowerCase()]);
          return;
        }
        if (e.key === "Escape") {
          if (vs.tool !== "select") vs.setTool("select");
          else ps.select(null);
          vs.closeContextMenu();
          return;
        }
        if (e.key.toLowerCase() === "x") {
          vs.setCutHeight(vs.cutHeightFt === null ? 4 : null);
          return;
        }
        if (e.key.toLowerCase() === "f") {
          vs.requestFit();
          return;
        }
        if (e.key === "`") {
          vs.setPreset(vs.preset === "framing" ? "exterior" : "framing");
          return;
        }
        if (e.key.toLowerCase() === "i") {
          vs.setIsometric(!vs.isometric);
          return;
        }
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const t = useProjectStore.temporal.getState();
      if (e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        t.redo();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        t.undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        t.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
