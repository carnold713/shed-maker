"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { STEPS, useViewStore, type Step } from "@/lib/store/useViewStore";
import { Icon } from "@/components/ui/Icon";

const ICON: Record<Step, string> = {
  project: "project",
  layout: "layout",
  building: "building",
  outside: "outside",
  site: "site",
  electrical: "bolt",
  check: "check",
  plans: "plans",
};

/** Step status from the model: empty · started · done (UX audit §2.1). */
function useStepStatus(): Record<Step, "empty" | "started" | "done"> {
  const model = useProjectStore((s) => s.model)!;
  const { report } = useDerived();
  return useMemo(() => {
    const doors = model.openings.filter((o) => o.type !== "window").length;
    const errors = report?.errors ?? 0;
    return {
      project: model.site.verified.frost ? "done" : model.meta.notes ? "started" : "empty",
      layout: model.zones.length === 0 ? "empty" : model.zones.some((z) => z.type === "pen") ? "done" : "started",
      building: "done",
      outside: doors === 0 ? "empty" : model.openings.some((o) => o.type === "window") ? "done" : "started",
      site: model.runs.length === 0 && model.site.lat === undefined ? "empty" : model.runs.length > 0 && model.site.lat !== undefined ? "done" : "started",
      electrical: model.electrical.fixtures.length === 0 ? "empty" : model.electrical.fixtures.some((f) => f.kind === "panel") ? "done" : "started",
      check: errors === 0 ? "done" : "started",
      plans: errors === 0 && model.zones.length > 0 && doors > 0 ? "done" : "empty",
    };
  }, [model, report]);
}

/** Left rail: the steps in order, each with a status dot; Check carries the problem count. */
export function Rail() {
  const step = useViewStore((s) => s.step);
  const setStep = useViewStore((s) => s.setStep);
  const status = useStepStatus();
  const { report } = useDerived();
  const errors = report?.errors ?? 0;
  const warnings = report?.warnings ?? 0;

  return (
    <nav className="flex h-full w-[76px] shrink-0 flex-col items-center border-r border-border/70 bg-panel py-3" aria-label="Steps">
      <Link href="/" className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_8px_18px_-8px_rgba(238,125,43,0.9)]" title="Your barns" aria-label="Your barns">
        <Icon name="home" />
      </Link>
      <ol className="flex w-full flex-col items-center gap-1">
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const st = status[s.id];
          const badge = s.id === "check" ? (errors ? { n: errors, tone: "bg-red-500" } : warnings ? { n: warnings, tone: "bg-amber-400" } : null) : null;
          return (
            <li key={s.id} className="w-full px-2">
              <button
                onClick={() => setStep(s.id)}
                aria-current={active ? "step" : undefined}
                title={`${s.label} · ${s.hint} (Ctrl+${i + 1})`}
                data-testid={`rail-step-${s.id}`}
                className={`relative flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10.5px] font-medium transition ${active ? "bg-accent/12 text-accent" : "text-muted hover:bg-black/5 hover:text-foreground"}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-accent text-white" : ""}`}>
                  <Icon name={ICON[s.id]} size={18} />
                </span>
                {s.label}
                {badge ? (
                  <span className={`absolute right-1 top-1 min-w-[18px] rounded-full px-1 text-center text-[10px] font-semibold leading-[18px] text-white ${badge.tone}`} data-testid="rail-check-badge">
                    {badge.n}
                  </span>
                ) : (
                  <span className={`absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full ${st === "done" ? "bg-emerald-500" : st === "started" ? "bg-amber-400" : "bg-border"}`} aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <a href="https://github.com/carnold713/shed-maker/blob/claude/barn-designer-handoff-da76fh/docs/SPEC.md" target="_blank" rel="noreferrer" className="mt-auto flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-black/5 hover:text-foreground" title="Help & spec" aria-label="Help">
        <Icon name="help" />
      </a>
    </nav>
  );
}
