"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { useViewStore } from "@/lib/store/useViewStore";
import { estimateMaterials, formatUsd } from "@/lib/bom/estimate";
import { formatFtIn } from "@/lib/units";
import { toolHint } from "@/components/plan/toolHints";

/** Status bar (UX audit §2.9): facts on the left, the contextual line in the middle, cost + problems + saved on the right. */
export function StatusBar() {
  const model = useProjectStore((s) => s.model)!;
  const { framing, geometry, report } = useDerived();
  const hint = useViewStore((s) => s.hint);
  const tool = useViewStore((s) => s.tool);
  const setStep = useViewStore((s) => s.setStep);
  const vs = useViewStore();
  const estimate = useMemo(() => (framing && geometry ? estimateMaterials(model, framing, geometry) : null), [model, framing, geometry]);
  const fp = model.footprint.kind === "rect" ? model.footprint : null;
  const stalls = model.zones.filter((z) => z.type === "pen").length;
  const doors = model.openings.filter((o) => o.type !== "window").length;
  const facts = [fp ? `${formatFtIn(fp.wFt)} × ${formatFtIn(fp.dFt)}` : "", fp ? `${(fp.wFt * fp.dFt).toLocaleString()} sq ft` : "", stalls ? `${stalls} stall${stalls > 1 ? "s" : ""}` : "", doors ? `${doors} door${doors > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
  const line = hint ?? (tool !== "select" ? toolHint(vs, model) : null);
  const errors = report?.errors ?? 0;
  const warnings = report?.warnings ?? 0;

  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-border/70 bg-panel/80 px-3 text-[11.5px] text-muted backdrop-blur" data-testid="status-bar">
      <span className="shrink-0 font-medium text-foreground/80" data-testid="status-facts">{facts}</span>
      <span className="min-w-0 flex-1 truncate" data-testid="status-hint" aria-live="polite">
        {line ?? "Click anything to see its details · right-click for more"}
      </span>
      {estimate ? (
        <button onClick={() => setStep("plans")} className="shrink-0 rounded-full bg-background px-2.5 py-0.5 font-medium text-foreground/80 hover:bg-black/5" title={`Raw materials only, from placeholder prices you can edit in Plans · ${formatUsd(estimate.low)}–${formatUsd(estimate.high)}`} data-testid="status-cost">
          ≈ {formatUsd(estimate.total)} materials
        </button>
      ) : null}
      <button onClick={() => setStep("check")} className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium ${errors ? "bg-red-100 text-red-800" : warnings ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`} data-testid="status-issues" title="Open the Check step">
        {errors ? `${errors} must-fix` : warnings ? `${warnings} warning${warnings > 1 ? "s" : ""}` : "All clear"}
      </button>
    </footer>
  );
}
