"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { useViewStore } from "@/lib/store/useViewStore";
import { getRule, type Finding, type Severity } from "@/rules";
import { runFix } from "@/components/inspector/CheckPanel";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { EmptyState } from "./ToolRow";
import { ownerStep } from "@/components/editor/selectionOwner";

const GROUPS: { severity: Severity; title: string; tone: string; dot: string }[] = [
  { severity: "error", title: "Must fix", tone: "border-red-200 bg-red-50/60", dot: "bg-red-500" },
  { severity: "warn", title: "Worth a look", tone: "border-amber-200 bg-amber-50/60", dot: "bg-amber-400" },
  { severity: "info", title: "Notes", tone: "border-sky-200 bg-sky-50/60", dot: "bg-sky-400" },
];

/** Check step (UX audit §2.6): findings in three groups, each with its fix and a "Why?". */
export function CheckStep() {
  const { report } = useDerived();
  const findings = report?.findings ?? [];
  return (
    <>
      <DockHeader step="check" title="Check" subtitle={findings.length ? "Red items must be fixed before the plans are ready. Yellow ones are worth a look." : "Problems and fixes"} icon="check" />
      <DockBody>
        {findings.length === 0 ? (
          <EmptyState title="All clear.">Nothing to fix — your barn is ready for the plans.</EmptyState>
        ) : (
          GROUPS.map((g) => {
            const list = findings.filter((f) => f.severity === g.severity);
            if (list.length === 0) return null;
            return (
              <section key={g.severity} className="flex flex-col gap-2" data-testid={`check-group-${g.severity}`}>
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <i className={`inline-block h-2 w-2 rounded-full ${g.dot}`} /> {g.title} · {list.length}
                </h3>
                <ul className="flex flex-col gap-2" data-testid="check-findings">
                  {list.map((f, i) => (
                    <FindingCard key={`${f.rule}_${i}`} f={f} tone={g.tone} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
        <p className="text-[11px] leading-relaxed text-muted">{report?.constructionReady ? "No blocking problems." : "Problems never block saving — only the construction-ready stamp on the plans."}</p>
      </DockBody>
      <NextStep to="plans" />
    </>
  );
}

function FindingCard({ f, tone }: { f: Finding; tone: string }) {
  const select = useProjectStore((s) => s.select);
  const model = useProjectStore((s) => s.model)!;
  const setStep = useViewStore((s) => s.setStep);
  const requestFit = useViewStore((s) => s.requestFit);
  const setHovered = useViewStore((s) => s.setHovered);
  const [why, setWhy] = useState(false);
  const rule = getRule(f.rule);
  const target = f.entityIds.find((id) => id !== "site" && id !== "electrical" && id !== "foundation" && id !== "interior");
  const showMe = () => {
    if (!target) return;
    const owner = ownerStep(model, target);
    if (owner) setStep(owner);
    select(target);
    requestFit();
  };
  return (
    <li className={`rounded-xl border px-3 py-2.5 text-[12.5px] leading-snug ${tone}`} onMouseEnter={() => target && setHovered(target)} onMouseLeave={() => setHovered(null)}>
      <p>{f.message}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {f.fix ? (
          <button className="rounded-lg bg-foreground px-2.5 py-1 text-[12px] font-medium text-background hover:brightness-110" onClick={() => runFix(f)} data-testid="fix-button">
            {f.fix.label}
          </button>
        ) : null}
        {target ? (
          <button className="text-[12px] text-accent underline" onClick={showMe}>
            Show me
          </button>
        ) : null}
        <button className="ml-auto text-[11.5px] text-muted underline" onClick={() => setWhy((v) => !v)} aria-expanded={why}>
          Why?
        </button>
      </div>
      {why && rule ? (
        <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-[11.5px] text-muted">
          <div className="font-medium text-foreground/80">{rule.title}</div>
          <div className="font-mono text-[10.5px]">{rule.source}</div>
          <p className="mt-1 leading-relaxed">{rule.rationale}</p>
        </div>
      ) : null}
    </li>
  );
}
