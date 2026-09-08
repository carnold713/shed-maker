"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { useViewStore } from "@/lib/store/useViewStore";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { ZONE_TYPE_LABEL, defaultPenSize, zoneRect } from "@/lib/model/zones";
import type { InteriorDoorType, Species, ZoneType } from "@/lib/model/schema";
import { INTERIOR_DOOR_PRESETS, INTERIOR_DOOR_TYPES } from "@/lib/model/interiorDoors";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { Section, Toggle } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Popover, MenuRow, MenuDivider } from "@/components/ui/Popover";
import { Icon } from "@/components/ui/Icon";
import { ToolRow, ToolButton, ToolSelect, EmptyState, ItemList } from "./ToolRow";
import { formatFtIn } from "@/lib/units";

const ROOM_TYPES: ZoneType[] = ["tack", "feed", "hay", "wash", "equipment", "office", "utility", "kidding", "milking", "restroom", "open"];

/** Layout step (UX audit §2.3): stalls, aisle, rooms and their doors. */
export function LayoutStep() {
  const model = useProjectStore((s) => s.model)!;
  const applyLayout = useProjectStore((s) => s.applyLayout);
  const fitEnvelope = useProjectStore((s) => s.fitEnvelopeToZones);
  const growToFit = useProjectStore((s) => s.growToFitZones);
  const { report } = useDerived();
  const tool = useViewStore((s) => s.tool);
  const species = useViewStore((s) => s.toolSpecies) as Species;
  const setSpecies = useViewStore((s) => s.setToolSpecies);
  const roomType = useViewStore((s) => s.toolRoomType) as ZoneType;
  const setRoomType = useViewStore((s) => s.setToolRoomType);
  const doorType = useViewStore((s) => s.toolInteriorDoorType) as InteriorDoorType;
  const setDoorType = useViewStore((s) => s.setToolInteriorDoorType);
  const autoGrow = useViewStore((s) => s.autoGrow);
  const setAutoGrow = useViewStore((s) => s.setAutoGrow);

  const pens = model.zones.filter((z) => z.type === "pen" || z.type === "kidding");
  const aisles = model.zones.filter((z) => z.type === "aisle");
  const rooms = model.zones.filter((z) => z.type !== "pen" && z.type !== "kidding" && z.type !== "aisle");
  const bySpecies = new Map<string, number>();
  for (const p of pens) bySpecies.set(p.species ?? "generic", (bySpecies.get(p.species ?? "generic") ?? 0) + 1);
  const summary = [
    ...[...bySpecies.entries()].map(([sp, n]) => `${n} ${SPECIES_PRESETS[sp as Species].label.toLowerCase()} stall${n > 1 ? "s" : ""}`),
    ...aisles.map((a) => `${formatFtIn(Math.min(zoneRect(a).w, zoneRect(a).d))} aisle`),
    rooms.length ? `${rooms.length} room${rooms.length > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const problems = new Set((report?.findings ?? []).filter((f) => f.severity !== "info").flatMap((f) => f.entityIds));
  const [pw, pd] = defaultPenSize(species);

  return (
    <>
      <DockHeader step="layout" title="Layout" subtitle={summary || "Stalls, aisle, rooms and their doors"} icon="layout" />
      <DockBody>
        <Section
          title="Add"
          aside={
            <Popover
              align="right"
              testId="layouts-menu"
              button={(open) => (
                <button className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium transition ${open ? "bg-foreground text-background" : "text-accent hover:bg-black/5"}`} title="Fill the barn with a proven pattern — you can edit everything after">
                  <Icon name="spark" size={14} /> Layouts <Icon name="chevron" size={12} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuRow onClick={() => { applyLayout("centerAisle", { species }); close(); }} hint="Stalls on both sides of a 14' aisle · best for 4+ horses" testId="layout-center-aisle">
                    Center aisle
                  </MenuRow>
                  <MenuRow onClick={() => { applyLayout("centerAisle", { species, supportBays: 1 }); close(); }} hint="Same, with a tack room and a feed room in the first bay" testId="layout-center-aisle-tack">
                    Center aisle with tack &amp; feed
                  </MenuRow>
                  <MenuRow onClick={() => { applyLayout("shedRow", { species }); close(); }} hint="One row of stalls, each with its own outside door · cheap and airy" testId="layout-shed-row">
                    Shed row
                  </MenuRow>
                  <MenuDivider />
                  <MenuRow onClick={() => { applyLayout("clear"); close(); }} disabled={model.zones.length === 0} hint="Clears the inside · the building stays" testId="layout-clear">
                    <span className="text-red-700">Remove all stalls &amp; rooms</span>
                  </MenuRow>
                </>
              )}
            </Popover>
          }
        >
          <ToolRow>
            <ToolButton tool="select" icon="select" label="Select" keyHint="V" hint="Click to select · drag to move" testId="tool-select" />
            <ToolButton tool="pen" icon="stall" label="Stall" keyHint="S" hint={`Click inside the walls to add a ${pw}' × ${pd}' ${SPECIES_PRESETS[species].label.toLowerCase()} stall · drag to size it`} testId="tool-pen" />
            <ToolButton tool="room" icon="room" label="Room" keyHint="R" hint={`Click inside the walls to add a ${ZONE_TYPE_LABEL[roomType].toLowerCase()}`} testId="tool-room" />
            <ToolButton tool="aisle" icon="aisle" label="Aisle" keyHint="A" hint="Click where the aisle should run · it spans the building" testId="tool-aisle" />
            <ToolButton tool="interiorDoor" icon="door" label="Door" keyHint="D" hint="Click a stall front or room wall to add a door" testId="tool-interior-door" />
            <ToolButton tool="erase" icon="erase" label="Remove" keyHint="E" hint="Click a stall, room or door to remove it" testId="tool-erase" />
          </ToolRow>
          {tool === "pen" ? (
            <ToolSelect label="Animal" value={species} onChange={(v) => setSpecies(v)} testId="species-picker" options={PEN_SPECIES.map((sp) => ({ value: sp, label: `${SPECIES_PRESETS[sp].label} · ${SPECIES_PRESETS[sp].minPen.join("×")} stall` }))} />
          ) : null}
          {tool === "room" ? <ToolSelect label="Room" value={roomType} onChange={(v) => setRoomType(v)} testId="room-picker" options={ROOM_TYPES.map((t) => ({ value: t, label: ZONE_TYPE_LABEL[t] }))} /> : null}
          {tool === "interiorDoor" ? (
            <ToolSelect label="Door" value={doorType} onChange={(v) => setDoorType(v)} testId="interior-door-picker" options={INTERIOR_DOOR_TYPES.map((t) => ({ value: t, label: INTERIOR_DOOR_PRESETS[t].label }))} />
          ) : null}
          {tool === "interiorDoor" ? <p className="text-[11px] leading-snug text-muted">{INTERIOR_DOOR_PRESETS[doorType].hint} Stalls get a sliding door to the aisle by default; add more or change them here.</p> : null}
          <Toggle checked={autoGrow} onChange={setAutoGrow} label="Grow the building when a stall goes past a wall" hint="On: the walls move out to the next post. Off: the stall is flagged instead." testId="auto-grow" />
        </Section>

        {model.zones.length === 0 ? (
          <EmptyState title="No stalls yet.">Pick a layout to fill the barn in one click, or choose Stall and click inside the walls.</EmptyState>
        ) : (
          <Section
            title="In this barn"
            aside={
              <span className="flex gap-1">
                <Button variant="ghost" className="px-2 py-0.5 text-[11.5px]" onClick={fitEnvelope} title="Pulls the walls in to the nearest post spacing" data-testid="fit-envelope">
                  Shrink to fit
                </Button>
                <Button variant="ghost" className="px-2 py-0.5 text-[11.5px]" onClick={growToFit} title="Pushes the walls out to the nearest post spacing" data-testid="grow-to-fit">
                  Grow to fit
                </Button>
              </span>
            }
          >
            <ItemList
              items={model.zones.map((z) => {
                const r = zoneRect(z);
                return { id: z.id, label: z.name, detail: `${formatFtIn(r.w)} × ${formatFtIn(r.d)}`, icon: z.type === "aisle" ? "aisle" : z.type === "pen" || z.type === "kidding" ? "stall" : "room", warn: problems.has(z.id) };
              })}
            />
          </Section>
        )}
      </DockBody>
      <NextStep to="building" />
    </>
  );
}
