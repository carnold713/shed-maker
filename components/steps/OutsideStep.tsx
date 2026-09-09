"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { useViewStore } from "@/lib/store/useViewStore";
import { DOOR_PALETTE, WINDOW_PALETTE, OPENING_PRESETS } from "@/lib/model/openings";
import { formatFtIn } from "@/lib/units";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { Field, inputClass, Section, Toggle } from "@/components/ui/Field";
import { CUPOLA_SIZES_IN, TRIM_STYLE_HINT, TRIM_STYLE_LABEL, WAINSCOT_LABEL, recommendedCupolaIn, ridgeLengthFt } from "@/lib/model/looks";
import type { TrimStyle } from "@/lib/model/schema";
import { Button } from "@/components/ui/Button";
import { ToolRow, ToolButton, ToolSelect, EmptyState, ItemList } from "./ToolRow";

const SIDE_NAME = { s: "South wall", e: "East wall", n: "North wall", w: "West wall" } as const;
const DOOR_GROUP: Record<string, string> = { manDoor: "Entry", doubleDoor: "Double", dutchDoor: "Stall", slidingDoor: "Sliding", overheadDoor: "Overhead", rollUpDoor: "Roll-up" };

/** Outside step (UX audit §2.5): doors, windows, lean-tos and colours. */
export function OutsideStep() {
  const model = useProjectStore((s) => s.model)!;
  const addLeanTo = useProjectStore((s) => s.addLeanTo);
  const select = useProjectStore((s) => s.select);
  const setMaterialColor = useProjectStore((s) => s.setMaterialColor);
  const setCupola = useProjectStore((s) => s.setCupola);
  const setTrimStyle = useProjectStore((s) => s.setTrimStyle);
  const setWainscot = useProjectStore((s) => s.setWainscot);
  const awningsOverDoors = useProjectStore((s) => s.awningsOverDoors);
  const lightsOverDoors = useProjectStore((s) => s.lightsOverDoors);
  const applyLook = useProjectStore((s) => s.applyLook);
  const requestFit = useViewStore((s) => s.requestFit);
  const setPreset = useViewStore((s) => s.setPreset);
  const { report } = useDerived();
  const tool = useViewStore((s) => s.tool);
  const doorKey = useViewStore((s) => s.toolDoorKey);
  const setDoorKey = useViewStore((s) => s.setToolDoorKey);
  const windowKey = useViewStore((s) => s.toolWindowKey);
  const setWindowKey = useViewStore((s) => s.setToolWindowKey);
  const problems = new Set((report?.findings ?? []).filter((f) => f.severity !== "info").flatMap((f) => f.entityIds));
  const doors = model.openings.filter((o) => o.type !== "window");
  const windows = model.openings.filter((o) => o.type === "window");
  const taken = new Set(model.leanTos.map((l) => l.side));
  const walls = model.walls.filter((w) => w.role === "exterior");

  return (
    <>
      <DockHeader step="outside" title="Outside" subtitle={[doors.length ? `${doors.length} door${doors.length > 1 ? "s" : ""}` : "", windows.length ? `${windows.length} window${windows.length > 1 ? "s" : ""}` : "", model.leanTos.length ? `${model.leanTos.length} lean-to${model.leanTos.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ") || "Doors, windows, lean-tos and colours"} icon="outside" />
      <DockBody>
        <Section title="Add">
          <ToolRow>
            <ToolButton tool="select" icon="select" label="Select" keyHint="V" hint="Click to select · drag a door along its wall" testId="tool-select" />
            <ToolButton tool="door" icon="door" label="Door" keyHint="D" hint="Pick a door, then click a wall to place it" testId="tool-door" />
            <ToolButton tool="window" icon="window" label="Window" keyHint="W" hint="Pick a window, then click a wall" testId="tool-window" />
            <ToolButton tool="leanTo" icon="leanto" label="Lean-to" keyHint="L" hint="Click a wall to add a lean-to on that side" testId="tool-leanto" />
            <ToolButton tool="erase" icon="erase" label="Remove" keyHint="E" hint="Click a door, window or lean-to to remove it" testId="tool-erase" />
          </ToolRow>
          {tool === "door" ? <ToolSelect label="Door" value={doorKey} onChange={setDoorKey} testId="door-picker" options={DOOR_PALETTE.map((d) => ({ value: d.key, label: d.label, group: DOOR_GROUP[d.type] }))} /> : null}
          {tool === "window" ? <ToolSelect label="Window" value={windowKey} onChange={setWindowKey} testId="window-picker" options={WINDOW_PALETTE.map((w) => ({ value: w.key, label: w.label }))} /> : null}
          <p className="text-[11px] leading-snug text-muted">You can also right-click any wall in the plan or the 3D view.</p>
        </Section>

        {model.openings.length === 0 ? (
          <EmptyState title="No doors yet — every barn needs at least one.">Choose Door, pick a size, then click a wall.</EmptyState>
        ) : (
          <Section title="By wall">
            {walls.map((w) => {
              const here = model.openings.filter((o) => o.wallId === w.id).sort((a, b) => a.offsetFt - b.offsetFt);
              if (here.length === 0) return null;
              return (
                <div key={w.id}>
                  <div className="mb-0.5 text-[11.5px] font-medium text-foreground/70">{SIDE_NAME[w.side ?? "s"]}</div>
                  <ItemList items={here.map((o) => ({ id: o.id, label: `${OPENING_PRESETS[o.type].label} ${formatFtIn(o.widthFt)} × ${formatFtIn(o.heightFt)}`, detail: `${formatFtIn(o.offsetFt)} in`, icon: o.type === "window" ? "window" : "door", warn: problems.has(o.id) }))} />
                </div>
              );
            })}
          </Section>
        )}

        <Section title="Lean-tos">
          {model.leanTos.length ? <ItemList items={model.leanTos.map((lt) => ({ id: lt.id, label: `${SIDE_NAME[lt.side].replace(" wall", "")} lean-to`, detail: `${lt.depthFt}' · ${lt.enclosed ? "enclosed" : "open"}`, icon: "leanto", warn: problems.has(lt.id) }))} /> : null}
          <div className="flex flex-wrap gap-1">
            {(["n", "e", "s", "w"] as const).map((side) => (
              <Button
                key={side}
                className="px-2 py-1 text-xs"
                disabled={taken.has(side)}
                title={taken.has(side) ? "This side already has one" : `Add a 10' lean-to on the ${SIDE_NAME[side].toLowerCase()}`}
                onClick={() => {
                  const id = addLeanTo({ side });
                  if (id) select(id);
                }}
                data-testid={`add-leanto-${side}`}
              >
                + {SIDE_NAME[side].replace(" wall", "")}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Looks" aside={<span className="text-[11px] text-muted">roof, trim, lights</span>}>
          <div className="flex flex-wrap gap-1">
            <Button className="px-2 py-1 text-xs" onClick={() => { applyLook("classic"); setPreset("exterior"); requestFit(); }} title="Cupola and weathervane, awnings with timber brackets over the doors, craftsman trim, stone wainscot, gooseneck lights, standing-seam roof" data-testid="look-classic">
              Classic barn look
            </Button>
            <Button className="px-2 py-1 text-xs" onClick={() => applyLook("plain")} data-testid="look-plain">
              Plain
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cupola" hint={model.roof.cupola.enabled ? `About ${recommendedCupolaIn(ridgeLengthFt(model))}" suits a ${Math.round(ridgeLengthFt(model))}' ridge.` : "A vented cupola on the ridge, like the photo."}>
              <select className={inputClass} value={model.roof.cupola.enabled ? String(model.roof.cupola.sizeIn) : "0"} onChange={(e) => { const v = Number(e.target.value); setCupola(v ? { enabled: true, sizeIn: v } : { enabled: false }); if (v) setPreset("exterior"); }} data-testid="cupola-size">
                <option value="0">None</option>
                {CUPOLA_SIZES_IN.map((s) => (
                  <option key={s} value={s}>
                    {s}&quot; cupola{s === recommendedCupolaIn(ridgeLengthFt(model)) ? " · suits this roof" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="How many">
              <select className={inputClass} value={model.roof.cupola.count} onChange={(e) => setCupola({ count: Number(e.target.value) })} disabled={!model.roof.cupola.enabled} data-testid="cupola-count">
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {model.roof.cupola.enabled ? (
            <div className="grid grid-cols-2 gap-2">
              <Toggle checked={model.roof.cupola.weathervane} onChange={(v) => setCupola({ weathervane: v })} label="Weathervane on top" testId="cupola-vane" />
              <Field label="Sides">
                <select className={inputClass} value={model.roof.cupola.style} onChange={(e) => setCupola({ style: e.target.value as "louvered" | "windowed" })}>
                  <option value="louvered">Louvered (vents the roof)</option>
                  <option value="windowed">Windowed</option>
                </select>
              </Field>
            </div>
          ) : null}
          <Field label="Trim around doors and windows" hint={TRIM_STYLE_HINT[model.materials.trimStyle]}>
            <select className={inputClass} value={model.materials.trimStyle} onChange={(e) => setTrimStyle(e.target.value as TrimStyle)} data-testid="trim-style">
              {(Object.keys(TRIM_STYLE_LABEL) as TrimStyle[]).map((t) => (
                <option key={t} value={t}>
                  {TRIM_STYLE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Wainscot" hint="A band along the bottom of the walls: stone like the photo, boards, or a second steel colour.">
              <select className={inputClass} value={model.materials.wainscot.enabled ? model.materials.wainscot.kind : "none"} onChange={(e) => { const v = e.target.value; setWainscot(v === "none" ? { enabled: false } : { enabled: true, kind: v as "steel" | "stone" | "board" }); }} data-testid="wainscot-kind">
                <option value="none">None</option>
                {(Object.keys(WAINSCOT_LABEL) as (keyof typeof WAINSCOT_LABEL)[]).map((k) => (
                  <option key={k} value={k}>
                    {WAINSCOT_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Height">
              <select className={inputClass} value={model.materials.wainscot.heightFt} onChange={(e) => setWainscot({ heightFt: Number(e.target.value) })} disabled={!model.materials.wainscot.enabled} data-testid="wainscot-height">
                {[2, 2.5, 3, 3.5, 4].map((h) => (
                  <option key={h} value={h}>
                    {formatFtIn(h)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button className="px-2 py-1 text-xs" onClick={awningsOverDoors} title="A bracketed roof over every door that has none; edit each one from its door" data-testid="awnings-all">
              Awning over every door
            </Button>
            <Button className="px-2 py-1 text-xs" onClick={lightsOverDoors} title="A gooseneck light centred over each big door and a lantern beside each entry door (wired in the Electrical step)" data-testid="lights-all-doors">
              Lights over every door
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted">{doors.filter((o) => o.awning).length ? `${doors.filter((o) => o.awning).length} of ${doors.length} doors have an awning · ` : ""}{model.electrical.fixtures.filter((f) => f.kind === "gooseneck" || f.kind === "lantern").length} door lights. Click a door in the plan to change its own awning.</p>
        </Section>

        <Section title="Colours">
          <div className="grid grid-cols-3 gap-2">
            {(["sidingColor", "roofColor", "trimColor"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-xs">
                <span className="text-muted">{k === "sidingColor" ? "Siding" : k === "roofColor" ? "Roof" : "Trim"}</span>
                <input type="color" value={model.materials[k]} onChange={(e) => setMaterialColor(k, e.target.value)} className="h-8 w-full cursor-pointer rounded-lg border border-border bg-panel" aria-label={`${k === "sidingColor" ? "Siding" : k === "roofColor" ? "Roof" : "Trim"} colour`} />
              </label>
            ))}
            {model.materials.wainscot.enabled && model.materials.wainscot.kind !== "stone" ? (
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted">Wainscot</span>
                <input type="color" value={model.materials.wainscot.color} onChange={(e) => setWainscot({ color: e.target.value })} className="h-8 w-full cursor-pointer rounded-lg border border-border bg-panel" aria-label="Wainscot colour" />
              </label>
            ) : null}
          </div>
        </Section>
      </DockBody>
      <NextStep to="electrical" />
    </>
  );
}
