import type { Finding, Rule } from "../types";
import { deriveDrainage } from "@/lib/plumbing/drainage";
import { drainsInZone, zoneAt } from "@/lib/model/drainage";

/** Floor drainage rules (ADR-0016). Advisory: highest severity `warn`; the AHJ and the plumber decide. */

export const washBayDrain: Rule = {
  id: "mep.drainage.washBay",
  title: "Wash bay has a drain",
  source: "MWPS:MWPS-1 (wash rack ¼\"/ft to a drain) / IPC:412",
  rationale: "A wash bay without a drain sends water down the aisle and into the stalls. A trench drain across the bay, or a floor drain in the middle with the slab sloped ¼\" per foot to it, keeps the floor dry.",
  applies: (m) => m.zones.some((z) => z.type === "wash"),
  evaluate: (m) =>
    m.zones
      .filter((z) => z.type === "wash" && drainsInZone(m, z).length === 0)
      .map((z) => ({ severity: "warn" as const, rule: "mep.drainage.washBay", message: `${z.name} has no drain.`, entityIds: [z.id], fix: { label: "Add a trench drain", command: "autoDrainWashBays" } })),
};

export const drainOutlet: Rule = {
  id: "mep.drainage.outlet",
  title: "Drains have an outlet",
  source: "IPC:704.1 / 708.1",
  rationale: "Every drain needs a pipe that falls at least ⅛\" per foot to somewhere — daylight on the downhill side, a dry well, or a tank. Without an outlet the concrete crew has nothing to sleeve and the plumber nothing to connect.",
  applies: (m) => m.drainage.drains.length > 0,
  evaluate: (m) => (m.drainage.outlet ? [] : [{ severity: "warn", rule: "mep.drainage.outlet", message: "The drains have no outlet — the pipe has nowhere to go.", entityIds: ["drainage"], fix: { label: "Place the outlet", command: "autoOutlet" } }]),
};

export const daylightFall: Rule = {
  id: "mep.drainage.daylight",
  title: "Outlet can daylight",
  source: "IPC:704.1 (fall) / Industry",
  rationale: "The pipe leaves the slab about a foot down and drops ⅛\"–¼\" every foot of run. To end on open ground its crown must clear the surface, so the ground at the outlet has to be lower than the pipe by that much. Otherwise run it further downhill, raise the pad, or use a dry well.",
  applies: (m) => !!m.drainage.outlet && m.drainage.drains.length > 0 && m.drainage.outlet.kind === "daylight",
  evaluate: (m) => {
    const d = deriveDrainage(m);
    if (!d.outlet || d.outlet.daylightOk) return [];
    return [{ severity: "warn", rule: "mep.drainage.daylight", message: `The outlet pipe is ${d.outlet.invertIn}" below the floor; the ground there is only ${d.outlet.groundIn}" lower. It needs ${d.outlet.fallNeededIn}" more fall to daylight.`, entityIds: ["drain_outlet"], fix: { label: "Use a dry well instead", command: "setOutletKind", args: { kind: "dryWell" } } }];
  },
};

export const slopeRun: Rule = {
  id: "mep.drainage.slopeRun",
  title: "Slab slope run to a drain",
  source: "MWPS:MWPS-1 / Industry",
  rationale: "At ⅛\" per foot a drain 25' away means a 3\" high point — a slab that noticeably tilts and a long way for water to travel. Keep any point that drains within about 25' of its drain; add a second drain or a trench for bigger areas.",
  applies: (m) => m.drainage.drains.length > 0,
  evaluate: (m) =>
    deriveDrainage(m)
      .drains.filter((d) => d.farthestFt > 25)
      .map((d) => ({ severity: "info" as const, rule: "mep.drainage.slopeRun", message: `${d.drain.label ?? "A drain"} serves an area ${d.farthestFt}' across — the high point is ${d.highPointIn}" up. Add another drain or a trench drain.`, entityIds: [d.drain.id] })),
};

export const drainInStall: Rule = {
  id: "mep.drainage.inStall",
  title: "No drains in stalls",
  source: "Species:extension-equine (stall flooring: flat over mats, drain the aisle)",
  rationale: "Bedding and manure clog a stall drain within weeks and a horse will dig at it. Keep stalls flat over mats and slope the aisle or wash bay to the drain instead.",
  applies: (m) => m.drainage.drains.length > 0,
  evaluate: (m) =>
    m.drainage.drains
      .filter((d) => {
        const z = zoneAt(m, d.x, d.y);
        return z && (z.type === "pen" || z.type === "kidding");
      })
      .map((d) => ({ severity: "warn" as const, rule: "mep.drainage.inStall", message: `${d.label ?? "A drain"} is inside ${zoneAt(m, d.x, d.y)?.name} — move it to the aisle or wash bay.`, entityIds: [d.id] })),
};

export const trapsAndWashWater: Rule = {
  id: "mep.drainage.traps",
  title: "Traps, primers and where wash water goes",
  source: "IPC:1002.1 / 1002.4 / 708.1",
  rationale: "Every floor drain needs a trap so sewer or soil gas stays out, and a deep seal or trap primer so it doesn't dry out between washes. Wash water carries manure: many counties refuse it in storm drains and septic tanks need an interceptor — ask before the pipe goes in.",
  applies: (m) => m.drainage.drains.length > 0,
  evaluate: (m) => {
    const d = deriveDrainage(m);
    const out: Finding[] = [{ severity: "info", rule: "mep.drainage.traps", message: `${m.drainage.drains.length} trapped drain${m.drainage.drains.length > 1 ? "s" : ""}, ${d.cleanouts.length} cleanout${d.cleanouts.length === 1 ? "" : "s"}, ${d.pipe.totalFt}' of ${d.pipe.diaIn}" pipe at ${d.pipe.slopeInPerFt * 8}/8" per foot.`, entityIds: ["drainage"] }];
    if (m.drainage.outlet?.kind === "septic" || m.drainage.outlet?.kind === "storm") out.push({ severity: "info", rule: "mep.drainage.traps", message: `Wash water with manure to a ${m.drainage.outlet.kind === "septic" ? "septic tank needs a hair / sediment interceptor" : "storm drain is usually not allowed"} — confirm with the building department.`, entityIds: ["drain_outlet"] });
    return out;
  },
};

export const DRAINAGE_RULES: Rule[] = [washBayDrain, drainOutlet, daylightFall, drainInStall, slopeRun, trapsAndWashWater];
