"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { FIXTURE_PRESETS, PLACEABLE_FIXTURE_KINDS, switchedLights } from "@/lib/model/electrical";
import { deriveElectrical, circuitOf } from "@/lib/electrical/derive";
import type { FixtureKind } from "@/lib/model/schema";
import { Field, inputClass, Section } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";

const ICON: Record<FixtureKind, string> = { light: "light", floodlight: "light", gooseneck: "light", lantern: "light", outlet: "outlet", switch: "switch", panel: "panel", fan: "fan", waterer: "waterer", heater: "heater" };

export function FixtureInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const update = useProjectStore((s) => s.updateFixture);
  const remove = useProjectStore((s) => s.removeFixture);
  const rotate = useProjectStore((s) => s.rotateFixture);
  const e = useMemo(() => deriveElectrical(model), [model]);
  const f = model.electrical.fixtures.find((x) => x.id === id);
  if (!f) return null;
  const preset = FIXTURE_PRESETS[f.kind];
  const circuit = circuitOf(e, f.id);
  const wall = f.wallId ? model.walls.find((w) => w.id === f.wallId) : undefined;
  const where = wall ? `${{ n: "north", s: "south", e: "east", w: "west" }[wall.side ?? "s"]} wall` : f.facing ? "inside wall" : "ceiling";
  const controlled = f.kind === "switch" ? switchedLights(model, f.id) : [];
  const lights = model.electrical.fixtures.filter((x) => x.kind === "light" || x.kind === "floodlight");
  const switches = model.electrical.fixtures.filter((x) => x.kind === "switch");
  return (
    <>
      <DockHeader back="electrical" title={f.label ?? preset.label} subtitle={`${preset.short} · ${where} · ${f.mountFt}' up${circuit ? ` · circuit ${circuit.label}` : ""}`} icon={ICON[f.kind]} />
      <DockBody>
        <Section title="What it is">
          <Field label="Kind" hint={preset.hint}>
            <select className={inputClass} value={f.kind} onChange={(ev) => update(f.id, { kind: ev.target.value as FixtureKind })} data-testid="fixture-kind" disabled={f.kind === "panel"}>
              {(f.kind === "panel" ? ["panel"] : PLACEABLE_FIXTURE_KINDS.filter((k) => k !== "panel")).map((k) => (
                <option key={k} value={k}>
                  {FIXTURE_PRESETS[k as FixtureKind].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label">
            <input className={inputClass} defaultValue={f.label ?? ""} key={f.id + (f.label ?? "")} placeholder={preset.short} onBlur={(ev) => update(f.id, { label: ev.target.value.trim() || undefined })} onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {f.kind !== "switch" && f.kind !== "panel" ? (
              <Field label="Load (watts)" hint={f.kind === "outlet" ? "Counted at 180 VA per outlet" : undefined}>
                <input type="number" min={0} max={20000} className={`${inputClass} font-mono`} value={f.watts} onChange={(ev) => update(f.id, { watts: Number(ev.target.value) || 0 })} data-testid="fixture-watts" />
              </Field>
            ) : null}
            <Field label="Height up the wall">
              <FtInput value={f.mountFt} min={0} max={model.eaveHeightFt} onCommit={(v) => update(f.id, { mountFt: v })} testId="fixture-mount" />
            </Field>
          </div>
          {f.kind === "light" ? (
            <Field label="Runs" hint="R turns the selected light">
              <div className="flex gap-1">
                <select className={inputClass} value={f.rotationDeg % 180} onChange={(ev) => update(f.id, { rotationDeg: Number(ev.target.value) })} data-testid="fixture-rotation">
                  <option value={0}>East–west</option>
                  <option value={90}>North–south</option>
                </select>
                <Button className="shrink-0 px-2 py-1 text-xs" onClick={() => rotate(f.id)} data-testid="fixture-rotate">
                  Rotate
                </Button>
              </div>
            </Field>
          ) : null}
          {f.kind === "light" || f.kind === "floodlight" ? (
            <Field label="Switched from">
              <select className={inputClass} value={f.switchId ?? ""} onChange={(ev) => update(f.id, { switchId: ev.target.value || undefined })}>
                <option value="">— any switch on the circuit —</option>
                {switches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ?? `Switch at ${s.x}', ${s.y}'`}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {f.kind === "switch" ? (
            <div className="flex flex-col gap-1" data-testid="switch-controls">
              <span className="text-[12.5px] font-medium text-foreground/85">Controls</span>
              {lights.length === 0 ? <p className="text-[11.5px] text-muted">No lights yet.</p> : null}
              {lights.map((l) => {
                const on = controlled.some((x) => x.id === l.id);
                const explicit = l.switchId === f.id;
                return (
                  <label key={l.id} className="flex items-center gap-2 text-[12.5px]">
                    <input type="checkbox" checked={on} onChange={(ev) => update(l.id, { switchId: ev.target.checked ? f.id : undefined })} />
                    <span className="flex-1 truncate">{l.label ?? FIXTURE_PRESETS[l.kind].short}</span>
                    {on && !explicit ? <span className="text-[10.5px] text-muted">nearest switch</span> : null}
                  </label>
                );
              })}
              <p className="text-[11px] leading-snug text-muted">Unassigned lights follow their nearest switch. The dotted lines on the plan show the switch legs; wire them 3-way where an aisle has a switch at both ends.</p>
            </div>
          ) : null}
        </Section>
        {circuit ? (
          <Section title={`Circuit ${circuit.label}`}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
              <dt className="text-muted">Breaker</dt>
              <dd className="font-mono">
                {circuit.breakerAmps} A {circuit.volts} V{circuit.poles === 2 ? " 2-pole" : ""}
                {circuit.gfci ? " · GFCI" : ""}
              </dd>
              <dt className="text-muted">Wire</dt>
              <dd className="font-mono">{circuit.wireAwg} AWG copper</dd>
              <dt className="text-muted">Load</dt>
              <dd className="font-mono">
                {circuit.connectedWatts} W · {circuit.loadAmps} A
              </dd>
              <dt className="text-muted">Run</dt>
              <dd className="font-mono">
                {circuit.runFt}&apos; · {circuit.voltageDropPct}% drop
              </dd>
              <dt className="text-muted">Shares with</dt>
              <dd>{circuit.fixtureIds.length - 1} other{circuit.fixtureIds.length - 1 === 1 ? "" : "s"}</dd>
            </dl>
          </Section>
        ) : null}
        <Button className="self-start px-2 py-1 text-xs text-red-700" onClick={() => remove(f.id)} data-testid="fixture-delete">
          Delete
        </Button>
      </DockBody>
    </>
  );
}
