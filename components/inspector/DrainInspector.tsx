"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { DRAIN_PRESETS, OUTLET_LABEL } from "@/lib/model/drainage";
import { deriveDrainage } from "@/lib/plumbing/drainage";
import type { DrainKind, DrainOutlet } from "@/lib/model/schema";
import { formatFtIn } from "@/lib/units";
import { Field, inputClass, Section } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";

const SIDE = { n: "north", s: "south", e: "east", w: "west" } as const;

export function DrainInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const update = useProjectStore((s) => s.updateDrain);
  const remove = useProjectStore((s) => s.removeDrain);
  const d = model.drainage.drains.find((x) => x.id === id);
  const derived = useMemo(() => deriveDrainage(model), [model]);
  if (!d) return null;
  const dd = derived.drains.find((x) => x.drain.id === id);
  const preset = DRAIN_PRESETS[d.kind];
  return (
    <>
      <DockHeader back="building" title={d.label ?? preset.short} subtitle={`${preset.short}${dd?.zone ? ` in ${dd.zone.name}` : ""} · ${dd ? `${dd.runFt}' to the outlet` : "no outlet yet"}`} icon="waterer" />
      <DockBody>
        <Section title="What it is">
          <Field label="Kind" hint={preset.hint}>
            <select className={inputClass} value={d.kind} onChange={(e) => update(d.id, { kind: e.target.value as DrainKind })} data-testid="drain-kind">
              {(Object.keys(DRAIN_PRESETS) as DrainKind[]).map((k) => (
                <option key={k} value={k}>
                  {DRAIN_PRESETS[k].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label">
            <input className={inputClass} defaultValue={d.label ?? ""} key={d.id + (d.label ?? "")} onBlur={(e) => update(d.id, { label: e.target.value.trim() || undefined })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
          </Field>
          {d.kind === "trench" ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Channel length">
                <FtInput value={d.lengthFt} min={1} max={60} onCommit={(v) => update(d.id, { lengthFt: v })} testId="drain-length" />
              </Field>
              <Field label="Runs">
                <select className={inputClass} value={d.axis} onChange={(e) => update(d.id, { axis: e.target.value as "x" | "y" })}>
                  <option value="x">East–west</option>
                  <option value="y">North–south</option>
                </select>
              </Field>
            </div>
          ) : null}
          <details className="text-[12px]">
            <summary className="cursor-pointer select-none text-muted">Position</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="From the west wall">
                <FtInput value={d.x} min={0} max={200} onCommit={(v) => update(d.id, { x: v })} />
              </Field>
              <Field label="From the south wall">
                <FtInput value={d.y} min={0} max={200} onCommit={(v) => update(d.id, { y: v })} />
              </Field>
            </div>
          </details>
        </Section>
        {dd ? (
          <Section title="For the concrete crew">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
              <dt className="text-muted">Slab slopes</dt>
              <dd>
                {dd.slabSlopeInPerFt * 8}/8&quot; per foot over {dd.zone ? dd.zone.name : "the area around it"}
              </dd>
              <dt className="text-muted">High point</dt>
              <dd className="font-mono">
                +{dd.highPointIn}&quot; at {dd.farthestFt}&apos;
              </dd>
              <dt className="text-muted">Pipe invert</dt>
              <dd className="font-mono">{dd.invertIn}&quot; below the floor</dd>
              <dt className="text-muted">Run to outlet</dt>
              <dd className="font-mono">{dd.runFt ? `${dd.runFt}' · drops ${(dd.runFt * model.drainage.slopeInPerFt).toFixed(1)}"` : "—"}</dd>
            </dl>
          </Section>
        ) : null}
        <Button className="self-start px-2 py-1 text-xs text-red-700" onClick={() => remove(d.id)} data-testid="drain-delete">
          Delete
        </Button>
      </DockBody>
    </>
  );
}

export function OutletInspector() {
  const model = useProjectStore((s) => s.model)!;
  const setOutlet = useProjectStore((s) => s.setOutlet);
  const removeOutlet = useProjectStore((s) => s.removeOutlet);
  const setOptions = useProjectStore((s) => s.setDrainageOptions);
  const derived = useMemo(() => deriveDrainage(model), [model]);
  const o = model.drainage.outlet;
  if (!o) return null;
  const wall = model.walls.find((w) => w.id === o.wallId);
  const out = derived.outlet;
  return (
    <>
      <DockHeader back="building" title="Drain outlet" subtitle={`${SIDE[wall?.side ?? "s"]} wall · ${formatFtIn(o.offsetFt)} from the corner`} icon="waterer" />
      <DockBody>
        <Section title="Where the water goes">
          <Field label="Outlet">
            <select className={inputClass} value={o.kind} onChange={(e) => setOutlet({ kind: e.target.value as DrainOutlet["kind"] })} data-testid="outlet-kind">
              {(Object.keys(OUTLET_LABEL) as DrainOutlet["kind"][]).map((k) => (
                <option key={k} value={k}>
                  {OUTLET_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Along the wall" hint="Or drag it along the wall in the plan">
            <FtInput value={o.offsetFt} min={1} max={200} onCommit={(v) => setOutlet({ offsetFt: v })} />
          </Field>
          <Field label="Ground drops to the outlet by (inches)" hint="How much lower the ground is where the pipe ends than at the building.">
            <input type="number" min={0} max={240} className={`${inputClass} font-mono`} value={model.drainage.siteFallIn} onChange={(e) => setOptions({ siteFallIn: Math.max(0, Number(e.target.value) || 0) })} data-testid="site-fall" />
          </Field>
        </Section>
        {out ? (
          <Section title="Pipe leaving the building">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
              <dt className="text-muted">Invert</dt>
              <dd className="font-mono">{out.invertIn}&quot; below the floor</dd>
              <dt className="text-muted">Ground there</dt>
              <dd className="font-mono">{out.groundIn}&quot; below the floor</dd>
              <dt className="text-muted">Daylight</dt>
              <dd className={out.kind !== "daylight" ? "" : out.daylightOk ? "text-emerald-700" : "text-amber-700"}>{out.kind !== "daylight" ? "not needed" : out.daylightOk ? "clears the ground" : `needs ${out.fallNeededIn}" more fall`}</dd>
            </dl>
          </Section>
        ) : null}
        <Button className="self-start px-2 py-1 text-xs text-red-700" onClick={removeOutlet} data-testid="outlet-delete">
          Remove outlet
        </Button>
      </DockBody>
    </>
  );
}
