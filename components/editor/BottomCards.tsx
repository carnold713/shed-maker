"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { quickQuantities } from "@/lib/bom/quick";
import { getRule } from "@/rules";

const tone = { error: "bg-red-500", warn: "bg-amber-400", info: "bg-sky-400" } as const;

/** Bottom summary cards: materials at a glance and check status (reference layout). */
export function BottomCards({ onOpenChecks }: { onOpenChecks: () => void }) {
  const model = useProjectStore((s) => s.model)!;
  const select = useProjectStore((s) => s.select);
  const { framing, geometry, report } = useDerived();
  const q = useMemo(() => (framing && geometry ? quickQuantities(model, framing, geometry) : null), [model, framing, geometry]);
  if (!q || !report) return null;
  const stats: [string, string][] = [
    ["Posts", `${q.posts}`],
    ["Trusses", `${q.trussCount}`],
    ["Lumber", `${q.boardFeet.toLocaleString()} bf`],
    ["Roof steel", `${q.roofSqFt.toLocaleString()} sq ft`],
    ["Siding", `${q.sidingSqFt.toLocaleString()} sq ft`],
    ["Concrete", `${q.concreteCuYd} yd³`],
  ];
  const top = report.findings.slice(0, 3);
  return (
    <div className="grid h-40 shrink-0 grid-cols-[1.6fr_1fr] gap-3 border-t border-border/60 bg-[#f3f0ea] p-3">
      <section className="glass overflow-hidden p-3" data-testid="materials-card">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Materials at a glance</h3>
          <span className="text-[11px] text-muted">estimates · full BOM in the Builder Pack (M4)</span>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-background/70 px-2.5 py-1.5">
              <div className="text-[10px] text-muted">{k}</div>
              <div className="whitespace-nowrap font-mono text-[13px] font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1 overflow-hidden text-[10px] text-muted">
          {Object.entries(q.pieces)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([size, n]) => (
              <span key={size} className="rounded-full bg-background/70 px-2 py-0.5 font-mono">
                {n}× {size.replace("x", "×").replace("3ply", "3-ply ")}
              </span>
            ))}
        </div>
      </section>
      <section className="glass overflow-hidden p-3" data-testid="checks-card">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Checks</h3>
          <button className="text-xs text-accent underline" onClick={onOpenChecks}>
            All {report.findings.length}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full bg-red-500" /> {report.errors} errors
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full bg-amber-400" /> {report.warnings} warnings
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full bg-sky-400" /> {report.infos} notes
          </span>
        </div>
        <ul className="mt-1.5 flex flex-col gap-1">
          {top.length === 0 ? <li className="text-sm text-muted">Nothing to fix.</li> : null}
          {top.map((f, i) => {
            const rule = getRule(f.rule);
            return (
              <li key={i} className="flex items-start gap-2 text-xs" title={rule ? `${rule.id} · ${rule.source}` : f.rule}>
                <i className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${tone[f.severity]}`} />
                <button className="truncate text-left hover:underline" onClick={() => f.entityIds[0] && f.entityIds[0] !== "site" && select(f.entityIds[0])}>
                  {f.message}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
