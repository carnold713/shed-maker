"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { zoneRect, ZONE_TYPE_LABEL } from "@/lib/model/zones";
import type { Species, ZoneType } from "@/lib/model/schema";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { formatFtIn } from "@/lib/units";
import { Panel } from "@/components/ui/Panel";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { FtInput } from "./Inspector";

const TYPES: ZoneType[] = ["pen", "kidding", "aisle", "tack", "feed", "hay", "wash", "equipment", "office", "utility", "milking", "restroom", "open"];

export function ZoneInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const updateZone = useProjectStore((s) => s.updateZone);
  const removeZone = useProjectStore((s) => s.removeZone);
  const duplicateZone = useProjectStore((s) => s.duplicateZone);
  const splitZone = useProjectStore((s) => s.splitZone);
  const setOutsideAccess = useProjectStore((s) => s.setOutsideAccess);
  const select = useProjectStore((s) => s.select);
  const autoGrow = useViewStore((s) => s.autoGrow);
  const z = model.zones.find((x) => x.id === id);
  if (!z) return null;
  const r = zoneRect(z);
  const preset = z.species ? SPECIES_PRESETS[z.species] : null;
  const isPen = z.type === "pen" || z.type === "kidding";
  const setRect = (patch: Partial<typeof r>) => updateZone(z.id, { rect: { ...r, ...patch }, autoGrow });

  return (
    <Panel title={`${ZONE_TYPE_LABEL[z.type]}`}>
      <Field label="Name">
        <input className={inputClass} defaultValue={z.name} key={z.id + z.name} onBlur={(e) => updateZone(z.id, { name: e.target.value.trim() || z.name })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} data-testid="zone-name" />
      </Field>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Type">
          <select className={inputClass} value={z.type} onChange={(e) => updateZone(z.id, { type: e.target.value as ZoneType })} data-testid="zone-type">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {ZONE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        {isPen ? (
          <Field label="Species">
            <select className={inputClass} value={z.species ?? "horse"} onChange={(e) => updateZone(z.id, { species: e.target.value as Species })} data-testid="zone-species">
              {PEN_SPECIES.map((sp) => (
                <option key={sp} value={sp}>
                  {SPECIES_PRESETS[sp].label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Width (E–W)">
          <FtInput value={r.w} min={1} max={200} onCommit={(v) => setRect({ w: v })} testId="zone-width" />
        </Field>
        <Field label="Depth (N–S)">
          <FtInput value={r.d} min={1} max={200} onCommit={(v) => setRect({ d: v })} testId="zone-depth" />
        </Field>
        <Field label="From west">
          <FtInput value={r.x} min={0} max={200} onCommit={(v) => setRect({ x: v })} />
        </Field>
        <Field label="From south">
          <FtInput value={r.y} min={0} max={200} onCommit={(v) => setRect({ y: v })} />
        </Field>
        {isPen && preset?.groupSqFtPerHead ? (
          <Field label="Head count" hint={`${preset.groupSqFtPerHead} sq ft/head`}>
            <input type="number" min={0} className={inputClass} value={z.headCount ?? ""} onChange={(e) => updateZone(z.id, { headCount: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
        ) : null}
        <Field label="Flooring">
          <select className={inputClass} value={z.flooring} onChange={(e) => updateZone(z.id, { flooring: e.target.value as typeof z.flooring })}>
            <option value="concrete">Concrete</option>
            <option value="concreteMats">Concrete + rubber mats</option>
            <option value="gravel">Compacted gravel</option>
            <option value="dirt">Dirt</option>
            <option value="wood">Wood</option>
          </select>
        </Field>
      </div>
      {isPen && preset ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {[preset.minPen, preset.recommendedPen, [preset.recommendedPen[0], preset.recommendedPen[1] + 4] as [number, number]].map(([w, d], i) => (
            <button key={i} onClick={() => setRect({ w, d })} className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${Math.abs(w - r.w) < 1e-6 && Math.abs(d - r.d) < 1e-6 ? "border-accent bg-accent/10" : "border-border hover:bg-background"}`} title={i === 0 ? "species minimum" : i === 1 ? "recommended" : "foaling / large"}>
              {w}×{d}
            </button>
          ))}
        </div>
      ) : null}
      {z.type === "pen" ? (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={z.outsideAccess} onChange={(e) => setOutsideAccess(z.id, e.target.checked)} data-testid="zone-outside" />
          Outside access <span className="text-xs text-muted">(Dutch door on the exterior wall it touches)</span>
        </label>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1">
        <Button className="px-2 py-1 text-xs" onClick={() => duplicateZone(z.id, model.roof.ridgeAxis === "ns" ? "n" : "e")} title="Duplicate along the bays (D)">
          Duplicate
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={() => splitZone(z.id, 2)}>
          Split in 2
        </Button>
        <Button className="px-2 py-1 text-xs text-red-700" onClick={() => removeZone(z.id)} data-testid="zone-delete">
          Delete
        </Button>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted">
        {formatFtIn(r.w)} × {formatFtIn(r.d)} = {(r.w * r.d).toFixed(0)} sq ft
        {preset ? ` · ${preset.label}: min ${preset.minPen.join("×")}, recommended ${preset.recommendedPen.join("×")}, kick-wall ${preset.kickWallFt}', door ${preset.doorFt}'` : ""}
      </p>
      <button className="mt-2 text-xs text-accent underline" onClick={() => select("footprint")}>
        ← Building
      </button>
    </Panel>
  );
}

/** Interior tools on the building inspector: layout generators, envelope fitting. */
export function InteriorPanel() {
  const model = useProjectStore((s) => s.model)!;
  const applyLayout = useProjectStore((s) => s.applyLayout);
  const fitEnvelope = useProjectStore((s) => s.fitEnvelopeToZones);
  const growToFit = useProjectStore((s) => s.growToFitZones);
  const species = useViewStore((s) => s.toolSpecies) as Species;
  const setSpecies = useViewStore((s) => s.setToolSpecies);
  const setTool = useViewStore((s) => s.setTool);
  const pens = model.zones.filter((z) => z.type === "pen").length;
  return (
    <Panel title={`Interior · ${model.zones.length} zones · ${pens} pens`}>
      <p className="text-xs text-muted">Draw pens, aisles and rooms on the plan with the tools at its top-left (P / A / R), or start from a pattern:</p>
      <div className="mt-2 flex items-center gap-2">
        <select className={inputClass} value={species} onChange={(e) => { setSpecies(e.target.value); setTool("select"); }} data-testid="layout-species">
          {PEN_SPECIES.map((sp) => (
            <option key={sp} value={sp}>
              {SPECIES_PRESETS[sp].label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button className="px-2 py-1 text-xs" onClick={() => applyLayout("centerAisle", { species })} data-testid="layout-center-aisle">
          Center aisle
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={() => applyLayout("centerAisle", { species, supportBays: 1 })}>
          Center aisle + tack
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={() => applyLayout("shedRow", { species })} data-testid="layout-shed-row">
          Shed row
        </Button>
        <Button className="px-2 py-1 text-xs text-red-700" onClick={() => applyLayout("clear")} disabled={model.zones.length === 0}>
          Clear
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        <Button className="px-2 py-1 text-xs" onClick={fitEnvelope} disabled={model.zones.length === 0} title="Shrink-wrap the walls to the interior on the framing modules" data-testid="fit-envelope">
          Fit building to interior
        </Button>
        <Button className="px-2 py-1 text-xs" onClick={growToFit} disabled={model.zones.length === 0}>
          Grow to fit
        </Button>
      </div>
    </Panel>
  );
}
