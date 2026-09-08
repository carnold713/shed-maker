"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { WIZARD_DEFAULTS, createFromWizard, defaultName, describeWizard, fitSize, type WizardAnswers, type WizardLayout } from "@/lib/model/wizard";
import { createDefaultModel } from "@/lib/model/defaults";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

const LAYOUTS: { id: WizardLayout; title: string; hint: string }[] = [
  { id: "centerAisle", title: "Center aisle", hint: "Stalls on both sides of a wide aisle · best for 4+ horses" },
  { id: "shedRow", title: "Shed row", hint: "One row of stalls, each with its own outside door · cheap and airy" },
  { id: "empty", title: "Empty building", hint: "I'll draw the inside myself" },
];

/** Four questions with defaults; builds the barn client-side and saves it (UX audit §5.2). */
export function NewBarnWizard() {
  const router = useRouter();
  const [a, setA] = useState<WizardAnswers>(WIZARD_DEFAULTS);
  const [busy, setBusy] = useState<"build" | "empty" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<WizardAnswers>) => setA((cur) => ({ ...cur, ...patch }));
  const preview = useMemo(() => describeWizard(a), [a]);
  const fit = fitSize(a);
  const sp = SPECIES_PRESETS[a.species];
  const countHint = sp.groupSqFtPerHead ? `${sp.label} share pens — this is the number of pens, about ${Math.max(1, Math.floor((sp.minPen[0] * sp.minPen[1]) / sp.groupSqFtPerHead))} each` : `${sp.label.split(" /")[0]}s get one stall each`;

  const create = async (kind: "build" | "empty") => {
    setBusy(kind);
    setError(null);
    try {
      const model = kind === "empty" ? createDefaultModel({ name: a.name?.trim() || undefined }) : createFromWizard(a);
      const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model }) });
      if (!res.ok) throw new Error(`Couldn't create the barn (${res.status})`);
      const { project } = (await res.json()) as { project: { id: string } };
      router.push(`/p/${project.id}?step=layout`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the barn — try again.");
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10" data-testid="wizard">
      <div>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Your barns
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">New barn</h1>
        <p className="mt-1 text-sm text-muted">Four questions, all with sensible defaults. You can change everything after.</p>
      </div>

      <Q n={1} title="Who lives here?">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PEN_SPECIES.map((s) => (
            <Tile key={s} active={a.species === s} onClick={() => set({ species: s, name: a.name && a.name !== defaultName(a.species) ? a.name : undefined })} testId={`wizard-species-${s}`}>
              <span className="text-[13px] font-medium">{SPECIES_PRESETS[s].label}</span>
              <span className="text-[11px] text-muted">{SPECIES_PRESETS[s].minPen.join(" × ")} stall</span>
            </Tile>
          ))}
        </div>
      </Q>

      <Q n={2} title="How many?" hint={countHint}>
        <div className="flex items-center gap-2">
          <Button onClick={() => set({ count: Math.max(1, a.count - 1) })} aria-label="Fewer">
            −
          </Button>
          <input type="number" min={1} max={24} className={`${inputClass} w-20 text-center font-mono text-lg`} value={a.count} onChange={(e) => set({ count: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })} data-testid="wizard-count" />
          <Button onClick={() => set({ count: Math.min(24, a.count + 1) })} aria-label="More">
            +
          </Button>
        </div>
      </Q>

      <Q n={3} title="Which layout?">
        <div className="grid gap-2 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <Tile key={l.id} active={a.layout === l.id} onClick={() => set({ layout: l.id })} testId={`wizard-layout-${l.id}`} tall>
              <LayoutPicture id={l.id} />
              <span className="text-[13px] font-medium">{l.title}</span>
              <span className="text-[11px] leading-snug text-muted">{l.hint}</span>
            </Tile>
          ))}
        </div>
      </Q>

      <Q n={4} title="How big?">
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="size" checked={a.size === "fit"} onChange={() => set({ size: "fit" })} className="mt-1" data-testid="wizard-size-fit" />
            <span>
              <span className="font-medium">Fit to the stalls</span>
              <span className="ml-2 font-mono text-muted">
                ≈ {fit.wFt}&apos; × {fit.dFt}&apos; · {(fit.wFt * fit.dFt).toLocaleString()} sq ft
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="size" checked={a.size === "custom"} onChange={() => set({ size: "custom" })} className="mt-1" data-testid="wizard-size-custom" />
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">I know my size</span>
              <input type="number" min={8} max={200} className={`${inputClass} w-20 font-mono`} value={a.wFt ?? 24} disabled={a.size !== "custom"} onChange={(e) => set({ wFt: Number(e.target.value) || 24 })} aria-label="Width in feet" />
              <span className="text-muted">×</span>
              <input type="number" min={8} max={200} className={`${inputClass} w-20 font-mono`} value={a.dFt ?? 36} disabled={a.size !== "custom"} onChange={(e) => set({ dFt: Number(e.target.value) || 36 })} aria-label="Length in feet" />
              <span className="text-muted">feet</span>
            </span>
          </label>
        </div>
      </Q>

      <Q n={5} title="Extras">
        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={a.aisleEndDoors} onChange={(e) => set({ aisleEndDoors: e.target.checked })} /> {a.layout === "centerAisle" ? "Sliding doors at both aisle ends (10' × 10')" : "An entry door"}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={a.stallWindows} onChange={(e) => set({ stallWindows: e.target.checked })} /> A window in every stall
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={a.electrical} onChange={(e) => set({ electrical: e.target.checked })} /> Lights, a switch, an outlet and a panel
          </label>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[12.5px] font-medium">Name</span>
            <input className={`${inputClass} max-w-xs`} value={a.name ?? defaultName(a.species)} onChange={(e) => set({ name: e.target.value })} data-testid="wizard-name" />
          </label>
        </div>
      </Q>

      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <Button variant="primary" className="px-5 py-2.5 text-base" disabled={busy !== null} onClick={() => create("build")} data-testid="wizard-build">
          {busy === "build" ? "Building your barn…" : "Build my barn"}
        </Button>
        <Button disabled={busy !== null} onClick={() => create("empty")} data-testid="wizard-empty" title="A 24' × 36' pole barn with nothing inside">
          {busy === "empty" ? "Creating…" : "Start empty"}
        </Button>
        <span className="text-xs text-muted" data-testid="wizard-preview">
          {preview}
        </span>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}

function Q({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs text-background">{n}</span> {title}
        </h2>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Tile({ active, onClick, children, testId, tall }: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string; tall?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={active} data-testid={testId} className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition ${tall ? "min-h-[7rem]" : ""} ${active ? "border-accent bg-accent/8 shadow-[0_0_0_2px_rgba(238,125,43,0.35)]" : "border-border bg-panel hover:border-foreground/40"}`}>
      {children}
    </button>
  );
}

function LayoutPicture({ id }: { id: WizardLayout }) {
  return (
    <svg width={96} height={44} viewBox="0 0 96 44" className="mb-1 text-muted" aria-hidden>
      <rect x={1} y={1} width={94} height={42} fill="none" stroke="currentColor" strokeWidth={1.5} rx={2} />
      {id === "centerAisle" ? (
        <g stroke="currentColor" strokeWidth={1}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={2 + i * 23.5} y={2} width={22} height={13} fill="#efe6d8" />
              <rect x={2 + i * 23.5} y={29} width={22} height={13} fill="#efe6d8" />
            </g>
          ))}
          <rect x={2} y={16} width={92} height={12} fill="#fbf7f1" strokeDasharray="3 2" />
        </g>
      ) : id === "shedRow" ? (
        <g stroke="currentColor" strokeWidth={1}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={2 + i * 23.5} y={2} width={22} height={40} fill="#efe6d8" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line key={`d${i}`} x1={8 + i * 23.5} y1={42} x2={18 + i * 23.5} y2={42} stroke="#b5532a" strokeWidth={3} />
          ))}
        </g>
      ) : (
        <text x={48} y={27} textAnchor="middle" fontSize={11} fill="currentColor">
          your call
        </text>
      )}
    </svg>
  );
}
