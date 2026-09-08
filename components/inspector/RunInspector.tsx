"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { FENCE_KINDS, FENCE_PRESETS, runArea, runEdges, runGuidanceFor, runSqFtPerHead } from "@/lib/model/runs";
import type { Species } from "@/lib/model/schema";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { deriveFencing } from "@/lib/site/fencing";
import { Field, inputClass, Section, Toggle } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";

const SIDE = { n: "North", s: "South", e: "East", w: "West" } as const;

/** One run: who it is for, how big, what fence, which gates (ADR-0017). */
export function RunInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const update = useProjectStore((s) => s.updateRun);
  const remove = useProjectStore((s) => s.removeRun);
  const fit = useProjectStore((s) => s.fitRunToHead);
  const addGate = useProjectStore((s) => s.addRunGate);
  const updateGate = useProjectStore((s) => s.updateRunGate);
  const removeGate = useProjectStore((s) => s.removeRunGate);
  const run = model.runs.find((r) => r.id === id);
  if (!run) return null;
  const g = runGuidanceFor(run.species);
  const perHead = Math.round(runSqFtPerHead(run));
  const short = perHead < g.minSqFtPerHead;
  const fencing = deriveFencing(model).runs.find((r) => r.runId === run.id);
  const pen = run.zoneId ? model.zones.find((z) => z.id === run.zoneId) : undefined;
  const freeSides = runEdges(model, run).filter((e) => !e.onBuilding).map((e) => e.side);
  const animal = run.species ? SPECIES_PRESETS[run.species].label.split(" /")[0].toLowerCase() : "animal";
  return (
    <>
      <DockHeader back="site" title={run.name} subtitle={`${run.rect.w}' × ${run.rect.d}' · ${runArea(run).toLocaleString()} sq ft${pen ? ` · off ${pen.name}` : ""}`} icon="run" />
      <DockBody>
        <Section title="Who it is for">
          <Field label="Name">
            <input className={inputClass} value={run.name} onChange={(e) => update(run.id, { name: e.target.value })} data-testid="run-name" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Animal">
              <select className={inputClass} value={run.species ?? ""} onChange={(e) => update(run.id, { species: (e.target.value || undefined) as Species | undefined })} data-testid="run-species">
                <option value="">Not set</option>
                {PEN_SPECIES.map((sp) => (
                  <option key={sp} value={sp}>
                    {SPECIES_PRESETS[sp].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="How many">
              <input type="number" min={1} max={200} className={`${inputClass} font-mono`} value={run.headCount} onChange={(e) => update(run.id, { headCount: Number(e.target.value) || 1 })} data-testid="run-head" />
            </Field>
          </div>
          <p className={`text-[12px] ${short ? "text-[#b5532a]" : "text-muted"}`} data-testid="run-per-head">
            {perHead.toLocaleString()} sq ft per {animal} · at least {g.minSqFtPerHead}, {g.recSqFtPerHead} recommended.
          </p>
          {short ? (
            <Button className="px-2 py-1 text-xs" onClick={() => fit(run.id)} data-testid="run-fit">
              Grow it to {g.recSqFtPerHead * run.headCount} sq ft
            </Button>
          ) : null}
          <p className="text-[11px] leading-snug text-muted">{g.note}</p>
        </Section>

        <Section title="Size">
          <div className="grid grid-cols-2 gap-2">
            <Field label="East–west">
              <FtInput value={run.rect.w} min={4} max={400} onCommit={(v) => update(run.id, { rect: { ...run.rect, w: v } })} testId="run-width" />
            </Field>
            <Field label="North–south">
              <FtInput value={run.rect.d} min={4} max={400} onCommit={(v) => update(run.id, { rect: { ...run.rect, d: v } })} testId="run-depth" />
            </Field>
          </div>
          <p className="text-[11px] leading-snug text-muted">Drag the run in the plan to move it, or its handles to resize. It stays outside the walls.</p>
        </Section>

        <Section title="Fence">
          <Field label="Type" hint={FENCE_PRESETS[run.fence.kind].hint}>
            <select className={inputClass} value={run.fence.kind} onChange={(e) => update(run.id, { fence: { kind: e.target.value as typeof run.fence.kind, heightFt: FENCE_PRESETS[e.target.value as typeof run.fence.kind].heightFt } })} data-testid="run-fence">
              {FENCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FENCE_PRESETS[k].label}
                  {k === g.fence ? " · usual for " + animal + "s" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Height">
              <FtInput value={run.fence.heightFt} min={2} max={8} onCommit={(v) => update(run.id, { fence: { heightFt: v } })} testId="run-fence-height" />
            </Field>
            <Field label="Posts">
              <div className="text-[12px] text-foreground/80 pt-1.5">every {FENCE_PRESETS[run.fence.kind].postSpacingFt}&apos;</div>
            </Field>
          </div>
          {FENCE_PRESETS[run.fence.kind].material !== "board" ? <Toggle checked={run.fence.topRail} onChange={(v) => update(run.id, { fence: { topRail: v } })} label="2×6 top rail" hint="A sight line for horses; stiffens wire mesh." testId="run-top-rail" /> : null}
          {fencing ? (
            <p className="text-[12px] text-muted" data-testid="run-fence-summary">
              {fencing.fenceFt}&apos; of fence{fencing.sharedFt ? ` (${fencing.sharedFt}' shared with the run beside it)` : ""} · {fencing.linePosts} line posts · {fencing.cornerPosts + fencing.gatePosts} corner and gate posts.
            </p>
          ) : null}
        </Section>

        <Section
          title="Gates"
          aside={
            <button className="text-[11.5px] text-accent underline" onClick={() => addGate(run.id, {})} data-testid="run-add-gate">
              + 4&apos; walk gate
            </button>
          }
        >
          {run.gates.length === 0 ? <p className="text-[12px] text-muted">No gate from outside yet.</p> : null}
          {run.gates.map((gt) => (
            <div key={gt.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-1.5" data-testid="run-gate-row">
              <Field label="Side">
                <select className={inputClass} value={gt.side} onChange={(e) => updateGate(run.id, gt.id, { side: e.target.value as typeof gt.side })}>
                  {(["n", "e", "s", "w"] as const).map((s) => (
                    <option key={s} value={s} disabled={!freeSides.includes(s)}>
                      {SIDE[s]}
                      {freeSides.includes(s) ? "" : " (barn)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Width">
                <select className={inputClass} value={gt.widthFt} onChange={(e) => updateGate(run.id, gt.id, { widthFt: Number(e.target.value) })} data-testid="run-gate-width">
                  {[4, 6, 8, 10, 12, 14, 16].map((w) => (
                    <option key={w} value={w}>
                      {w}&apos;{w >= 12 ? " (tractor)" : w === 4 ? " (walk)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From the corner">
                <FtInput value={gt.offsetFt} min={0} max={400} onCommit={(v) => updateGate(run.id, gt.id, { offsetFt: v })} />
              </Field>
              <Button className="px-2 py-1 text-xs" onClick={() => removeGate(run.id, gt.id)} title="Remove this gate">
                ×
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            <Button className="px-2 py-1 text-xs" onClick={() => addGate(run.id, { widthFt: 12 })} data-testid="run-add-drive-gate">
              + 12&apos; drive gate (tractor)
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted">Gates swing into the run. A 4&apos; walk gate is the minimum; 12&apos; lets a tractor in to scrape the lot.</p>
        </Section>

        <div className="flex flex-wrap gap-1">
          <Button className="px-2 py-1 text-xs" onClick={() => remove(run.id)} data-testid="run-delete">
            Delete run
          </Button>
        </div>
      </DockBody>
    </>
  );
}
