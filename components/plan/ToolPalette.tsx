"use client";

import { useViewStore, type PlanTool } from "@/lib/store/useViewStore";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { ZONE_TYPE_LABEL } from "@/lib/model/zones";
import type { Species, ZoneType } from "@/lib/model/schema";
import { DOOR_PALETTE, WINDOW_PALETTE } from "@/lib/model/openings";
import { LEAN_TO_DEPTHS_FT } from "@/lib/model/leanTos";

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
  const doorKey = useViewStore((s) => s.toolDoorKey);
  const setDoorKey = useViewStore((s) => s.setToolDoorKey);
  const windowKey = useViewStore((s) => s.toolWindowKey);
  const setWindowKey = useViewStore((s) => s.setToolWindowKey);

  const btn = (t: PlanTool, label: string, key: string, testId: string) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      title={`${label} (${key})`}
      data-testid={testId}
      className={`chip text-xs ${tool === t ? "chip-on" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5" data-testid="tool-palette">
      <div className="glass flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-0.5 p-1 whitespace-nowrap">
        {btn("select", "Select", "V", "tool-select")}
        {btn("pen", "Pen", "P", "tool-pen")}
        {btn("aisle", "Aisle", "A", "tool-aisle")}
        {btn("room", "Room", "R", "tool-room")}
        <span className="mx-0.5 h-4 w-px bg-border" />
        {btn("door", "Door", "D", "tool-door")}
        {btn("window", "Window", "W", "tool-window")}
        {btn("leanTo", "Lean-to", "L", "tool-leanto")}
        <span className="mx-0.5 h-4 w-px bg-border" />
        {btn("erase", "Erase", "E", "tool-erase")}
      </div>
      {tool === "door" ? (
        <div className="flex max-w-md flex-wrap gap-1 glass p-1.5" data-testid="door-picker">
          {DOOR_PALETTE.map((d) => (
            <button key={d.key} onClick={() => setDoorKey(d.key)} aria-pressed={doorKey === d.key} className={`rounded px-1.5 py-0.5 text-[11px] ${doorKey === d.key ? "bg-foreground text-background" : "hover:bg-background"}`} data-testid={`door-${d.key}`}>
              {d.label}
            </button>
          ))}
        </div>
      ) : null}
      {tool === "window" ? (
        <div className="flex max-w-md flex-wrap gap-1 glass p-1.5" data-testid="window-picker">
          {WINDOW_PALETTE.map((w) => (
            <button key={w.key} onClick={() => setWindowKey(w.key)} aria-pressed={windowKey === w.key} className={`rounded px-1.5 py-0.5 text-[11px] ${windowKey === w.key ? "bg-foreground text-background" : "hover:bg-background"}`} data-testid={`window-${w.key}`}>
              {w.label}
            </button>
          ))}
        </div>
      ) : null}
      {tool === "leanTo" ? (
        <div className="glass px-2.5 py-1.5 text-[11px] text-muted">Click an exterior wall to hang a lean-to on it ({LEAN_TO_DEPTHS_FT.join("/")}&apos; deep in its menu)</div>
      ) : null}
      {tool === "pen" ? (
        <div className="flex flex-wrap gap-1 glass p-1.5" data-testid="species-picker">
          {PEN_SPECIES.map((sp) => (
            <button key={sp} onClick={() => setSpecies(sp)} aria-pressed={species === sp} className={`rounded px-1.5 py-0.5 text-[11px] ${species === sp ? "bg-foreground text-background" : "hover:bg-background"}`} style={species === sp ? undefined : { borderLeft: `3px solid ${SPECIES_PRESETS[sp].color}` }}>
              {SPECIES_PRESETS[sp].label} {SPECIES_PRESETS[sp].minPen.join("×")}
            </button>
          ))}
        </div>
      ) : null}
      {tool === "room" ? (
        <div className="flex flex-wrap gap-1 glass p-1.5">
          {ROOM_TYPES.map((t) => (
            <button key={t} onClick={() => setRoomType(t)} aria-pressed={roomType === t} className={`rounded px-1.5 py-0.5 text-[11px] ${roomType === t ? "bg-foreground text-background" : "hover:bg-background"}`}>
              {ZONE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      ) : null}
      {tool !== "select" && tool !== "leanTo" ? (
        <div className="glass px-2.5 py-1.5 text-[11px] text-muted">
          {tool === "erase" ? "Click a pen, room, door, window or lean-to to remove it" : tool === "door" || tool === "window" ? "Click a wall to place · Esc to stop" : "Click to stamp · drag to size · Esc to stop"}
          <label className="ml-2 inline-flex items-center gap-1">
            <input type="checkbox" checked={autoGrow} onChange={(e) => setAutoGrow(e.target.checked)} /> grow building
          </label>
        </div>
      ) : null}
    </div>
  );
}
