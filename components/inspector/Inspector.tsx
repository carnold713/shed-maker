"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { MAX_DIM_FT, MAX_EAVE_FT, MIN_DIM_FT, MIN_EAVE_FT } from "@/lib/model/commands";
import { OPENING_PRESETS, DOOR_TYPES } from "@/lib/model/openings";
import type { OpeningType } from "@/lib/model/schema";
import { formatFtIn, parseFtIn } from "@/lib/units";
import { actualFt, stockLength, TREATMENT_LABEL, boardFeet } from "@/rules/materials/lumber";
import { getRule } from "@/rules";
import { Panel } from "@/components/ui/Panel";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { InteriorPanel, ZoneInspector } from "./ZoneInspector";

/** Numeric input that accepts feet-inches text and commits on blur/Enter. */
export function FtInput({ value, onCommit, min, max, testId }: { value: number; onCommit: (ft: number) => void; min: number; max: number; testId?: string }) {
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
  const selection = useProjectStore((s) => s.selection);
  if (!model || model.footprint.kind !== "rect") return null;
  const opening = selection ? model.openings.find((o) => o.id === selection) : undefined;
  if (opening) return <OpeningInspector id={opening.id} />;
  const zone = selection ? model.zones.find((z) => z.id === selection) : undefined;
  if (zone) return <ZoneInspector id={zone.id} />;
  if (selection && selection !== "footprint" && selection !== "roof" && selection !== "foundation") return <MemberInspector id={selection} />;
  return <BuildingInspector />;
}

function BuildingInspector() {
  const model = useProjectStore((s) => s.model)!;
  const setFootprintRect = useProjectStore((s) => s.setFootprintRect);
  const setEaveHeight = useProjectStore((s) => s.setEaveHeight);
  const setFrameSystem = useProjectStore((s) => s.setFrameSystem);
  const setFrame = useProjectStore((s) => s.setFrame);
  const setRoof = useProjectStore((s) => s.setRoof);
  const snap = useProjectStore((s) => s.snapFootprintToModule);
  const { framing } = useDerived();
  if (model.footprint.kind !== "rect") return null;
  const { wFt, dFt } = model.footprint;
  const spec = framing?.trussSpec;
  const post = model.frame.post;
  const isPost = model.frame.system !== "stickFrame";

  return (
    <>
      <InteriorPanel />
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

      <Panel title="Frame">
        <Field label="System">
          <select className={inputClass} value={model.frame.system} onChange={(e) => setFrameSystem(e.target.value as "postFrame" | "stickFrame")} data-testid="select-system">
            <option value="postFrame">Post-frame (pole barn)</option>
            <option value="stickFrame">Stick-frame (platform)</option>
          </select>
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Eave height">
            <FtInput value={model.eaveHeightFt} min={MIN_EAVE_FT} max={MAX_EAVE_FT} onCommit={setEaveHeight} testId="input-eave" />
          </Field>
          {isPost ? (
            <Field label="Bay spacing">
              <select className={inputClass} value={model.frame.bayFt} onChange={(e) => setFrame({ bayFt: Number(e.target.value) })} data-testid="select-bay">
                {[8, 10, 12].map((b) => (
                  <option key={b} value={b}>
                    {b}&apos;
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Studs">
              <select className={inputClass} value={`${model.frame.studs.size}@${model.frame.studs.spacingIn}`} onChange={(e) => {
                const [size, sp] = e.target.value.split("@");
                setFrame({ studs: { size: size as "2x4" | "2x6", spacingIn: Number(sp) as 16 | 24 } });
              }}>
                <option value="2x4@16">2×4 @ 16&quot;</option>
                <option value="2x6@16">2×6 @ 16&quot;</option>
                <option value="2x6@24">2×6 @ 24&quot;</option>
              </select>
            </Field>
          )}
        </div>
        {isPost ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Posts">
                <select className={inputClass} value={post.size} onChange={(e) => setFrame({ post: { size: e.target.value as typeof post.size } })}>
                  <option value="4x6">4×6</option>
                  <option value="6x6">6×6</option>
                  <option value="6x8">6×8</option>
                  <option value="3ply2x6">3-ply 2×6</option>
                  <option value="3ply2x8">3-ply 2×8</option>
                </select>
              </Field>
              <Field label="Foundation">
                <select className={inputClass} value={post.foundation} onChange={(e) => setFrame({ post: { foundation: e.target.value as typeof post.foundation } })}>
                  <option value="embedded">Embedded</option>
                  <option value="bracketPier">Bracket on pier</option>
                  <option value="permaColumn">Perma-column</option>
                </select>
              </Field>
              <Field label="Girts">
                <select className={inputClass} value={`${model.frame.girts.size}/${model.frame.girts.mount}`} onChange={(e) => {
                  const [size, mount] = e.target.value.split("/");
                  setFrame({ girts: { size: size as "2x4" | "2x6", mount: mount as "face" | "bookshelf" } });
                }}>
                  <option value="2x4/face">2×4 face</option>
                  <option value="2x6/face">2×6 face</option>
                  <option value="2x4/bookshelf">2×4 bookshelf</option>
                  <option value="2x6/bookshelf">2×6 bookshelf</option>
                </select>
              </Field>
              <Field label="Truss carrier">
                <select className={inputClass} value={`${model.frame.carrier.plies}x${model.frame.carrier.size}`} onChange={(e) => {
                  const [plies, size] = e.target.value.split("x2");
                  setFrame({ carrier: { plies: Number(plies), size: `2x${size}` as "2x8" | "2x10" | "2x12" } });
                }}>
                  <option value="2x2x10">2-ply 2×10</option>
                  <option value="2x2x12">2-ply 2×12</option>
                  <option value="3x2x12">3-ply 2×12</option>
                </select>
              </Field>
            </div>
            {post.foundation === "embedded" ? (
              <p className="mt-2 text-[11px] leading-snug text-muted">
                Embedded {post.embedIn}&quot; in {post.holeDiaIn}&quot; holes on {post.padDiaIn}&quot; pads · frost {model.site.frostDepthIn ?? "?"}&quot; {model.site.verified.frost ? "" : "(verify)"}
              </p>
            ) : null}
          </>
        ) : null}
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
          <Field label="Trusses">
            <select className={inputClass} value={model.frame.trusses.spacingIn} onChange={(e) => setFrame({ trusses: { spacingIn: Number(e.target.value) } })}>
              <option value={24}>24&quot; OC</option>
              <option value={48}>48&quot; OC</option>
              <option value={96}>96&quot; OC</option>
            </select>
          </Field>
          <Field label="Heel">
            <select className={inputClass} value={model.frame.trusses.heelIn} onChange={(e) => setFrame({ trusses: { heelIn: Number(e.target.value) } })}>
              {[4, 6, 8, 12, 16].map((h) => (
                <option key={h} value={h}>
                  {h}&quot;
                </option>
              ))}
            </select>
          </Field>
        </div>
        {spec ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs" data-testid="truss-spec">
            <dt className="text-muted">Truss span</dt>
            <dd className="font-mono">{formatFtIn(spec.spanFt)}</dd>
            <dt className="text-muted">Count</dt>
            <dd className="font-mono">{spec.count} @ {spec.spacingIn}&quot;</dd>
            <dt className="text-muted">Type</dt>
            <dd className="font-mono">{spec.type}</dd>
          </dl>
        ) : null}
        <p className="mt-2 text-[11px] leading-snug text-muted">Trusses are ordered from a truss manufacturer — this gives span, pitch, heel and spacing for the quote.</p>
      </Panel>

      <MaterialsPanel />
    </>
  );
}

function MaterialsPanel() {
  const model = useProjectStore((s) => s.model)!;
  const setMaterial = (key: "sidingColor" | "roofColor" | "trimColor", value: string) => {
    useProjectStore.setState((s) => (s.model ? { model: { ...s.model, materials: { ...s.model.materials, [key]: value } } } : {}));
  };
  return (
    <Panel title="Materials">
      <div className="grid grid-cols-3 gap-2">
        {(["sidingColor", "roofColor", "trimColor"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs">
            <span className="text-muted">{k === "sidingColor" ? "Siding" : k === "roofColor" ? "Roof" : "Trim"}</span>
            <input type="color" value={model.materials[k]} onChange={(e) => setMaterial(k, e.target.value)} className="h-8 w-full cursor-pointer rounded border border-border bg-panel" />
          </label>
        ))}
      </div>
    </Panel>
  );
}

function OpeningInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const updateOpening = useProjectStore((s) => s.updateOpening);
  const removeOpening = useProjectStore((s) => s.removeOpening);
  const flip = useProjectStore((s) => s.flipOpeningSwing);
  const center = useProjectStore((s) => s.centerOpening);
  const select = useProjectStore((s) => s.select);
  const o = model.openings.find((x) => x.id === id);
  if (!o) return null;
  const wall = model.walls.find((w) => w.id === o.wallId);
  const preset = OPENING_PRESETS[o.type];
  const types: OpeningType[] = o.type === "window" ? ["window"] : DOOR_TYPES;
  const sideName = { n: "north", s: "south", e: "east", w: "west" }[wall?.side ?? "s"];

  return (
    <>
      <Panel title={`${preset.label} · ${sideName} wall`}>
        <Field label="Type">
          <select className={inputClass} value={o.type} onChange={(e) => updateOpening(o.id, { type: e.target.value as OpeningType })} data-testid="opening-type">
            {types.map((t) => (
              <option key={t} value={t}>
                {OPENING_PRESETS[t].label}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Width">
            <FtInput value={o.widthFt} min={1} max={40} onCommit={(v) => updateOpening(o.id, { widthFt: v })} testId="opening-width" />
          </Field>
          <Field label="Height">
            <FtInput value={o.heightFt} min={1} max={24} onCommit={(v) => updateOpening(o.id, { heightFt: v })} testId="opening-height" />
          </Field>
          <Field label="From corner">
            <FtInput value={o.offsetFt} min={0} max={200} onCommit={(v) => updateOpening(o.id, { offsetFt: v })} testId="opening-offset" />
          </Field>
          {o.type === "window" ? (
            <Field label="Sill">
              <FtInput value={o.sillFt} min={0} max={20} onCommit={(v) => updateOpening(o.id, { sillFt: v })} />
            </Field>
          ) : (
            <Field label={o.type === "slidingDoor" || o.type === "stallDoor" ? "Slides" : "Swing"}>
              <select className={inputClass} value={o.swing} onChange={(e) => updateOpening(o.id, { swing: e.target.value as typeof o.swing })}>
                {o.type === "slidingDoor" || o.type === "stallDoor" ? (
                  <>
                    <option value="slideLeft">Left</option>
                    <option value="slideRight">Right</option>
                    <option value="biParting">Bi-parting</option>
                  </>
                ) : o.type === "overheadDoor" ? (
                  <option value="none">Overhead</option>
                ) : (
                  <>
                    <option value="in">In</option>
                    <option value="out">Out</option>
                  </>
                )}
              </select>
            </Field>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {preset.sizes.map(([w, h]) => (
            <button key={`${w}x${h}`} onClick={() => updateOpening(o.id, { widthFt: w, heightFt: h })} className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${Math.abs(w - o.widthFt) < 1e-6 && Math.abs(h - o.heightFt) < 1e-6 ? "border-accent bg-accent/10" : "border-border hover:bg-background"}`}>
              {formatFtIn(w)}×{formatFtIn(h)}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          <Button className="px-2 py-1 text-xs" onClick={() => flip(o.id)} disabled={o.swing === "none" || o.swing === "biParting"}>
            Flip
          </Button>
          <Button className="px-2 py-1 text-xs" onClick={() => center(o.id, "wall")}>
            Center on wall
          </Button>
          <Button className="px-2 py-1 text-xs" onClick={() => center(o.id, "bay")}>
            Center in bay
          </Button>
          <Button className="px-2 py-1 text-xs text-red-700" onClick={() => removeOpening(o.id)} data-testid="opening-delete">
            Delete
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted">
          Rough opening {formatFtIn(o.widthFt + 1 / 12)} × {formatFtIn(o.heightFt + 0.5 / 12)} (unit + ½&quot; each side). Header and jambs are in the framing layer.
        </p>
        <button className="mt-2 text-xs text-accent underline" onClick={() => select("footprint")}>
          ← Building
        </button>
      </Panel>
    </>
  );
}

function MemberInspector({ id }: { id: string }) {
  const { framing } = useDerived();
  const select = useProjectStore((s) => s.select);
  const m = framing?.members.find((x) => x.id === id);
  if (!m) return <BuildingInspector />;
  const a = actualFt(m.nominal);
  const stock = stockLength(m.lengthFt);
  const rule = getRule(m.ruleRef);
  const kindLabel: Record<string, string> = {
    post: "Post",
    footing: "Footing pad",
    skirt: "Skirt board",
    girt: "Girt",
    carrier: "Truss carrier",
    header: "Header",
    jamb: "Jamb",
    trussTopChord: "Truss top chord",
    trussBottomChord: "Truss bottom chord",
    trussWeb: "Truss web",
    purlin: "Purlin",
    plate: "Plate",
    stud: "Stud",
    kneeBrace: "Knee brace",
  };
  return (
    <Panel title={kindLabel[m.kind] ?? m.kind}>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs" data-testid="member-inspector">
        <dt className="text-muted">Nominal</dt>
        <dd className="font-mono">{m.nominal.replace("x", "×").replace("3ply", "3-ply ")}</dd>
        <dt className="text-muted">Actual</dt>
        <dd className="font-mono">{formatFtIn(a.t)} × {formatFtIn(a.d)}</dd>
        <dt className="text-muted">Length</dt>
        <dd className="font-mono">{formatFtIn(m.lengthFt)}</dd>
        <dt className="text-muted">Stock</dt>
        <dd className="font-mono">{stock.stockFt}&apos;{stock.pieces > 1 ? ` × ${stock.pieces}` : ""} · {boardFeet(m.nominal, stock.stockFt * stock.pieces).toFixed(1)} bf</dd>
        <dt className="text-muted">Treatment</dt>
        <dd>{TREATMENT_LABEL[m.treatment]}</dd>
        {m.note ? (
          <>
            <dt className="text-muted">Note</dt>
            <dd>{m.note}</dd>
          </>
        ) : null}
        <dt className="text-muted">Rule</dt>
        <dd className="font-mono" title={rule?.rationale}>{m.ruleRef}</dd>
        {rule ? (
          <>
            <dt className="text-muted">Source</dt>
            <dd className="font-mono">{rule.source}</dd>
          </>
        ) : null}
      </dl>
      {rule ? <p className="mt-2 text-[11px] leading-snug text-muted">{rule.rationale}</p> : null}
      <button className="mt-2 text-xs text-accent underline" onClick={() => select("footprint")}>
        ← Building
      </button>
    </Panel>
  );
}
