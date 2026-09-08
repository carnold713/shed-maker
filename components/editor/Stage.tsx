"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { selectStageView, STEP_PLAN_PCT, useViewStore } from "@/lib/store/useViewStore";
import { PlanView } from "@/components/plan/PlanView";
import { SiteStage } from "@/components/site/SiteStage";

// The 3D bundle stays out of the initial route (SPEC §12).
const Viewer = dynamic(() => import("@/components/scene/Viewer").then((m) => m.Viewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading 3D…</div>,
});

/** One stage: plan, 3D, or both side by side with a draggable split (UX audit §2.2). */
export function Stage() {
  const view = useViewStore(selectStageView);
  const step = useViewStore((s) => s.step);
  const planPct = useViewStore((s) => s.stagePlanPcts[s.step]);
  const setPlanPct = useViewStore((s) => s.setStagePlanPct);
  const ref = useRef<HTMLDivElement>(null);

  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => setPlanPct(((ev.clientX - rect.left) / rect.width) * 100);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = prevSelect;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div ref={ref} className="relative flex min-w-0 flex-1 bg-[#f3f0ea]" data-testid="stage" data-plan-pct={view === "both" ? Math.round(planPct) : undefined}>
      {view !== "3d" ? (
        <div className="relative min-w-0" style={{ width: view === "both" ? `calc(${planPct}% - 4px)` : "100%" }}>
          {step === "site" ? <SiteStage /> : <PlanView />}
        </div>
      ) : null}
      {view === "both" ? (
        <div
          className="group relative z-10 w-2 shrink-0 cursor-col-resize bg-border/70 transition hover:bg-accent/60"
          onPointerDown={onDividerDown}
          onDoubleClick={() => setPlanPct(STEP_PLAN_PCT[step])}
          title="Drag to resize · double-click to reset"
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(planPct)}
          data-testid="stage-divider"
        >
          <span className="absolute left-1/2 top-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25 group-hover:bg-white" />
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
