"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { MAX_DIM_FT, MAX_EAVE_FT, MIN_DIM_FT, MIN_EAVE_FT } from "@/lib/model/commands";
import { formatFtIn } from "@/lib/units";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { Field, inputClass, Section, Toggle } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { useMemo } from "react";
import { useViewStore } from "@/lib/store/useViewStore";
import { deriveDrainage } from "@/lib/plumbing/drainage";
import { OUTLET_LABEL, OUTLET_ID } from "@/lib/model/drainage";
import type { DrainOutlet } from "@/lib/model/schema";
import { ToolRow, ToolButton, ItemList, EmptyState } from "./ToolRow";

/** Building step (UX audit §2.4): size, height, roof, frame, concrete. Trade detail lives under "Advanced framing". */
export function BuildingStep() {
  const model = useProjectStore((s) => s.model)!;
  const setFootprintRect = useProjectStore((s) => s.setFootprintRect);
  const setEaveHeight = useProjectStore((s) => s.setEaveHeight);
  const setFrameSystem = useProjectStore((s) => s.setFrameSystem);
  const setFrame = useProjectStore((s) => s.setFrame);
  const setRoof = useProjectStore((s) => s.setRoof);
  const setSlab = useProjectStore((s) => s.setSlab);
  const snap = useProjectStore((s) => s.snapFootprintToModule);
  const setOutlet = useProjectStore((s) => s.setOutlet);
  const setDrainageOptions = useProjectStore((s) => s.setDrainageOptions);
  const autoDrainWashBays = useProjectStore((s) => s.autoDrainWashBays);
  const autoOutlet = useProjectStore((s) => s.autoOutlet);
  const select = useProjectStore((s) => s.select);
  const tool = useViewStore((s) => s.tool);
  const drainKind = useViewStore((s) => s.toolDrainKind);
  const setDrainKind = useViewStore((s) => s.setToolDrainKind);
  const drainage = useMemo(() => deriveDrainage(model), [model]);
  const { framing, geometry, report } = useDerived();
  const problems = new Set((report?.findings ?? []).filter((f) => f.severity !== "info").flatMap((f) => f.entityIds));
  if (model.footprint.kind !== "rect") return null;
  const { wFt, dFt } = model.footprint;
  const ns = model.roof.ridgeAxis === "ns";
  const post = model.frame.post;
  const isPost = model.frame.system !== "stickFrame";
  const spec = framing?.trussSpec;
  const slab = model.foundation.slab;
  const advancedSummary = isPost
    ? `${post.size.replace("x", "×").replace("3ply", "3-ply ")} posts ${post.foundation === "embedded" ? "set in the ground" : post.foundation === "bracketPier" ? "on brackets" : "on precast columns"} · ${model.frame.girts.size.replace("x", "×")} girts · ${model.frame.carrier.plies}-ply ${model.frame.carrier.size.replace("x", "×")} carrier · trusses every ${model.frame.trusses.spacingIn / 12}'`
    : `${model.frame.studs.size.replace("x", "×")} studs every ${model.frame.studs.spacingIn}" · trusses every ${model.frame.trusses.spacingIn / 12}'`;

  return (
    <>
      <DockHeader step="building" title="Building" subtitle={`${formatFtIn(wFt)} × ${formatFtIn(dFt)} · ${(wFt * dFt).toLocaleString()} sq ft · ${isPost ? "pole barn" : "stick-frame"}`} icon="building" />
      <DockBody>
        <Section
          title="Size"
          aside={
            <Button variant="ghost" className="px-2 py-0.5 text-[11.5px]" onClick={() => snap(2)} title="Sheet goods and trusses come in 2' steps — off-size walls waste material">
              Round to 2&apos;
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label={ns ? "Width (across the roof)" : "Width (along the ridge)"} hint="east–west">
              <FtInput value={wFt} min={MIN_DIM_FT} max={MAX_DIM_FT} onCommit={(v) => setFootprintRect(v, dFt)} testId="input-width" />
            </Field>
            <Field label={ns ? "Length (along the ridge)" : "Length (across the roof)"} hint="north–south">
              <FtInput value={dFt} min={MIN_DIM_FT} max={MAX_DIM_FT} onCommit={(v) => setFootprintRect(wFt, v)} testId="input-depth" />
            </Field>
          </div>
          <p className="text-[11px] leading-snug text-muted">Or drag the orange handles on the plan. The building grows from its south-west corner.</p>
        </Section>

        <Section title="Height">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Wall height (at the eave)">
              <FtInput value={model.eaveHeightFt} min={MIN_EAVE_FT} max={MAX_EAVE_FT} onCommit={setEaveHeight} testId="input-eave" />
            </Field>
            <Field label="Ridge height">
              <div className={`${inputClass} bg-transparent font-mono text-muted`}>{geometry ? formatFtIn(geometry.ridgeHeightFt) : "—"}</div>
            </Field>
          </div>
        </Section>

        <Section title="Roof">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Shape">
              <select className={inputClass} value={model.roof.form} onChange={(e) => setRoof({ form: e.target.value as "gable" | "shed" })} data-testid="roof-form">
                <option value="gable">Gable (two slopes)</option>
                <option value="shed">Single slope</option>
              </select>
            </Field>
            <Field label="Pitch">
              <select className={inputClass} value={model.roof.pitch} onChange={(e) => setRoof({ pitch: Number(e.target.value) })}>
                {[2, 3, 4, 5, 6, 8, 10, 12].map((p) => (
                  <option key={p} value={p}>
                    {p}:12{p <= 3 ? " (shallow)" : p >= 10 ? " (steep)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ridge direction">
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
        </Section>

        <Section title="Frame">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Build">
              <select className={inputClass} value={model.frame.system} onChange={(e) => setFrameSystem(e.target.value as "postFrame" | "stickFrame")} data-testid="select-system">
                <option value="postFrame">Pole barn (posts in the ground)</option>
                <option value="stickFrame">Stick-frame (on a slab)</option>
              </select>
            </Field>
            {isPost ? (
              <Field label="Post spacing" hint="12' puts one horse stall between each pair of posts">
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
                <select
                  className={inputClass}
                  value={`${model.frame.studs.size}@${model.frame.studs.spacingIn}`}
                  onChange={(e) => {
                    const [size, sp] = e.target.value.split("@");
                    setFrame({ studs: { size: size as "2x4" | "2x6", spacingIn: Number(sp) as 16 | 24 } });
                  }}
                >
                  <option value="2x4@16">2×4 every 16&quot;</option>
                  <option value="2x6@16">2×6 every 16&quot;</option>
                  <option value="2x6@24">2×6 every 24&quot;</option>
                </select>
              </Field>
            )}
          </div>
          <details className="group rounded-xl border border-border/70 bg-background/40 px-3 py-2" data-testid="advanced-framing">
            <summary className="cursor-pointer select-none text-[12.5px] font-medium">
              Advanced framing <span className="ml-1 font-normal text-muted group-open:hidden">· {advancedSummary}</span>
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {isPost ? (
                <>
                  <Field label="Post size">
                    <select className={inputClass} value={post.size} onChange={(e) => setFrame({ post: { size: e.target.value as typeof post.size } })}>
                      <option value="4x6">4×6</option>
                      <option value="6x6">6×6</option>
                      <option value="6x8">6×8</option>
                      <option value="3ply2x6">3-ply 2×6</option>
                      <option value="3ply2x8">3-ply 2×8</option>
                    </select>
                  </Field>
                  <Field label="Post base">
                    <select className={inputClass} value={post.foundation} onChange={(e) => setFrame({ post: { foundation: e.target.value as typeof post.foundation } })}>
                      <option value="embedded">Set in the ground</option>
                      <option value="bracketPier">Bracket on a pier</option>
                      <option value="permaColumn">Precast column</option>
                    </select>
                  </Field>
                  <Field label="Girts (wall boards)">
                    <select
                      className={inputClass}
                      value={`${model.frame.girts.size}/${model.frame.girts.mount}`}
                      onChange={(e) => {
                        const [size, mount] = e.target.value.split("/");
                        setFrame({ girts: { size: size as "2x4" | "2x6", mount: mount as "face" | "bookshelf" } });
                      }}
                    >
                      <option value="2x4/face">2×4 on the face</option>
                      <option value="2x6/face">2×6 on the face</option>
                      <option value="2x4/bookshelf">2×4 bookshelf</option>
                      <option value="2x6/bookshelf">2×6 bookshelf</option>
                    </select>
                  </Field>
                  <Field label="Truss carrier (header)">
                    <select
                      className={inputClass}
                      value={`${model.frame.carrier.plies}x${model.frame.carrier.size}`}
                      onChange={(e) => {
                        const [plies, size] = e.target.value.split("x2");
                        setFrame({ carrier: { plies: Number(plies), size: `2x${size}` as "2x8" | "2x10" | "2x12" } });
                      }}
                    >
                      <option value="2x2x10">2-ply 2×10</option>
                      <option value="2x2x12">2-ply 2×12</option>
                      <option value="3x2x12">3-ply 2×12</option>
                    </select>
                  </Field>
                </>
              ) : null}
              <Field label="Truss spacing">
                <select className={inputClass} value={model.frame.trusses.spacingIn} onChange={(e) => setFrame({ trusses: { spacingIn: Number(e.target.value) } })}>
                  <option value={24}>Every 2&apos;</option>
                  <option value={48}>Every 4&apos;</option>
                  <option value={96}>Every 8&apos;</option>
                </select>
              </Field>
              <Field label="Truss heel">
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
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px]" data-testid="truss-spec">
                <dt className="text-muted">Trusses</dt>
                <dd className="font-mono">
                  {spec.count} @ {spec.spacingIn}&quot; · {formatFtIn(spec.spanFt)} span · {spec.type}
                </dd>
                {post.foundation === "embedded" ? (
                  <>
                    <dt className="text-muted">Posts</dt>
                    <dd className="font-mono">
                      {post.embedIn}&quot; deep in {post.holeDiaIn}&quot; holes · frost {model.site.frostDepthIn ?? "?"}&quot;{model.site.verified.frost ? "" : " (verify)"}
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            <p className="mt-2 text-[11px] leading-snug text-muted">Trusses are ordered from a truss plant — the span, pitch, heel and spacing above are what they quote from.</p>
          </details>
        </Section>

        <Section title="Concrete">
          <Toggle checked={slab.enabled} onChange={(v) => setSlab({ enabled: v })} label="Concrete slab under the building" testId="slab-enabled" />
          {slab.enabled ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Thickness">
                  <select className={inputClass} value={slab.thicknessIn} onChange={(e) => setSlab({ thicknessIn: Number(e.target.value) })}>
                    {[4, 5, 6].map((t) => (
                      <option key={t} value={t}>
                        {t}&quot;
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Height above ground">
                  <select className={inputClass} value={slab.aboveGradeIn} onChange={(e) => setSlab({ aboveGradeIn: Number(e.target.value) })}>
                    {[4, 6, 8, 12].map((t) => (
                      <option key={t} value={t}>
                        {t}&quot;
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Toggle checked={slab.aprons} onChange={(v) => setSlab({ aprons: v })} label={`Aprons outside big doors (${slab.apronDepthFt}' deep)`} hint="A pad outside each sliding, overhead and roll-up door." testId="slab-aprons" />
            </>
          ) : null}
        </Section>

        <Section
          title="Drains"
          aside={
            <Button variant="ghost" className="px-2 py-0.5 text-[11.5px]" onClick={autoDrainWashBays} disabled={!model.zones.some((z) => z.type === "wash")} title={model.zones.some((z) => z.type === "wash") ? "A trench drain across each wash bay and an outlet on the nearest wall" : "Add a wash bay in Layout first"} data-testid="auto-drain">
              Drain the wash bays
            </Button>
          }
        >
          <ToolRow>
            <ToolButton tool="select" icon="select" label="Select" keyHint="V" hint="Click to select · drag to move" testId="tool-select" />
            <button onClick={() => setDrainKind("floor")} aria-pressed={tool === "drain" && drainKind === "floor"} title="Click where the floor drain goes (D)" data-testid="tool-drain-floor" className={`flex min-w-[3.6rem] flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-medium transition ${tool === "drain" && drainKind === "floor" ? "border-accent bg-accent text-white" : "border-border/80 bg-background/60 text-foreground/80 hover:bg-background"}`}>
              <span className="text-[16px] leading-[18px]">◎</span>Floor drain
            </button>
            <button onClick={() => setDrainKind("trench")} aria-pressed={tool === "drain" && drainKind === "trench"} title="Click where the trench drain goes; it spans the bay it lands in" data-testid="tool-drain-trench" className={`flex min-w-[3.6rem] flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-medium transition ${tool === "drain" && drainKind === "trench" ? "border-accent bg-accent text-white" : "border-border/80 bg-background/60 text-foreground/80 hover:bg-background"}`}>
              <span className="text-[16px] leading-[18px]">▤</span>Trench drain
            </button>
            <button onClick={() => setDrainKind("outlet")} aria-pressed={tool === "drain" && drainKind === "outlet"} title="Click an outside wall where the pipe should leave" data-testid="tool-drain-outlet" className={`flex min-w-[3.6rem] flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-medium transition ${tool === "drain" && drainKind === "outlet" ? "border-accent bg-accent text-white" : "border-border/80 bg-background/60 text-foreground/80 hover:bg-background"}`}>
              <span className="text-[16px] leading-[18px]">⇢</span>Outlet
            </button>
            <ToolButton tool="erase" icon="erase" label="Remove" keyHint="E" hint="Click a drain or the outlet to remove it" testId="tool-erase" />
          </ToolRow>
          {model.drainage.drains.length === 0 ? (
            <EmptyState title="No drains yet.">Wash bays and aisles need a drain and the slab sloped to it. Pick Floor drain or Trench drain and click the plan, or press &ldquo;Drain the wash bays&rdquo;.</EmptyState>
          ) : (
            <>
              <ItemList items={[...drainage.drains.map((dd) => ({ id: dd.drain.id, label: dd.drain.label ?? (dd.drain.kind === "trench" ? "Trench drain" : "Floor drain"), detail: dd.runFt ? `${dd.runFt}' run` : "no outlet", icon: "waterer", warn: problems.has(dd.drain.id) })), ...(model.drainage.outlet ? [{ id: OUTLET_ID, label: "Outlet", detail: drainage.outlet ? `${drainage.outlet.invertIn}" down` : "", icon: "aisle", warn: problems.has(OUTLET_ID) }] : [])]} />
              {!model.drainage.outlet ? (
                <Button className="self-start px-2 py-1 text-xs" onClick={autoOutlet} data-testid="auto-outlet">
                  Place the outlet for me
                </Button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Pipe">
                  <select className={inputClass} value={model.drainage.pipeDiaIn} onChange={(e) => setDrainageOptions({ pipeDiaIn: Number(e.target.value) as 3 | 4 | 6 })}>
                    <option value={3}>3&quot; PVC</option>
                    <option value={4}>4&quot; PVC</option>
                    <option value={6}>6&quot; PVC</option>
                  </select>
                </Field>
                <Field label="Pipe fall">
                  <select className={inputClass} value={model.drainage.slopeInPerFt} onChange={(e) => setDrainageOptions({ slopeInPerFt: Number(e.target.value) })}>
                    <option value={0.125}>⅛&quot; per foot (minimum)</option>
                    <option value={0.25}>¼&quot; per foot</option>
                  </select>
                </Field>
                {model.drainage.outlet ? (
                  <>
                    <Field label="Water goes">
                      <select className={inputClass} value={model.drainage.outlet.kind} onChange={(e) => setOutlet({ kind: e.target.value as DrainOutlet["kind"] })} data-testid="outlet-kind-step">
                        {(Object.keys(OUTLET_LABEL) as DrainOutlet["kind"][]).map((k) => (
                          <option key={k} value={k}>
                            {OUTLET_LABEL[k].split(" (")[0]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Ground drops to the outlet by" hint="inches lower than at the building">
                      <input type="number" min={0} max={240} className={`${inputClass} font-mono`} value={model.drainage.siteFallIn} onChange={(e) => setDrainageOptions({ siteFallIn: Math.max(0, Number(e.target.value) || 0) })} />
                    </Field>
                  </>
                ) : null}
              </div>
              {drainage.outlet ? (
                <p className={`text-[11.5px] leading-snug ${drainage.outlet.kind === "daylight" && !drainage.outlet.daylightOk ? "text-amber-700" : "text-muted"}`} data-testid="drain-summary">
                  {drainage.pipe.totalFt}&apos; of {drainage.pipe.diaIn}&quot; pipe, {drainage.cleanouts.length} cleanout{drainage.cleanouts.length === 1 ? "" : "s"}; the pipe leaves {drainage.outlet.invertIn}&quot; below the floor
                  {drainage.outlet.kind === "daylight" ? (drainage.outlet.daylightOk ? " and clears the ground." : ` — the ground needs ${drainage.outlet.fallNeededIn}" more fall to daylight it.`) : "."}{" "}
                  <button className="text-accent underline" onClick={() => select(OUTLET_ID)}>
                    Outlet details
                  </button>
                </p>
              ) : null}
            </>
          )}
        </Section>
      </DockBody>
      <NextStep to="outside" />
    </>
  );
}
