"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { FENCE_KINDS, FENCE_PRESETS } from "@/lib/model/runs";
import { fenceAreaSqFt, fenceLengthFt, fenceSegments, formatArea } from "@/lib/model/fences";
import { deriveFencing } from "@/lib/site/fencing";
import { Field, inputClass, Section, Toggle } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";

/** One free fence line: kind, height, open or closed, gates (ADR-0017 addendum). */
export function FenceInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const update = useProjectStore((s) => s.updateFence);
  const remove = useProjectStore((s) => s.removeFence);
  const addGate = useProjectStore((s) => s.addFenceGate);
  const updateGate = useProjectStore((s) => s.updateFenceGate);
  const removeGate = useProjectStore((s) => s.removeFenceGate);
  const f = model.fences.find((x) => x.id === id);
  if (!f) return null;
  const len = fenceLengthFt(f);
  const area = fenceAreaSqFt(f);
  const segs = fenceSegments(f);
  const take = deriveFencing(model).fences.find((x) => x.fenceId === f.id);
  return (
    <>
      <DockHeader back="site" title={f.name} subtitle={`${Math.round(len).toLocaleString()}' of fence${area ? ` · ${formatArea(area)} inside` : ""} · ${f.points.length} corners`} icon="fence" />
      <DockBody>
        <Section title="What it is">
          <Field label="Name">
            <input className={inputClass} value={f.name} onChange={(e) => update(f.id, { name: e.target.value })} data-testid="fence-name" />
          </Field>
          <Toggle checked={f.closed} onChange={(v) => update(f.id, { closed: v })} label="Closed all the way round" hint={f.points.length < 3 ? "Needs three corners to close." : "A paddock; open is a lane or a boundary line."} testId="fence-closed" />
          <p className="text-[12px] text-muted" data-testid="fence-summary">
            {Math.round(len).toLocaleString()}&apos; of fence{area ? ` around ${formatArea(area)}` : ""}
            {take ? ` · ${take.corners} corner posts, ${take.linePosts} line posts` : ""}.
          </p>
          <p className="text-[11px] leading-snug text-muted">Drag a corner to move it. Right-click a corner to remove it, or right-click the line to add one. Drag the line to move the whole fence.</p>
        </Section>

        <Section title="Fence">
          <Field label="Type" hint={FENCE_PRESETS[f.kind].hint}>
            <select className={inputClass} value={f.kind} onChange={(e) => update(f.id, { kind: e.target.value as typeof f.kind, heightFt: FENCE_PRESETS[e.target.value as typeof f.kind].heightFt })} data-testid="fence-kind">
              {FENCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FENCE_PRESETS[k].label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Height">
              <FtInput value={f.heightFt} min={2} max={8} onCommit={(v) => update(f.id, { heightFt: v })} testId="fence-height" />
            </Field>
            <Field label="Posts">
              <div className="pt-1.5 text-[12px] text-foreground/80">every {FENCE_PRESETS[f.kind].postSpacingFt}&apos;</div>
            </Field>
          </div>
          {FENCE_PRESETS[f.kind].material !== "board" ? <Toggle checked={f.topRail} onChange={(v) => update(f.id, { topRail: v })} label="2×6 top rail" hint="A sight line for horses; stiffens wire mesh." /> : null}
        </Section>

        <Section
          title="Gates"
          aside={
            <button className="text-[11.5px] text-accent underline" onClick={() => addGate(f.id, {})} data-testid="fence-add-gate">
              + 4&apos; walk gate
            </button>
          }
        >
          {f.gates.length === 0 ? <p className="text-[12px] text-muted">No gate yet.</p> : null}
          {f.gates.map((g) => (
            <div key={g.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-1.5" data-testid="fence-gate-row">
              <Field label="On side">
                <select className={inputClass} value={g.seg} onChange={(e) => updateGate(f.id, g.id, { seg: Number(e.target.value) })}>
                  {segs.map((s) => (
                    <option key={s.i} value={s.i}>
                      {s.i + 1} ({Math.round(s.lengthFt)}&apos;)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Width">
                <select className={inputClass} value={g.widthFt} onChange={(e) => updateGate(f.id, g.id, { widthFt: Number(e.target.value) })}>
                  {[4, 6, 8, 10, 12, 14, 16].map((w) => (
                    <option key={w} value={w}>
                      {w}&apos;{w >= 12 ? " (tractor)" : w === 4 ? " (walk)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From the corner">
                <FtInput value={g.offsetFt} min={0} max={2000} onCommit={(v) => updateGate(f.id, g.id, { offsetFt: v })} />
              </Field>
              <Button className="px-2 py-1 text-xs" onClick={() => removeGate(f.id, g.id)} title="Remove this gate">
                ×
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            <Button className="px-2 py-1 text-xs" onClick={() => addGate(f.id, { widthFt: 12 })} data-testid="fence-add-drive-gate">
              + 12&apos; drive gate (tractor)
            </Button>
          </div>
        </Section>

        <div className="flex flex-wrap gap-1">
          <Button className="px-2 py-1 text-xs" onClick={() => remove(f.id)} data-testid="fence-delete">
            Delete fence
          </Button>
        </div>
      </DockBody>
    </>
  );
}
