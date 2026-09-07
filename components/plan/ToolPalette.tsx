"use client";

import { useViewStore, type PlanTool } from "@/lib/store/useViewStore";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { ZONE_TYPE_LABEL } from "@/lib/model/zones";
import type { Species, ZoneType } from "@/lib/model/schema";

const ROOM_TYPES: ZoneType[] = ["tack", "feed", "hay", "wash", "equipment", "office", "utility", "kidding", "open"];

/** Tile-style tool palette for the plan (SPEC §21.2 hotkeys: V select, P pen, A aisle, R room, E erase). */
export function ToolPalette() {
  const tool = useViewStore((s) => s.tool);
  const setTool = useViewStore((s) => s.setTool);
  const species = useViewStore((s) => s.toolSpecies) as Species;
  const setSpecies = useViewStore((s) => s.setToolSpecies);
  const roomType = useViewStore((s) => s.toolRoomType) as ZoneType;
  const setRoomType = useViewStore((s) => s.setToolRoomType);
  const autoGrow = useViewStore((s) => s.autoGrow);
  const setAutoGrow = useViewStore((s) => s.setAutoGrow);

  const btn = (t: PlanTool, label: string, key: string, testId: string) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      title={`${label} (${key})`}
      data-testid={testId}
      className={`rounded px-2 py-1 text-xs ${tool === t ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute left-3 top-3 flex flex-col gap-1.5" data-testid="tool-palette">
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-panel/95 p-0.5 shadow-sm">
        {btn("select", "Select", "V", "tool-select")}
        {btn("pen", "Pen", "P", "tool-pen")}
        {btn("aisle", "Aisle", "A", "tool-aisle")}
        {btn("room", "Room", "R", "tool-room")}
        {btn("erase", "Erase", "E", "tool-erase")}
      </div>
      {tool === "pen" ? (
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-panel/95 p-1 shadow-sm" data-testid="species-picker">
          {PEN_SPECIES.map((sp) => (
            <button key={sp} onClick={() => setSpecies(sp)} aria-pressed={species === sp} className={`rounded px-1.5 py-0.5 text-[11px] ${species === sp ? "bg-foreground text-background" : "hover:bg-background"}`} style={species === sp ? undefined : { borderLeft: `3px solid ${SPECIES_PRESETS[sp].color}` }}>
              {SPECIES_PRESETS[sp].label} {SPECIES_PRESETS[sp].minPen.join("×")}
            </button>
          ))}
        </div>
      ) : null}
      {tool === "room" ? (
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-panel/95 p-1 shadow-sm">
          {ROOM_TYPES.map((t) => (
            <button key={t} onClick={() => setRoomType(t)} aria-pressed={roomType === t} className={`rounded px-1.5 py-0.5 text-[11px] ${roomType === t ? "bg-foreground text-background" : "hover:bg-background"}`}>
              {ZONE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      ) : null}
      {tool !== "select" ? (
        <div className="rounded-md border border-border bg-panel/95 px-2 py-1 text-[11px] text-muted shadow-sm">
          {tool === "erase" ? "Click a pen or room to remove it" : "Click to stamp · drag to size · Esc to stop"}
          <label className="ml-2 inline-flex items-center gap-1">
            <input type="checkbox" checked={autoGrow} onChange={(e) => setAutoGrow(e.target.checked)} /> grow building
          </label>
        </div>
      ) : null}
    </div>
  );
}
