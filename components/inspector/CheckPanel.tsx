"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { getRule, runRules } from "@/rules";
import { Panel } from "@/components/ui/Panel";

const tone = { error: "bg-red-50 text-red-800 border-red-200", warn: "bg-amber-50 text-amber-800 border-amber-200", info: "bg-sky-50 text-sky-800 border-sky-200" } as const;

/** Live validation (SPEC §7.7). Each finding shows its rule + citation on hover. */
export function CheckPanel() {
  const model = useProjectStore((s) => s.model);
  const snap = useProjectStore((s) => s.snapFootprintToModule);
  const report = useMemo(() => (model ? runRules(model) : null), [model]);
  if (!report) return null;

  return (
    <Panel title={`Check · ${report.errors} errors · ${report.warnings} warnings`}>
      {report.findings.length === 0 ? (
        <p className="text-sm text-muted">No findings.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {report.findings.map((f, i) => {
            const rule = getRule(f.rule);
            return (
              <li key={i} className={`rounded-md border px-2.5 py-2 text-xs ${tone[f.severity]}`} title={rule ? `${rule.id} · ${rule.source}\n${rule.rationale}` : f.rule}>
                <div>{f.message}</div>
                <div className="mt-1 flex items-center justify-between font-mono opacity-70">
                  <span>{rule?.source ?? f.rule}</span>
                  {f.fix?.command === "snapFootprintToModule" ? (
                    <button className="underline" onClick={() => snap((f.fix?.args?.moduleFt as 2 | 4) ?? 2)}>
                      {f.fix.label}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-snug text-muted">
        {report.constructionReady ? "No blocking errors." : "Errors block construction-ready status, not saving."}
      </p>
    </Panel>
  );
}
