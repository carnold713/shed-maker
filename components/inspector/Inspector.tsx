"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { MAX_DIM_FT, MAX_EAVE_FT, MIN_DIM_FT, MIN_EAVE_FT } from "@/lib/model/commands";
import { gableRiseFt } from "@/lib/geometry";
import { formatFtIn, parseFtIn } from "@/lib/units";
import { Panel } from "@/components/ui/Panel";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/** Numeric input that accepts feet-inches text and commits on blur/Enter. */
function FtInput({ value, onCommit, min, max, testId }: { value: number; onCommit: (ft: number) => void; min: number; max: number; testId?: string }) {
  const [text, setText] = useState(formatFtIn(value));
  useEffect(() => setText(formatFtIn(value)), [value]);
  const commit = () => {
    const parsed = parseFtIn(text);
    if (parsed === null || parsed < min || parsed > max) {
      setText(formatFtIn(value));
      return;
    }
    onCommit(parsed);
  };
  return (
    <input
      className={`${inputClass} font-mono`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      data-testid={testId}
    />
  );
}

export function Inspector() {
  const model = useProjectStore((s) => s.model);
  const setFootprintRect = useProjectStore((s) => s.setFootprintRect);
  const setEaveHeight = useProjectStore((s) => s.setEaveHeight);
  const setMethod = useProjectStore((s) => s.setMethod);
  const setRoof = useProjectStore((s) => s.setRoof);
  const snap = useProjectStore((s) => s.snapFootprintToModule);

  if (!model || model.footprint.kind !== "rect") return null;
  const { wFt, dFt } = model.footprint;
  const span = model.roof.ridgeAxis === "ns" ? wFt : dFt;
  const ridge = model.eaveHeightFt + (model.roof.form === "shed" ? span * (model.roof.pitch / 12) : gableRiseFt(span, model.roof.pitch));

  return (
    <>
      <Panel title="Footprint">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width (E–W)">
            <FtInput value={wFt} min={MIN_DIM_FT} max={MAX_DIM_FT} onCommit={(v) => setFootprintRect(v, dFt)} testId="input-width" />
          </Field>
          <Field label="Depth (N–S)">
            <FtInput value={dFt} min={MIN_DIM_FT} max={MAX_DIM_FT} onCommit={(v) => setFootprintRect(wFt, v)} testId="input-depth" />
          </Field>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{wFt * dFt} sq ft</span>
          <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => snap(2)} title="Round both dimensions to the nearest 2'">
            Snap to 2&apos;
          </Button>
        </div>
      </Panel>

      <Panel title="Walls">
        <Field label="Eave height" hint="Wall height at the eave, 6'–24'.">
          <FtInput value={model.eaveHeightFt} min={MIN_EAVE_FT} max={MAX_EAVE_FT} onCommit={setEaveHeight} testId="input-eave" />
        </Field>
        <Field label="Construction method">
          <select className={inputClass} value={model.method} onChange={(e) => setMethod(e.target.value as "postFrame" | "stickFrame")}>
            <option value="postFrame">Post-frame (pole barn)</option>
            <option value="stickFrame">Stick-frame (platform)</option>
          </select>
        </Field>
      </Panel>

      <Panel title="Roof">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Form">
            <select className={inputClass} value={model.roof.form} onChange={(e) => setRoof({ form: e.target.value as "gable" | "shed" })}>
              <option value="gable">Gable</option>
              <option value="shed">Shed / mono-slope</option>
            </select>
          </Field>
          <Field label="Pitch (x:12)">
            <select className={inputClass} value={model.roof.pitch} onChange={(e) => setRoof({ pitch: Number(e.target.value) })}>
              {[2, 3, 4, 5, 6, 8, 10, 12].map((p) => (
                <option key={p} value={p}>
                  {p}:12
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ridge runs">
            <select className={inputClass} value={model.roof.ridgeAxis} onChange={(e) => setRoof({ ridgeAxis: e.target.value as "ew" | "ns" })}>
              <option value="ns">North–south</option>
              <option value="ew">East–west</option>
            </select>
          </Field>
          <Field label="Overhang">
            <select className={inputClass} value={model.roof.overhangEaveIn} onChange={(e) => setRoof({ overhangEaveIn: Number(e.target.value), overhangGableIn: Number(e.target.value) })}>
              {[0, 6, 12, 18, 24].map((o) => (
                <option key={o} value={o}>
                  {o}&quot;
                </option>
              ))}
            </select>
          </Field>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          <dt className="text-muted">Truss span</dt>
          <dd className="font-mono">{formatFtIn(span)}</dd>
          <dt className="text-muted">Ridge height</dt>
          <dd className="font-mono">{formatFtIn(ridge)}</dd>
          <dt className="text-muted">Truss spacing</dt>
          <dd className="font-mono">{model.roof.trussSpacingIn}&quot; OC</dd>
        </dl>
      </Panel>
    </>
  );
}
