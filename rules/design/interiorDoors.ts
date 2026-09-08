import type { Finding, Rule } from "../types";
import { interiorDoors } from "@/lib/interior/partitions";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";
import { zoneRect } from "@/lib/model/zones";

/** Stall doors have to pass the animal (and a wheelbarrow); rooms need a way in. */
export const interiorDoorWidth: Rule = {
  id: "design.interiorDoor.width",
  title: "Stall door width",
  source: "Species:extension-equine (stall door 4' min for horses)",
  rationale: "A horse needs a 4' clear stall door; goats and sheep 3'. Narrow doors catch hips and gates. Cased openings into hay bays should pass a bale cart (4').",
  applies: (m) => m.zones.some((z) => z.doors.length > 0),
  evaluate: (m) => {
    const out: Finding[] = [];
    for (const { door } of interiorDoors(m)) {
      if (door.auto) continue;
      const z = m.zones.find((zz) => zz.id === door.zoneId);
      if (!z) continue;
      const min = z.species ? SPECIES_PRESETS[z.species].doorFt : z.type === "hay" || z.type === "equipment" ? 4 : 2.67;
      if (door.widthFt < min - 1e-6) out.push({ severity: "warn", rule: "design.interiorDoor.width", message: `${z.name} ${INTERIOR_DOOR_PRESETS[door.type].label.toLowerCase()} is ${door.widthFt}' wide — ${min}' minimum.`, entityIds: [door.id, z.id], fix: { label: `Widen to ${min}'`, command: "setInteriorDoorWidth", args: { id: door.id, widthFt: min } } });
    }
    return out;
  },
};

/** A pen or room with no door at all is a dead end. */
export const zoneHasDoor: Rule = {
  id: "design.interiorDoor.exists",
  title: "Every stall and room has a door",
  source: "Industry",
  rationale: "Pens need a stall door to the aisle (or outside access); rooms need a door. A zone whose doors were all deleted, or that touches nothing but other pens, has no way in.",
  applies: (m) => m.zones.some((z) => z.type !== "aisle" && z.type !== "open"),
  evaluate: (m) => {
    const doors = interiorDoors(m);
    const out: Finding[] = [];
    for (const z of m.zones) {
      if (z.type === "aisle" || z.type === "open") continue;
      const has = doors.some((d) => d.door.zoneId === z.id) || (z.type === "pen" && z.outsideAccess);
      if (has) continue;
      const r = zoneRect(z);
      const touchesAisle = m.zones.some((a) => a.type === "aisle" && sharesEdge(zoneRect(a), r));
      out.push({
        severity: z.autoDoor && !touchesAisle ? "info" : "warn",
        rule: "design.interiorDoor.exists",
        message: `${z.name} has no door${touchesAisle ? "" : " — it doesn't touch an aisle"}.`,
        entityIds: [z.id],
        fix: touchesAisle ? { label: "Add the default door", command: "setAutoDoor", args: { id: z.id } } : z.type === "pen" ? { label: "Outside access (Dutch door)", command: "setOutsideAccess", args: { id: z.id } } : undefined,
      });
    }
    return out;
  },
};

function sharesEdge(a: { x: number; y: number; w: number; d: number }, b: { x: number; y: number; w: number; d: number }) {
  const eps = 1e-6;
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5;
  const overlapY = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y) > 0.5;
  const touchX = Math.abs(a.x + a.w - b.x) < eps || Math.abs(b.x + b.w - a.x) < eps;
  const touchY = Math.abs(a.y + a.d - b.y) < eps || Math.abs(b.y + b.d - a.y) < eps;
  return (touchX && overlapY) || (touchY && overlapX);
}
