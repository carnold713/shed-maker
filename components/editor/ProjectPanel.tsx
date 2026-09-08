"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { designProgress } from "@/lib/bom/quick";
import { formatFtIn } from "@/lib/units";
import { Button } from "@/components/ui/Button";
import { SaveStatus } from "./SaveStatus";
import { useAuthEnabled } from "@/components/auth/AuthProvider";
import { UserMenu } from "@/components/auth/UserMenu";

/** Left project panel (reference layout): workspace, project card, progress, plan. */
export function ProjectPanel() {
  const model = useProjectStore((s) => s.model)!;
  const projectId = useProjectStore((s) => s.projectId);
  const setName = useProjectStore((s) => s.setName);
  const setNotes = useProjectStore((s) => s.setNotes);
  const { report } = useDerived();
  const authEnabled = useAuthEnabled();
  const steps = designProgress(model, report?.errors ?? 0);
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);
  const fp = model.footprint.kind === "rect" ? model.footprint : null;

  const saveVersion = async () => {
    if (!projectId) return;
    const label = window.prompt("Version label (optional)", "") ?? null;
    if (label === null) return;
    const res = await fetch(`/api/projects/${projectId}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) });
    if (res.ok) {
      const { version } = (await res.json()) as { version: { number: number } };
      setVersionMsg(`Saved v${version.number}`);
      setTimeout(() => setVersionMsg(null), 2500);
    } else setVersionMsg("Version save failed");
  };

  return (
    <aside className="flex h-full w-[21rem] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border/60 bg-panel p-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Workspace</span>
        <UserMenu enabled={authEnabled} />
      </div>

      <section className="rounded-2xl border border-border/70 bg-background/70 p-4">
        <input
          aria-label="Project name"
          className="w-full rounded-lg border border-transparent bg-transparent px-1 text-lg font-semibold tracking-tight hover:border-border focus:border-accent focus:outline-none"
          defaultValue={model.meta.name}
          key={model.meta.name}
          onBlur={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          data-testid="project-name"
        />
        <textarea
          aria-label="Project notes"
          className="mt-2 w-full resize-none rounded-lg border border-transparent bg-transparent px-1 text-sm leading-snug text-muted hover:border-border focus:border-accent focus:text-foreground focus:outline-none"
          rows={3}
          placeholder="Notes for your builder: animals, site, what matters most…"
          defaultValue={model.meta.notes ?? ""}
          key={`notes_${model.meta.notes ?? ""}`}
          onBlur={(e) => setNotes(e.target.value)}
        />
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted">Size</dt>
          <dd className="font-medium">{fp ? `${formatFtIn(fp.wFt)} × ${formatFtIn(fp.dFt)} · ${fp.wFt * fp.dFt} sq ft` : "—"}</dd>
          <dt className="text-muted">Frame</dt>
          <dd className="font-medium">{model.frame.system === "postFrame" ? `Post-frame · ${model.frame.bayFt}' bays` : "Stick-frame"}</dd>
          <dt className="text-muted">Roof</dt>
          <dd className="font-medium">
            {model.roof.form === "gable" ? "Gable" : "Shed"} {model.roof.pitch}:12 · eave {formatFtIn(model.eaveHeightFt)}
          </dd>
          <dt className="text-muted">Status</dt>
          <dd>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${report && report.errors > 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{report && report.errors > 0 ? `${report.errors} error${report.errors > 1 ? "s" : ""}` : "In design"}</span>
          </dd>
          <dt className="text-muted">Saved</dt>
          <dd>
            <SaveStatus />
          </dd>
        </dl>
      </section>

      <section className="rounded-2xl border border-border/70 bg-background/70 p-4" data-testid="progress-card">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Design progress</h3>
          <span className="text-sm text-muted">{pct}% ready</span>
        </div>
        <div className="mt-3 flex h-10 items-end gap-[3px]" aria-hidden>
          {Array.from({ length: 36 }, (_, i) => (
            <span key={i} className={`flex-1 rounded-sm ${i / 36 < pct / 100 ? "bg-accent" : "bg-accent/15"}`} style={{ height: `${55 + ((i * 37) % 45)}%` }} />
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm" title={s.hint}>
              <span className="flex items-center gap-2">
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${s.done ? "bg-emerald-500 text-white" : "border border-border text-transparent"}`}>✓</span>
                {s.label}
              </span>
              <span className={`text-xs ${s.done ? "text-emerald-700" : "text-accent"}`}>{s.done ? "Done" : "Pending"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border/70 bg-background/70 p-4">
        <div className="flex items-center gap-2">
          <Button onClick={saveVersion} title="Snapshot the current draft as a named version">
            Save version
          </Button>
          {versionMsg ? <span className="text-xs text-muted">{versionMsg}</span> : null}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted">Autosave keeps the working draft; versions are named snapshots you can send to a builder (share links arrive in M4).</p>
      </section>
    </aside>
  );
}
