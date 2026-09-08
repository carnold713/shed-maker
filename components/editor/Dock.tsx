"use client";

import type { ReactNode } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore, STEPS, type Step } from "@/lib/store/useViewStore";
import { Inspector, hasInspector } from "@/components/inspector/Inspector";
import { ProjectStep } from "@/components/steps/ProjectStep";
import { LayoutStep } from "@/components/steps/LayoutStep";
import { BuildingStep } from "@/components/steps/BuildingStep";
import { OutsideStep } from "@/components/steps/OutsideStep";
import { ElectricalStep } from "@/components/steps/ElectricalStep";
import { CheckStep } from "@/components/steps/CheckStep";
import { PlansStep } from "@/components/steps/PlansStep";
import { Icon } from "@/components/ui/Icon";

const PANEL: Record<Step, () => ReactNode> = {
  project: () => <ProjectStep />,
  layout: () => <LayoutStep />,
  building: () => <BuildingStep />,
  outside: () => <OutsideStep />,
  electrical: () => <ElectricalStep />,
  check: () => <CheckStep />,
  plans: () => <PlansStep />,
};

/** The one dock panel: the selected item, else the active step (UX audit §2). */
export function Dock() {
  const step = useViewStore((s) => s.step);
  const selection = useProjectStore((s) => s.selection);
  const model = useProjectStore((s) => s.model)!;
  const showItem = selection !== null && hasInspector(model, selection);
  return (
    <aside className="flex w-[22rem] shrink-0 flex-col overflow-y-auto border-l border-border/70 bg-panel" data-testid="inspector-dock">
      {showItem ? <Inspector /> : PANEL[step]()}
    </aside>
  );
}

/** Header of the dock: the step name, or "← Step · Item" when an item is shown. */
export function DockHeader({ step, title, subtitle, icon, back, onBack }: { step?: Step; title: string; subtitle?: string; icon?: string; back?: Step; onBack?: () => void }) {
  const setStep = useViewStore((s) => s.setStep);
  const select = useProjectStore((s) => s.select);
  const backLabel = back ? STEPS.find((s) => s.id === back)?.label : undefined;
  return (
    <div className="sticky top-0 z-10 border-b border-border/60 bg-panel/95 px-4 pb-3 pt-3.5 backdrop-blur">
      {back ? (
        <button
          onClick={() => {
            select(null);
            if (onBack) onBack();
            else setStep(back);
          }}
          className="mb-1 flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
          data-testid="dock-back"
        >
          <Icon name="back" size={14} /> {backLabel}
        </button>
      ) : null}
      <div className="flex items-center gap-2">
        {icon ? <Icon name={icon} size={18} className="text-muted" /> : null}
        <h2 className="truncate text-[16px] font-semibold tracking-tight" data-testid="dock-title">
          {title}
        </h2>
      </div>
      {subtitle ? <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p> : step ? <p className="mt-0.5 text-[12px] text-muted">{STEPS.find((s) => s.id === step)?.hint}</p> : null}
    </div>
  );
}

/** Footer "Next: … →" button for step panels. */
export function NextStep({ to }: { to: Step }) {
  const setStep = useViewStore((s) => s.setStep);
  const label = STEPS.find((s) => s.id === to)?.label ?? to;
  return (
    <div className="mt-auto border-t border-border/60 px-4 py-3">
      <button onClick={() => setStep(to)} className="flex w-full items-center justify-between rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:brightness-110" data-testid={`next-${to}`}>
        Next: {label} <span aria-hidden>→</span>
      </button>
    </div>
  );
}

export function DockBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-5 px-4 py-4 ${className}`}>{children}</div>;
}
