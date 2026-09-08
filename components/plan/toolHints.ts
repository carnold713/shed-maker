import type { BuildingModel, FixtureKind, InteriorDoorType, Species, ZoneType } from "@/lib/model/schema";
import type { ViewState } from "@/lib/store/useViewStore";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { ZONE_TYPE_LABEL, defaultPenSize } from "@/lib/model/zones";
import { DOOR_PALETTE, WINDOW_PALETTE } from "@/lib/model/openings";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";
import { FIXTURE_PRESETS } from "@/lib/model/electrical";

/** What a click will do with the armed tool — the status bar's centre line (UX audit §3.7). */
export function toolHint(vs: Pick<ViewState, "tool" | "toolSpecies" | "toolRoomType" | "toolDoorKey" | "toolWindowKey" | "toolInteriorDoorType" | "toolFixtureKind" | "toolDrainKind">, model: BuildingModel | null): string | null {
  switch (vs.tool) {
    case "pen": {
      const sp = vs.toolSpecies as Species;
      const [w, d] = defaultPenSize(sp);
      return `Click inside the walls to add a ${w}' × ${d}' ${SPECIES_PRESETS[sp].label.toLowerCase()} stall · drag to size it · Esc when done`;
    }
    case "room":
      return `Click inside the walls to add a ${ZONE_TYPE_LABEL[vs.toolRoomType as ZoneType].toLowerCase()} · drag to size it · Esc when done`;
    case "aisle":
      return "Click where the aisle should run · it spans the building · Esc when done";
    case "interiorDoor":
      return `Click a stall or room wall to add a ${INTERIOR_DOOR_PRESETS[vs.toolInteriorDoorType as InteriorDoorType].label.toLowerCase()} · an outside wall gets a door sized for the space · Esc to cancel`;
    case "door": {
      const d = DOOR_PALETTE.find((x) => x.key === vs.toolDoorKey);
      return `Click an outside wall to place a ${d?.label.toLowerCase() ?? "door"} · a stall or room wall gets its usual inside door · Esc to cancel`;
    }
    case "window": {
      const w = WINDOW_PALETTE.find((x) => x.key === vs.toolWindowKey);
      return `Click an outside wall to place a ${w?.label.toLowerCase() ?? "window"} · Esc to cancel`;
    }
    case "leanTo":
      return "Click an outside wall to add a lean-to on that side · Esc to cancel";
    case "run":
      return "Click beside an outside wall to add a fenced run there · off a stall it takes the stall's animals · Esc to cancel";
    case "fixture": {
      const p = FIXTURE_PRESETS[vs.toolFixtureKind as FixtureKind];
      return p.wall ? `Click to mount a ${p.short.toLowerCase()} · it locks onto the nearest wall or partition · Esc to cancel` : `Click where the ${p.short.toLowerCase()} goes · R turns it after · Esc to cancel`;
    }
    case "drain":
      return vs.toolDrainKind === "outlet" ? "Click an outside wall where the pipe should leave · Esc to cancel" : vs.toolDrainKind === "trench" ? "Click where the trench drain goes · it spans the wash bay or room it lands in · Esc to cancel" : "Click where the floor drain goes (aisle or wash bay, never a stall) · Esc to cancel";
    case "erase":
      return "Click a stall, room, door, window, lean-to or fixture to remove it · Esc when done";
    default:
      return model ? null : null;
  }
}
