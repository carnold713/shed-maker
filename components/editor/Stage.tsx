"use client";

import dynamic from "next/dynamic";
import { selectStageView, STEP_PLAN_PCT, useViewStore } from "@/lib/store/useViewStore";
import { PlanView } from "@/components/plan/PlanView";

// The 3D bundle stays out of the initial route (SPEC §12).
const Viewer = dynamic(() => import("@/components/scene/Viewer").then((m) => m.Viewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading 3D…</div>,
});

/** One stage: plan, 3D, or both side by side with a per-step split (UX audit §2.2). */
export function Stage() {
  const view = useViewStore(selectStageView);
  const step = useViewStore((s) => s.step);
  const planPct = STEP_PLAN_PCT[step];
  return (
    <div className="relative flex min-w-0 flex-1 bg-[#f3f0ea]" data-testid="stage">
      {view !== "3d" ? (
        <div className="relative min-w-0 border-r border-border/60" style={{ width: view === "both" ? `${planPct}%` : "100%" }}>
          <PlanView />
        </div>
      ) : null}
      {view !== "plan" ? (
        <div className="relative min-w-0 flex-1">
          <Viewer />
        </div>
      ) : null}
    </div>
  );
}
