"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { leanToHeights, leanToSpan, LEAN_TO_DEPTHS_FT } from "@/lib/model/leanTos";
import { formatFtIn } from "@/lib/units";
import { Field, inputClass, Section, Toggle } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";

const SIDE = { n: "North", s: "South", e: "East", w: "West" } as const;

export function LeanToInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const update = useProjectStore((s) => s.updateLeanTo);
  const remove = useProjectStore((s) => s.removeLeanTo);
  const lt = model.leanTos.find((l) => l.id === id);
  if (!lt) return null;
  const { highFt, lowFt } = leanToHeights(model, lt);
  const span = leanToSpan(model, lt);
  return (
    <>
      <DockHeader back="outside" title={`${SIDE[lt.side]} lean-to`} subtitle={`${lt.depthFt}' deep · ${lt.enclosed ? "enclosed" : "open"} · covers ${(span.lengthFt * lt.depthFt).toFixed(0)} sq ft`} icon="leanto" />
      <DockBody>
        <Section title="Shape">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Depth">
              <select className={inputClass} value={lt.depthFt} onChange={(e) => update(lt.id, { depthFt: Number(e.target.value) })} data-testid="leanto-depth">
                {[...new Set([...LEAN_TO_DEPTHS_FT, lt.depthFt])].sort((a, b) => a - b).map((d) => (
                  <option key={d} value={d}>
                    {d}&apos;
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Roof pitch">
              <select className={inputClass} value={lt.pitch} onChange={(e) => update(lt.id, { pitch: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((p) => (
                  <option key={p} value={p}>
                    {p}:12
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Starts along the wall">
              <FtInput value={span.u0} min={0} max={200} onCommit={(v) => update(lt.id, { offsetFt: v, lengthFt: lt.lengthFt ?? span.lengthFt })} />
            </Field>
            <Field label="Length">
              <FtInput value={span.lengthFt} min={4} max={200} onCommit={(v) => update(lt.id, { offsetFt: span.u0, lengthFt: v })} />
            </Field>
            <Field label="Posts">
              <select className={inputClass} value={lt.postSize} onChange={(e) => update(lt.id, { postSize: e.target.value as typeof lt.postSize })}>
                <option value="4x4">4×4</option>
                <option value="4x6">4×6</option>
                <option value="6x6">6×6</option>
              </select>
            </Field>
            <Field label="Drop below the eave">
              <select className={inputClass} value={lt.dropIn} onChange={(e) => update(lt.id, { dropIn: Number(e.target.value) })}>
                {[0, 6, 12, 18, 24].map((d) => (
                  <option key={d} value={d}>
                    {d}&quot;
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button className="self-start px-2 py-1 text-xs" onClick={() => update(lt.id, { offsetFt: undefined, lengthFt: undefined })} disabled={lt.offsetFt === undefined && lt.lengthFt === undefined}>
            Run the full wall
          </Button>
        </Section>
        <Section title="Options">
          <Toggle checked={lt.enclosed} onChange={(v) => update(lt.id, { enclosed: v })} label="Enclosed (siding on three sides)" testId="leanto-enclosed" />
          <Toggle checked={lt.slab} onChange={(v) => update(lt.id, { slab: v })} label="Concrete pad underneath" />
        </Section>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
          <dt className="text-muted">Attaches at</dt>
          <dd className="font-mono">{formatFtIn(highFt)}</dd>
          <dt className="text-muted">Outer edge</dt>
          <dd className={`font-mono ${lowFt < 7 ? "text-amber-700" : ""}`}>{formatFtIn(lowFt)}</dd>
        </dl>
        <Button className="self-start px-2 py-1 text-xs text-red-700" onClick={() => remove(lt.id)} data-testid="leanto-delete">
          Delete
        </Button>
      </DockBody>
    </>
  );
}
