"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { leanToHeights, leanToSpan, LEAN_TO_DEPTHS_FT } from "@/lib/model/leanTos";
import { formatFtIn } from "@/lib/units";
import { Panel } from "@/components/ui/Panel";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FtInput } from "./Inspector";

const SIDE = { n: "North", s: "South", e: "East", w: "West" } as const;

export function LeanToInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const update = useProjectStore((s) => s.updateLeanTo);
  const remove = useProjectStore((s) => s.removeLeanTo);
  const select = useProjectStore((s) => s.select);
  const lt = model.leanTos.find((l) => l.id === id);
  if (!lt) return null;
  const { highFt, lowFt } = leanToHeights(model, lt);
  const span = leanToSpan(model, lt);
  return (
    <Panel title={`${SIDE[lt.side]} lean-to`}>
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
        <Field label="Pitch (x:12)">
          <select className={inputClass} value={lt.pitch} onChange={(e) => update(lt.id, { pitch: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((p) => (
              <option key={p} value={p}>
                {p}:12
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start along wall">
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
        <Field label="Drop below eave">
          <select className={inputClass} value={lt.dropIn} onChange={(e) => update(lt.id, { dropIn: Number(e.target.value) })}>
            {[0, 6, 12, 18, 24].map((d) => (
              <option key={d} value={d}>
                {d}&quot;
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={lt.enclosed} onChange={(e) => update(lt.id, { enclosed: e.target.checked })} data-testid="leanto-enclosed" /> Enclosed (siding on three sides)
      </label>
      <label className="mt-1 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={lt.slab} onChange={(e) => update(lt.id, { slab: e.target.checked })} /> Concrete pad underneath
      </label>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <dt className="text-muted">Attaches at</dt>
        <dd className="font-mono">{formatFtIn(highFt)}</dd>
        <dt className="text-muted">Outer edge height</dt>
        <dd className={`font-mono ${lowFt < 7 ? "text-amber-700" : ""}`}>{formatFtIn(lowFt)}</dd>
        <dt className="text-muted">Covered area</dt>
        <dd className="font-mono">{(span.lengthFt * lt.depthFt).toFixed(0)} sq ft</dd>
      </dl>
      <div className="mt-3 flex gap-1">
        <Button className="px-2 py-1 text-xs" onClick={() => update(lt.id, { offsetFt: undefined, lengthFt: undefined })} disabled={lt.offsetFt === undefined && lt.lengthFt === undefined}>
          Full wall
        </Button>
        <Button className="px-2 py-1 text-xs text-red-700" onClick={() => remove(lt.id)} data-testid="leanto-delete">
          Delete
        </Button>
      </div>
      <button className="mt-2 text-xs text-accent underline" onClick={() => select("footprint")}>
        ← Building
      </button>
    </Panel>
  );
}

/** Slab / pad options on the building inspector (SPEC §4.3, §4.8). */
export function FoundationPanel() {
  const model = useProjectStore((s) => s.model)!;
  const setSlab = useProjectStore((s) => s.setSlab);
  const addLeanTo = useProjectStore((s) => s.addLeanTo);
  const select = useProjectStore((s) => s.select);
  const slab = model.foundation.slab;
  const taken = new Set(model.leanTos.map((l) => l.side));
  return (
    <Panel title="Concrete & lean-tos">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={slab.enabled} onChange={(e) => setSlab({ enabled: e.target.checked })} /> Slab under the building
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Slab thickness">
          <select className={inputClass} value={slab.thicknessIn} onChange={(e) => setSlab({ thicknessIn: Number(e.target.value) })}>
            {[4, 5, 6].map((t) => (
              <option key={t} value={t}>
                {t}&quot;
              </option>
            ))}
          </select>
        </Field>
        <Field label="Above grade">
          <select className={inputClass} value={slab.aboveGradeIn} onChange={(e) => setSlab({ aboveGradeIn: Number(e.target.value) })}>
            {[4, 6, 8, 12].map((t) => (
              <option key={t} value={t}>
                {t}&quot;
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={slab.aprons} onChange={(e) => setSlab({ aprons: e.target.checked })} data-testid="slab-aprons" /> Aprons outside overhead, roll-up and sliding doors ({slab.apronDepthFt}&apos; deep)
      </label>
      <p className="mt-3 text-xs text-muted">Lean-to / awning on a side:</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {(["n", "e", "s", "w"] as const).map((side) => (
          <Button
            key={side}
            className="px-2 py-1 text-xs"
            disabled={taken.has(side)}
            onClick={() => {
              const id = addLeanTo({ side });
              if (id) select(id);
            }}
            data-testid={`add-leanto-${side}`}
          >
            + {{ n: "North", e: "East", s: "South", w: "West" }[side]}
          </Button>
        ))}
      </div>
      {model.leanTos.length > 0 ? (
        <ul className="mt-2 text-xs">
          {model.leanTos.map((lt) => (
            <li key={lt.id}>
              <button className="text-accent underline" onClick={() => select(lt.id)}>
                {{ n: "North", e: "East", s: "South", w: "West" }[lt.side]} lean-to · {lt.depthFt}&apos; · {lt.enclosed ? "enclosed" : "open"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
