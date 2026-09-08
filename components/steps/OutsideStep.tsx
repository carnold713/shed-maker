"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { useViewStore } from "@/lib/store/useViewStore";
import { DOOR_PALETTE, WINDOW_PALETTE, OPENING_PRESETS } from "@/lib/model/openings";
import { formatFtIn } from "@/lib/units";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { Section } from "@/components/ui/Field";
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

        <Section title="Colours">
          <div className="grid grid-cols-3 gap-2">
            {(["sidingColor", "roofColor", "trimColor"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-xs">
                <span className="text-muted">{k === "sidingColor" ? "Siding" : k === "roofColor" ? "Roof" : "Trim"}</span>
                <input type="color" value={model.materials[k]} onChange={(e) => setMaterialColor(k, e.target.value)} className="h-8 w-full cursor-pointer rounded-lg border border-border bg-panel" aria-label={`${k === "sidingColor" ? "Siding" : k === "roofColor" ? "Roof" : "Trim"} colour`} />
              </label>
            ))}
          </div>
        </Section>
      </DockBody>
      <NextStep to="electrical" />
    </>
  );
}
