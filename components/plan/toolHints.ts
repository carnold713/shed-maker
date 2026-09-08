import type { BuildingModel, FixtureKind, InteriorDoorType, Species, ZoneType } from "@/lib/model/schema";
import type { ViewState } from "@/lib/store/useViewStore";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { ZONE_TYPE_LABEL, defaultPenSize } from "@/lib/model/zones";
import { DOOR_PALETTE, WINDOW_PALETTE } from "@/lib/model/openings";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";
import { FIXTURE_PRESETS } from "@/lib/model/electrical";

/** What a click will do with the armed tool — the status bar's centre line (UX audit §3.7). */
export function toolHint(vs: Pick<ViewState, "tool" | "toolSpecies" | "toolRoomType" | "toolDoorKey" | "toolWindowKey" | "toolInteriorDoorType" | "toolFixtureKind">, model: BuildingModel | null): string | null {
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
      return `Click a stall front or room wall to add a ${INTERIOR_DOOR_PRESETS[vs.toolInteriorDoorType as InteriorDoorType].label.toLowerCase()} · Esc to cancel`;
    case "door": {
      const d = DOOR_PALETTE.find((x) => x.key === vs.toolDoorKey);
      return `Click an outside wall to place a ${d?.label.toLowerCase() ?? "door"} · Esc to cancel`;
    }
    case "window": {
      const w = WINDOW_PALETTE.find((x) => x.key === vs.toolWindowKey);
      return `Click an outside wall to place a ${w?.label.toLowerCase() ?? "window"} · Esc to cancel`;
    }
    case "leanTo":
      return "Click an outside wall to add a lean-to on that side · Esc to cancel";
    case "fixture": {
      const p = FIXTURE_PRESETS[vs.toolFixtureKind as FixtureKind];
      return p.wall ? `Click near a wall to mount a ${p.short.toLowerCase()} · Esc to cancel` : `Click where the ${p.short.toLowerCase()} goes · Esc to cancel`;
    }
    case "erase":
      return "Click a stall, room, door, window, lean-to or fixture to remove it · Esc when done";
    default:
      return model ? null : null;
  }
}
