"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { zoneRect, ZONE_TYPE_LABEL, exteriorEdgesOf, isExteriorSide } from "@/lib/model/zones";
import type { Species, ZoneType } from "@/lib/model/schema";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { interiorDoors } from "@/lib/interior/partitions";
import { INTERIOR_DOOR_PRESETS, defaultExteriorDoorSpec, endDoorsLabel } from "@/lib/model/interiorDoors";
import { OPENING_PRESETS } from "@/lib/model/openings";
import { EXTERIOR_WALL_IDS } from "@/lib/model/walls";
import { formatFtIn } from "@/lib/units";
import { Field, inputClass, Section, Toggle } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";
import { ItemList } from "@/components/steps/ToolRow";

const TYPES: ZoneType[] = ["pen", "kidding", "aisle", "tack", "feed", "hay", "wash", "equipment", "office", "utility", "milking", "restroom", "open"];
const SIDE = { n: "north", s: "south", e: "east", w: "west" } as const;

export function ZoneInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const updateZone = useProjectStore((s) => s.updateZone);
  const removeZone = useProjectStore((s) => s.removeZone);
  const duplicateZone = useProjectStore((s) => s.duplicateZone);
  const splitZone = useProjectStore((s) => s.splitZone);
  const setOutsideAccess = useProjectStore((s) => s.setOutsideAccess);
  const setAutoDoor = useProjectStore((s) => s.setAutoDoor);
  const addInteriorDoor = useProjectStore((s) => s.addInteriorDoor);
  const addZoneDoor = useProjectStore((s) => s.addZoneDoor);
  const addEndDoors = useProjectStore((s) => s.addEndDoors);
  const select = useProjectStore((s) => s.select);
  const autoGrow = useViewStore((s) => s.autoGrow);
  const setTool = useViewStore((s) => s.setTool);
  const z = model.zones.find((x) => x.id === id);
  if (!z) return null;
  const r = zoneRect(z);
  const preset = z.species ? SPECIES_PRESETS[z.species] : null;
  const isPen = z.type === "pen" || z.type === "kidding";
  const setRect = (patch: Partial<typeof r>) => updateZone(z.id, { rect: { ...r, ...patch }, autoGrow });
  const doors = interiorDoors(model).filter((d) => d.door.zoneId === z.id);
  const exteriorEdges = exteriorEdgesOf(model, z);
  // Outside doors sitting on this zone's edge of an exterior wall.
  const outsideDoors = model.openings.filter((o) => {
    const e = exteriorEdges.find((x) => EXTERIOR_WALL_IDS[x.side] === o.wallId);
    if (!e) return false;
    const half = e.lengthFt / 2;
    return o.offsetFt + o.widthFt > e.centerFt - half + 1e-6 && o.offsetFt < e.centerFt + half - 1e-6 && o.type !== "window";
  });
  const isAisle = z.type === "aisle";
  const endLabel = endDoorsLabel(model, z);
  const along = model.roof.ridgeAxis === "ns" ? "n" : "e";

  return (
    <>
      <DockHeader back="layout" title={z.name} subtitle={`${ZONE_TYPE_LABEL[z.type]} · ${formatFtIn(r.w)} × ${formatFtIn(r.d)} · ${(r.w * r.d).toFixed(0)} sq ft`} icon={z.type === "aisle" ? "aisle" : isPen ? "stall" : "room"} />
      <DockBody>
        <Section title="What it is">
          <Field label="Name">
            <input className={inputClass} defaultValue={z.name} key={z.id + z.name} onBlur={(e) => updateZone(z.id, { name: e.target.value.trim() || z.name })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} data-testid="zone-name" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kind">
              <select className={inputClass} value={z.type} onChange={(e) => updateZone(z.id, { type: e.target.value as ZoneType })} data-testid="zone-type">
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ZONE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            {isPen ? (
              <Field label="Animal" hint="Sets the stall size and door width">
                <select className={inputClass} value={z.species ?? "horse"} onChange={(e) => updateZone(z.id, { species: e.target.value as Species })} data-testid="zone-species">
                  {PEN_SPECIES.map((sp) => (
                    <option key={sp} value={sp}>
                      {SPECIES_PRESETS[sp].label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {isPen && preset?.groupSqFtPerHead ? (
              <Field label="How many animals" hint={`${preset.groupSqFtPerHead} sq ft each`}>
                <input type="number" min={0} className={inputClass} value={z.headCount ?? ""} onChange={(e) => updateZone(z.id, { headCount: e.target.value ? Number(e.target.value) : undefined })} />
              </Field>
            ) : null}
            <Field label="Floor">
              <select className={inputClass} value={z.flooring} onChange={(e) => updateZone(z.id, { flooring: e.target.value as typeof z.flooring })}>
                <option value="concrete">Concrete</option>
                <option value="concreteMats">Concrete + rubber mats</option>
                <option value="gravel">Packed gravel</option>
                <option value="dirt">Dirt</option>
                <option value="wood">Wood</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Size">
          {isPen && preset ? (
            <div className="flex flex-wrap gap-1">
              {[
                { s: preset.minPen, t: "Minimum" },
                { s: preset.recommendedPen, t: "Recommended" },
                { s: [preset.recommendedPen[0], preset.recommendedPen[1] + 4] as [number, number], t: z.species === "horse" ? "Foaling" : "Large" },
              ].map(({ s: [w, d], t }) => (
                <button key={t} onClick={() => setRect({ w, d })} className={`rounded-lg border px-2 py-0.5 text-[11.5px] ${Math.abs(w - r.w) < 1e-6 && Math.abs(d - r.d) < 1e-6 ? "border-accent bg-accent/10" : "border-border hover:bg-background"}`}>
                  {t} <span className="font-mono">{w} × {d}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (east–west)">
              <FtInput value={r.w} min={1} max={200} onCommit={(v) => setRect({ w: v })} testId="zone-width" />
            </Field>
            <Field label="Length (north–south)">
              <FtInput value={r.d} min={1} max={200} onCommit={(v) => setRect({ d: v })} testId="zone-depth" />
            </Field>
          </div>
          <details className="text-[12px]">
            <summary className="cursor-pointer select-none text-muted">Position</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="From the west wall">
                <FtInput value={r.x} min={0} max={200} onCommit={(v) => setRect({ x: v })} />
              </Field>
              <Field label="From the south wall">
                <FtInput value={r.y} min={0} max={200} onCommit={(v) => setRect({ y: v })} />
              </Field>
            </div>
          </details>
        </Section>

        {z.type !== "open" || exteriorEdges.length ? (
          <Section
            title="Doors"
            aside={
              <button className="text-[11.5px] text-accent underline" onClick={() => setTool("interiorDoor")} title={isAisle ? "Then click an end of the aisle or a wall beside it in the plan" : "Then click one of this stall's walls in the plan"}>
                + Add a door
              </button>
            }
          >
            {isAisle ? (
              endLabel ? (
                <Button className="px-2 py-1 text-xs" onClick={() => { const ids = addEndDoors(z.id); if (ids[0]) select(ids[0]); }} title="Sliding doors sized to the aisle on the outside walls it reaches" data-testid="aisle-end-doors">
                  {endLabel}
                </Button>
              ) : (
                <p className="text-[12px] text-muted">Neither end reaches an outside wall. Stretch the aisle to the wall to put a sliding door there.</p>
              )
            ) : null}
            {outsideDoors.length ? (
              <ItemList items={outsideDoors.map((o) => ({ id: o.id, label: `${OPENING_PRESETS[o.type].label} ${formatFtIn(o.widthFt)} × ${formatFtIn(o.heightFt)}`, detail: `outside wall · ${SIDE[o.wallId.slice(-1) as keyof typeof SIDE]}`, icon: "door" }))} />
            ) : null}
            {doors.length ? (
              <ItemList
                items={doors.map(({ door, partition }) => {
                  const vertical = Math.abs(partition.x1 - partition.x0) < 1e-9;
                  const side = vertical ? (door.zoneSide === -1 ? "e" : "w") : door.zoneSide === -1 ? "n" : "s";
                  return { id: door.auto ? `${z.id}` : door.id, label: `${INTERIOR_DOOR_PRESETS[door.type].label}${door.auto ? " (default)" : ""}`, detail: `${SIDE[side]} · ${formatFtIn(door.widthFt)}`, icon: "door" };
                })}
              />
            ) : !outsideDoors.length ? (
              <p className="text-[12px] text-muted">{isAisle ? "No doors yet. Aisles usually get a sliding door at each end." : `No door.${z.autoDoor && !isAisle ? " It doesn't touch an aisle yet." : ""}`}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-1" data-testid="zone-door-sides">
              <span className="text-[11px] text-muted">Add on the</span>
              {(["n", "e", "s", "w"] as const).map((side) => {
                const outside = isExteriorSide(model, z, side);
                const spec = outside ? defaultExteriorDoorSpec(model, z, side === "n" || side === "s" ? r.w : r.d) : null;
                return (
                  <Button key={side} className="px-2 py-1 text-xs" onClick={() => { const nid = addZoneDoor({ zoneId: z.id, side }); if (nid) select(nid); }} title={outside ? `Outside wall: adds a ${OPENING_PRESETS[spec!.type].label.toLowerCase()} ${formatFtIn(spec!.widthFt)} wide` : "Inside wall: adds this space's usual door, centred on that side"} data-testid={`zone-door-${side}`}>
                    {SIDE[side]}{outside ? " ⌂" : ""}
                  </Button>
                );
              })}
            </div>
            {doors.some((d) => d.door.auto) ? (
              <div className="flex flex-wrap gap-1">
                <Button className="px-2 py-1 text-xs" onClick={() => { const d = doors[0]; const vertical = Math.abs(d.partition.x1 - d.partition.x0) < 1e-9; const side = vertical ? (d.door.zoneSide === -1 ? "e" : "w") : d.door.zoneSide === -1 ? "n" : "s"; const id = addInteriorDoor({ zoneId: z.id, side, offsetFt: d.door.u + (vertical ? d.partition.y0 - r.y : d.partition.x0 - r.x), type: d.door.type }); if (id) select(id); }} title="Turn the default door into one you can move and change">
                  Edit this door
                </Button>
                <Button className="px-2 py-1 text-xs" onClick={() => setAutoDoor(z.id, false)}>
                  No door
                </Button>
              </div>
            ) : !z.autoDoor && z.doors.length === 0 ? (
              <Button className="px-2 py-1 text-xs" onClick={() => setAutoDoor(z.id, true)}>
                Put the default door back
              </Button>
            ) : null}
            {z.type === "pen" ? <Toggle checked={z.outsideAccess} onChange={(v) => setOutsideAccess(z.id, v)} label="Door to the outside" hint="Adds a Dutch door on the outside wall this stall touches." testId="zone-outside" /> : null}
          </Section>
        ) : null}

        <div className="flex flex-wrap gap-1">
          <Button className="px-2 py-1 text-xs" onClick={() => duplicateZone(z.id, along)} title="Add another beside it (Ctrl+D)">
            Add another beside it
          </Button>
          <Button className="px-2 py-1 text-xs" onClick={() => splitZone(z.id, 2)}>
            Split in two
          </Button>
          <Button className="px-2 py-1 text-xs text-red-700" onClick={() => removeZone(z.id)} data-testid="zone-delete">
            Delete
          </Button>
        </div>
        {preset ? (
          <p className="text-[11px] leading-relaxed text-muted">
            {preset.label}: minimum {preset.minPen.join(" × ")}, recommended {preset.recommendedPen.join(" × ")}, kick-wall {preset.kickWallFt}&apos;, door {preset.doorFt}&apos;.
          </p>
        ) : null}
      </DockBody>
    </>
  );
}
