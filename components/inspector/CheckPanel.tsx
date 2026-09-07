"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { getRule, type Finding } from "@/rules";
import { Panel } from "@/components/ui/Panel";

const tone = { error: "bg-red-50 text-red-800 border-red-200", warn: "bg-amber-50 text-amber-800 border-amber-200", info: "bg-sky-50 text-sky-800 border-sky-200" } as const;

/** Maps a finding's `fix.command` to a store action (SPEC §7.7 `fix?`). */
function runFix(f: Finding) {
  const s = useProjectStore.getState();
  const args = f.fix?.args ?? {};
  switch (f.fix?.command) {
    case "snapFootprintToModule":
      return s.snapFootprintToModule((args.moduleFt as 2 | 4) ?? 2);
    case "setEaveHeight":
      return s.setEaveHeight(Number(args.ft));
    case "centerOpeningInBay":
      return s.centerOpening(String(args.id), "bay");
    case "growToFitZones":
      return s.growToFitZones();
    case "setOutsideAccess":
      return s.setOutsideAccess(String(args.id), true);
    case "resizeZoneTo": {
      const id = String(args.id);
      const z = s.model?.zones.find((x) => x.id === id);
      if (!z) return;
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      return s.resizeZone(id, { x: Math.min(...xs), y: Math.min(...ys), w: Number(args.w), d: Number(args.d) }, true);
    }
    case "nudgeOpeningClear": {
      const id = String(args.id);
      const clear = Number(args.clearanceFt ?? 1);
      const m = s.model;
      const o = m?.openings.find((x) => x.id === id);
      const w = o && m?.walls.find((x) => x.id === o.wallId);
      if (!o || !w) return;
      const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
      const target = o.offsetFt < clear ? clear : len - clear - o.widthFt;
      return s.moveOpening(id, target);
    }
  }
}

/** Live validation (SPEC §7.7). Each finding shows its rule + citation on hover and selects its entity on click. */
export function CheckPanel() {
  const { report } = useDerived();
  const select = useProjectStore((s) => s.select);
  if (!report) return null;

  return (
    <Panel title={`Check · ${report.errors} errors · ${report.warnings} warnings`}>
      {report.findings.length === 0 ? (
        <p className="text-sm text-muted">No findings.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="check-findings">
          {report.findings.map((f, i) => {
            const rule = getRule(f.rule);
            return (
              <li key={i} className={`rounded-md border px-2.5 py-2 text-xs ${tone[f.severity]}`} title={rule ? `${rule.id} · ${rule.source}\n${rule.rationale}` : f.rule}>
                <button className="text-left" onClick={() => f.entityIds[0] && f.entityIds[0] !== "site" && select(f.entityIds[0])}>
                  {f.message}
                </button>
                <div className="mt-1 flex items-center justify-between font-mono opacity-70">
                  <span>{rule?.source ?? f.rule}</span>
                  {f.fix ? (
                    <button className="underline" onClick={() => runFix(f)}>
                      {f.fix.label}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-snug text-muted">{report.constructionReady ? "No blocking errors." : "Errors block construction-ready status, not saving."}</p>
    </Panel>
  );
}
