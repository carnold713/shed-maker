"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { findInteriorDoor, INTERIOR_DOOR_PRESETS, INTERIOR_DOOR_TYPES, edgeLengthFt } from "@/lib/model/interiorDoors";
import { zoneRect } from "@/lib/model/zones";
import type { InteriorDoorType } from "@/lib/model/schema";
import { formatFtIn } from "@/lib/units";
import { Field, inputClass, Section } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";

const SIDE = { n: "north", s: "south", e: "east", w: "west" } as const;

export function InteriorDoorInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const update = useProjectStore((s) => s.updateInteriorDoor);
  const remove = useProjectStore((s) => s.removeInteriorDoor);
  const select = useProjectStore((s) => s.select);
  const found = findInteriorDoor(model, id);
  if (!found) return null;
  const { zone, door } = found;
  const preset = INTERIOR_DOOR_PRESETS[door.type];
  const r = zoneRect(zone);
  const edge = edgeLengthFt(r, door.side);
  return (
    <>
      <DockHeader back="layout" title={preset.label} subtitle={`${zone.name} · ${SIDE[door.side]} side · ${formatFtIn(door.widthFt)} × ${formatFtIn(door.heightFt)}`} icon="door" onBack={() => select(zone.id)} />
      <DockBody>
        <Section title="What it is">
          <Field label="Type" hint={preset.hint}>
            <select className={inputClass} value={door.type} onChange={(e) => update(door.id, { type: e.target.value as InteriorDoorType })} data-testid="interior-door-type">
              {INTERIOR_DOOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INTERIOR_DOOR_PRESETS[t].label}
                </option>
              ))}
            </select>
          </Field>
          {preset.leaf !== "none" ? (
            <Field label={preset.hinged ? "Opens" : "Slides"}>
              <select className={inputClass} value={door.swing} onChange={(e) => update(door.id, { swing: e.target.value as typeof door.swing })}>
                {preset.hinged ? (
                  <>
                    <option value="out">Out, into the aisle</option>
                    <option value="in">In, into {zone.name}</option>
                  </>
                ) : (
                  <>
                    <option value="slideLeft">Left</option>
                    <option value="slideRight">Right</option>
                  </>
                )}
              </select>
            </Field>
          ) : null}
          {preset.hinged ? (
            <Field label="Hinges on the">
              <select className={inputClass} value={door.hinge} onChange={(e) => update(door.id, { hinge: e.target.value as "left" | "right" })}>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </Field>
          ) : null}
        </Section>
        <Section title="Size and place">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width">
              <FtInput value={door.widthFt} min={1.5} max={Math.max(2, edge - 0.5)} onCommit={(v) => update(door.id, { widthFt: v })} testId="interior-door-width" />
            </Field>
            <Field label="Height">
              <FtInput value={door.heightFt} min={4} max={10} onCommit={(v) => update(door.id, { heightFt: v })} />
            </Field>
            <Field label={`From the ${door.side === "n" || door.side === "s" ? "west" : "south"} end`} hint="Or drag it along the wall">
              <FtInput value={door.offsetFt} min={0} max={Math.max(0, edge - door.widthFt)} onCommit={(v) => update(door.id, { offsetFt: v })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1">
            {preset.hardware.map((h) => (
              <span key={h.sku} className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted">
                {h.qty > 1 ? `${h.qty}× ` : ""}
                {h.label}
              </span>
            ))}
          </div>
        </Section>
        <Button className="self-start px-2 py-1 text-xs text-red-700" onClick={() => remove(door.id)} data-testid="interior-door-delete">
          Delete
        </Button>
      </DockBody>
    </>
  );
}
