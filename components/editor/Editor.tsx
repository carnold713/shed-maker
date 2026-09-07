"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { BuildingModel } from "@/lib/model/schema";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { Header } from "@/components/site/HeaderClient";
import { PlanView } from "@/components/plan/PlanView";
import { Inspector } from "@/components/inspector/Inspector";
import { CheckPanel } from "@/components/inspector/CheckPanel";
import { Toolbar, type ViewMode } from "./Toolbar";
import { useAutosave } from "./useAutosave";
import { ContextMenuHost } from "./ContextMenuHost";
import { useViewStore } from "@/lib/store/useViewStore";

// The 3D bundle stays out of the initial route (SPEC §12).
const Viewer = dynamic(() => import("@/components/scene/Viewer").then((m) => m.Viewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading 3D…</div>,
});

export function Editor({ projectId, initialModel }: { projectId: string; initialModel: BuildingModel }) {
  const load = useProjectStore((s) => s.load);
  const loadedId = useProjectStore((s) => s.projectId);
  const [view, setView] = useState<ViewMode>("split");

  useEffect(() => {
    if (loadedId !== projectId) load(projectId, initialModel);
  }, [projectId, initialModel, load, loadedId]);

  useAutosave();
  useKeyboardShortcuts();

  if (loadedId !== projectId) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted">Loading project…</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <Toolbar view={view} onView={setView} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1">
          {view !== "3d" ? (
            <div className={`${view === "split" ? "w-1/2 border-r border-border" : "w-full"} min-w-0 bg-panel`}>
              <PlanView />
            </div>
          ) : null}
          {view !== "plan" ? (
            <div className={`${view === "split" ? "w-1/2" : "w-full"} min-w-0`}>
              <Viewer />
            </div>
          ) : null}
        </div>
        <aside className="flex w-[21rem] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border/70 bg-background p-3">
          <Inspector />
          <CheckPanel />
        </aside>
      </div>
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
        // Escape always leaves the field, then behaves like a normal Escape.
        target.blur();
      } else if (inField) return;
      const ps = useProjectStore.getState();
      const vs = useViewStore.getState();
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const sel = ps.selection;
        const opening = sel ? ps.model?.openings.find((o) => o.id === sel) : undefined;
        const zone = sel ? ps.model?.zones.find((z) => z.id === sel) : undefined;
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
        const leanTo = sel ? ps.model?.leanTos.find((l) => l.id === sel) : undefined;
        if ((e.key === "Delete" || e.key === "Backspace") && leanTo) {
          e.preventDefault();
          ps.removeLeanTo(leanTo.id);
          return;
        }
        const toolKeys: Record<string, "select" | "pen" | "aisle" | "room" | "erase" | "door" | "window" | "leanTo"> = { v: "select", p: "pen", a: "aisle", r: "room", e: "erase", d: "door", w: "window", l: "leanTo" };
        if (toolKeys[e.key.toLowerCase()]) {
          vs.setTool(toolKeys[e.key.toLowerCase()]);
          return;
        }
        if (opening && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          const step = (e.shiftKey ? 1 : 1 / 12) * (e.key === "ArrowLeft" ? -1 : 1);
          ps.moveOpening(opening.id, opening.offsetFt + step);
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
