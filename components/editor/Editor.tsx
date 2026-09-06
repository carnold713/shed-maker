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
        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-background p-3">
          <Inspector />
          <CheckPanel />
        </aside>
      </div>
    </div>
  );
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
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
