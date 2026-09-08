"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { useViewStore } from "@/lib/store/useViewStore";
import { deriveElectrical } from "@/lib/electrical/derive";
import { FIXTURE_PRESETS, PLACEABLE_FIXTURE_KINDS } from "@/lib/model/electrical";
import type { FixtureKind } from "@/lib/model/schema";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { Field, inputClass, Section } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ToolRow, ToolButton, ToolSelect, EmptyState, ItemList } from "./ToolRow";

const ICON: Record<FixtureKind, string> = { light: "light", floodlight: "light", outlet: "outlet", switch: "switch", panel: "panel", fan: "fan", waterer: "waterer", heater: "heater" };

/** Electrical step (ADR-0013): place lights, outlets and the panel; the tool works out circuits, loads and wire. */
export function ElectricalStep() {
  const model = useProjectStore((s) => s.model)!;
  const setService = useProjectStore((s) => s.setElectricalService);
  const setWiring = useProjectStore((s) => s.setWiringMethod);
  const autoLightAll = useProjectStore((s) => s.autoLightAll);
  const autoPlacePanel = useProjectStore((s) => s.autoPlacePanel);
  const { report } = useDerived();
  const tool = useViewStore((s) => s.tool);
  const kind = useViewStore((s) => s.toolFixtureKind) as FixtureKind;
  const setKind = useViewStore((s) => s.setToolFixtureKind);
  const e = useMemo(() => deriveElectrical(model), [model]);
  const problems = new Set((report?.findings ?? []).filter((f) => f.severity !== "info").flatMap((f) => f.entityIds));
  const fixtures = model.electrical.fixtures;
  const counts = new Map<FixtureKind, number>();
  for (const f of fixtures) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  const summary = [...counts.entries()].map(([k, n]) => `${n} ${FIXTURE_PRESETS[k].short.toLowerCase()}${n > 1 ? "s" : ""}`).join(" · ");
  const underLit = e.zoneLighting.filter((z) => z.moreLights > 0 && z.type !== "open").length;
  const util = e.load.utilisationPct;

  return (
    <>
      <DockHeader step="electrical" title="Electrical" subtitle={summary || "Lights, outlets, switches and the panel"} icon="bolt" />
      <DockBody>
        <Section
          title="Add"
          aside={
            <Button variant="ghost" className="px-2 py-0.5 text-[11.5px]" onClick={autoLightAll} disabled={model.zones.length === 0} title={model.zones.length === 0 ? "Add stalls or rooms first" : "Puts enough LED strips in every stall, aisle and room, and places the panel"} data-testid="auto-light-all">
              Light everything
            </Button>
          }
        >
          <ToolRow>
            <ToolButton tool="select" icon="select" label="Select" keyHint="V" hint="Click to select · drag to move" testId="tool-select" />
            <ToolButton tool="fixture" icon={ICON[kind]} label={FIXTURE_PRESETS[kind].short} keyHint="L" hint={FIXTURE_PRESETS[kind].hint} testId="tool-fixture" />
            <ToolButton tool="erase" icon="erase" label="Remove" keyHint="E" hint="Click a light, outlet or switch to remove it" testId="tool-erase" />
          </ToolRow>
          {tool === "fixture" ? <ToolSelect label="Place" value={kind} onChange={(v) => setKind(v)} testId="fixture-picker" options={PLACEABLE_FIXTURE_KINDS.map((k) => ({ value: k, label: FIXTURE_PRESETS[k].label }))} /> : null}
          {tool === "fixture" ? <p className="text-[11px] leading-snug text-muted">{FIXTURE_PRESETS[kind].hint}</p> : null}
        </Section>

        <Section title="Power">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Panel size">
              <select className={inputClass} value={model.electrical.service.amps} onChange={(ev) => setService({ amps: Number(ev.target.value) })} data-testid="service-amps">
                {[60, 100, 125, 150, 200].map((a) => (
                  <option key={a} value={a}>
                    {a} A
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Feed from">
              <select className={inputClass} value={model.electrical.service.feedFrom} onChange={(ev) => setService({ feedFrom: ev.target.value as "housePanel" | "meter" })}>
                <option value="housePanel">House panel</option>
                <option value="meter">Its own meter</option>
              </select>
            </Field>
            <Field label="Feeder run (ft)" hint="One way, from the house or meter">
              <input type="number" min={0} max={2000} className={`${inputClass} font-mono`} value={model.electrical.service.feederLengthFt} onChange={(ev) => setService({ feederLengthFt: Math.max(0, Number(ev.target.value) || 0) })} />
            </Field>
            <Field label="Wiring inside">
              <select className={inputClass} value={model.electrical.wiring} onChange={(ev) => setWiring(ev.target.value as "pvcConduit" | "ufCable" | "mcCable")}>
                <option value="pvcConduit">Cable in PVC conduit</option>
                <option value="ufCable">UF cable, exposed above 7&apos;6&quot;</option>
                <option value="mcCable">Jacketed MC cable</option>
              </select>
            </Field>
          </div>
          {fixtures.length ? (
            <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-[12px]" data-testid="load-summary">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Demand {e.load.demandAmps} A of {e.load.serviceAmps} A</span>
                <span className={util > 100 ? "text-red-700" : util > 80 ? "text-amber-700" : "text-emerald-700"}>{util}% used</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full ${util > 100 ? "bg-red-500" : util > 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, util)}%` }} />
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted">
                <dt>Connected</dt>
                <dd className="font-mono text-foreground">{e.load.connectedWatts.toLocaleString()} W</dd>
                <dt>Circuits</dt>
                <dd className="font-mono text-foreground">{e.circuits.length} · {e.load.breakerSpaces} spaces of {e.load.panelSpaces}</dd>
                <dt>Feeder</dt>
                <dd className="font-mono text-foreground">{e.load.feederAwg} Cu ({e.load.feederAlAwg} Al) · {e.load.feederDropPct}% drop</dd>
                <dt>Panel</dt>
                <dd className="text-foreground">{e.panel.placed ? "placed" : <button className="text-accent underline" onClick={autoPlacePanel} data-testid="place-panel">place it for me</button>}</dd>
              </dl>
            </div>
          ) : null}
        </Section>

        {fixtures.length === 0 ? (
          <EmptyState title="Nothing wired yet.">Press &ldquo;Light everything&rdquo; for a sensible start, or choose Light and click where it goes. Outlets and switches snap to the nearest wall.</EmptyState>
        ) : (
          <>
            <Section title={`Circuits (${e.circuits.length})`}>
              <table className="w-full text-[11.5px]" data-testid="circuit-table">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="font-medium">#</th>
                    <th className="font-medium">Serves</th>
                    <th className="text-right font-medium">Breaker</th>
                    <th className="text-right font-medium">Wire</th>
                    <th className="text-right font-medium">Run</th>
                  </tr>
                </thead>
                <tbody>
                  {e.circuits.map((c) => (
                    <tr key={c.id} className="border-t border-border/50">
                      <td className="py-1 font-mono">{c.label}</td>
                      <td className="py-1">
                        {c.fixtureIds.length} {c.kind === "lighting" ? "light" : c.kind === "receptacle" ? "outlet" : c.kind === "fan" ? "fan" : c.kind === "waterer" ? "waterer" : "heater"}
                        {c.fixtureIds.length > 1 ? "s" : ""}
                        {c.gfci ? " · GFCI" : ""}
                      </td>
                      <td className="py-1 text-right font-mono">
                        {c.breakerAmps} A{c.poles === 2 ? " 2-pole" : ""}
                      </td>
                      <td className="py-1 text-right font-mono">{c.wireAwg} AWG</td>
                      <td className="py-1 text-right font-mono">{Math.round(c.runFt)}&apos;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section title="Light levels" aside={underLit ? <span className="text-[11px] text-amber-700">{underLit} under target</span> : <span className="text-[11px] text-emerald-700">all on target</span>}>
              <ItemList items={e.zoneLighting.filter((z) => z.type !== "open").map((z) => ({ id: z.zoneId, label: z.name, detail: `${z.estimatedFc} / ${z.targetFc} fc`, icon: "light", warn: z.moreLights > 0 }))} />
            </Section>
            <Section title="Fixtures">
              <ItemList items={fixtures.map((f) => ({ id: f.id, label: f.label ?? FIXTURE_PRESETS[f.kind].short, detail: f.watts ? `${f.watts} W` : `${f.mountFt}'`, icon: ICON[f.kind], warn: problems.has(f.id) }))} />
            </Section>
          </>
        )}
        <p className="text-[11px] leading-relaxed text-muted">Planning figures only — a licensed electrician sizes the final circuits and your building department inspects them.</p>
      </DockBody>
      <NextStep to="check" />
    </>
  );
}
