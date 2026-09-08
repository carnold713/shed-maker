import type { Finding, Rule } from "../types";
import { deriveElectrical } from "@/lib/electrical/derive";
import { FIXTURE_PRESETS, fixturesInZone } from "@/lib/model/electrical";
import { zoneRect } from "@/lib/model/zones";
import type { BuildingModel } from "@/lib/model/schema";

/**
 * Electrical rules (ADR-0013). Citations are to the 2023 NEC (NFPA 70)
 * unless noted; Article 547 is the agricultural-buildings article.
 */

const hasElectrical = (m: BuildingModel) => m.electrical.fixtures.length > 0;

/** Every circuit starts at a panel; without one nothing can be routed. */
export const panelPlaced: Rule = {
  id: "mep.electrical.panel",
  title: "Panel placed",
  source: "NEC:408 / 110.26",
  rationale: "Circuits are routed from the panel, so its position sets every wire length. Keep a 30\" wide × 36\" deep × 6'6\" high working space in front of it (110.26(A)).",
  applies: hasElectrical,
  evaluate: (m) =>
    m.electrical.fixtures.some((f) => f.kind === "panel")
      ? []
      : [{ severity: "warn", rule: "mep.electrical.panel", message: "No panel yet — circuits are routed from a guessed spot on the south wall.", entityIds: ["electrical"], fix: { label: "Place the panel", command: "autoPlacePanel" } }],
};

/** The panel must not sit inside a pen or behind a door swing. */
export const panelWorkspace: Rule = {
  id: "mep.electrical.panelWorkspace",
  title: "Panel working space",
  source: "NEC:110.26(A)",
  rationale: "A panel inside a stall is unreachable, gets kicked, and has no clear working space. Put it in an aisle, utility or tack room.",
  applies: (m) => m.electrical.fixtures.some((f) => f.kind === "panel"),
  evaluate: (m) => {
    const panel = m.electrical.fixtures.find((f) => f.kind === "panel")!;
    const bad = m.zones.find((z) => ["pen", "kidding", "wash", "feed", "hay"].includes(z.type) && fixturesInZone(m, z, "panel").length > 0);
    if (!bad) return [];
    return [{ severity: "warn", rule: "mep.electrical.panelWorkspace", message: `The panel is in ${bad.name} — put it in a dry, dust-free spot (utility or tack room, or the aisle) with 30" × 36" clear in front.`, entityIds: [panel.id] }];
  },
};

/** Barn wiring basics, once. */
export const agriculturalWiring: Rule = {
  id: "mep.electrical.agriculturalWiring",
  title: "Agricultural wiring & GFCI",
  source: "NEC:547.5(A),(C),(G) (2023: 547.26, 547.28)",
  rationale: "Livestock buildings are damp, dusty and corrosive: use UF or NMC cable in PVC conduit (or jacketed MC), corrosion-resistant PVC boxes, and GFCI protection on every 120 V receptacle.",
  applies: hasElectrical,
  evaluate: (m) => {
    const outlets = m.electrical.fixtures.filter((f) => f.kind === "outlet").length;
    return [
      {
        severity: "info",
        rule: "mep.electrical.agriculturalWiring",
        message: `${m.electrical.wiring === "pvcConduit" ? "UF-B cable in PVC conduit" : m.electrical.wiring === "ufCable" ? "UF-B cable (protect it below 8')" : "Jacketed MC cable"}, PVC boxes and vapor-tight fixtures${outlets ? `; all ${outlets} outlet${outlets > 1 ? "s" : ""} GFCI` : ""}.`,
        entityIds: ["electrical"],
      },
    ];
  },
};

/** Equipotential plane where animals stand on concrete near metal. */
export const equipotentialPlane: Rule = {
  id: "mep.electrical.equipotential",
  title: "Equipotential plane in concrete stalls",
  source: "NEC:547.10 (2023: 547.44)",
  rationale: "Stray voltage across a concrete floor with metal stall fronts or waterers is felt by animals before people. Bond wire mesh or rebar in the slab under livestock areas to the grounding system.",
  applies: (m) => hasElectrical(m) && m.foundation.slab.enabled && m.zones.some((z) => z.type === "pen" || z.type === "kidding"),
  evaluate: () => [{ severity: "info", rule: "mep.electrical.equipotential", message: "Bond the slab mesh under the stalls and the metal stall fronts / waterers together (equipotential plane).", entityIds: ["foundation"] }],
};

/** Service can carry the calculated demand. */
export const serviceCapacity: Rule = {
  id: "mep.electrical.serviceCapacity",
  title: "Service size vs demand",
  source: "NEC:220 / 215.2",
  rationale: "The demand load (lighting and heaters at 125 %, receptacles at 180 VA each, largest motor +25 %) has to fit the feeder and sub-panel with room to grow. Above 80 % pick the next size.",
  applies: hasElectrical,
  evaluate: (m) => {
    const d = deriveElectrical(m);
    const next = [60, 100, 125, 150, 200].find((a) => a > d.load.serviceAmps && d.load.demandAmps / a <= 0.8) ?? 200;
    if (d.load.utilisationPct > 100) return [{ severity: "warn", rule: "mep.electrical.serviceCapacity", message: `Demand ${d.load.demandAmps} A exceeds the ${d.load.serviceAmps} A service — verify with your electrician.`, entityIds: ["electrical"], fix: { label: `Use a ${next} A service`, command: "setServiceAmps", args: { amps: next } } }];
    if (d.load.utilisationPct > 80) return [{ severity: "warn", rule: "mep.electrical.serviceCapacity", message: `Demand ${d.load.demandAmps} A is ${d.load.utilisationPct}% of the ${d.load.serviceAmps} A service — no room to grow.`, entityIds: ["electrical"], fix: { label: `Use a ${next} A service`, command: "setServiceAmps", args: { amps: next } } }];
    return [];
  },
};

/** Long runs: voltage drop. */
export const voltageDrop: Rule = {
  id: "mep.electrical.voltageDrop",
  title: "Voltage drop under 3 %",
  source: "NEC:210.19(A) IN 4 / 215.2(A) IN 2",
  rationale: "Long barn runs at 120 V lose voltage in the wire; over 3 % lights dim and motors run hot. The derivation upsizes the conductor until the run is under 3 %.",
  applies: hasElectrical,
  evaluate: (m) => {
    const d = deriveElectrical(m);
    const out: Finding[] = d.circuits
      .filter((c) => c.upsizedForDrop)
      .map((c) => ({ severity: "info" as const, rule: "mep.electrical.voltageDrop", message: `Circuit ${c.label} runs ${c.runFt}' — use ${c.wireAwg} AWG instead of ${c.breakerAmps === 15 ? 14 : 12} AWG to hold voltage drop at ${c.voltageDropPct}%.`, entityIds: c.fixtureIds }));
    if (d.load.feederDropPct > 3) out.push({ severity: "warn", rule: "mep.electrical.voltageDrop", message: `The ${m.electrical.service.feederLengthFt}' feeder drops ${d.load.feederDropPct}% at load — upsize the feeder one gauge (or shorten the run).`, entityIds: ["electrical"] });
    return out;
  },
};

/** Every pen, aisle and room reaches its target light level. */
export const lightingLevel: Rule = {
  id: "mep.electrical.lightingLevel",
  title: "Light levels by area",
  source: "ASABE:EP344.4 (lighting for agricultural facilities)",
  rationale: "Targets: stalls 10 fc, aisles 20 fc, tack / feed / wash 30 fc, office and milking 50 fc, measured at the floor. Sized by the lumen method with a 0.5 utilisation factor for bare wood and steel.",
  applies: (m) => hasElectrical(m) && m.zones.length > 0,
  evaluate: (m) => {
    const d = deriveElectrical(m);
    return d.zoneLighting
      .filter((z) => z.moreLights > 0 && z.type !== "open")
      .map((z) => ({
        severity: "warn" as const,
        rule: "mep.electrical.lightingLevel",
        message: `${z.name} has ${z.lightCount ? `about ${z.estimatedFc} fc` : "no light"} — target ${z.targetFc} fc needs ${z.moreLights} more ${FIXTURE_PRESETS.light.watts} W LED strip${z.moreLights > 1 ? "s" : ""}.`,
        entityIds: [z.zoneId],
        fix: { label: `Light ${z.name}`, command: "autoLightZone", args: { id: z.zoneId } },
      }));
  },
};

/** Fixtures in reach of animals need guards; and lights below 8' in stalls get broken. */
export const luminaireProtection: Rule = {
  id: "mep.electrical.luminaireProtection",
  title: "Guarded fixtures in stalls",
  source: "NEC:547.8 (2023: 547.31)",
  rationale: "Luminaires in livestock areas must keep dust out, be protected from physical damage, and be watertight where washed down. A rearing horse reaches 11': mount stall lights at 11' or fit a wire guard, and never below 8'.",
  applies: (m) => m.electrical.fixtures.some((f) => f.kind === "light" || f.kind === "fan"),
  evaluate: (m) =>
    m.electrical.fixtures
      .filter((f) => (f.kind === "light" || f.kind === "fan") && f.mountFt < 8 && m.zones.some((z) => (z.type === "pen" || z.type === "kidding") && fixturesInZone(m, z).some((x) => x.id === f.id)))
      .map((f) => ({ severity: "warn" as const, rule: "mep.electrical.luminaireProtection", message: `${FIXTURE_PRESETS[f.kind].short} at ${f.mountFt}' is within reach in a stall — mount it at 8' or higher with a wire guard (11' clears a rearing horse).`, entityIds: [f.id], fix: { label: "Raise to 8'", command: "setFixtureMount", args: { id: f.id, mountFt: Math.min(8, Math.max(7, m.eaveHeightFt - 0.5)) } } })),
};

/** A switch inside each door you walk through. */
export const switchAtEntry: Rule = {
  id: "mep.electrical.switchAtEntry",
  title: "Switch at every walk-in door",
  source: "MWPS:MWPS-1 (farm buildings wiring) / NEC:210.70(C)",
  rationale: "You should never cross a dark barn to find the lights: put a switch just inside every man door and at both ends of a long aisle.",
  applies: (m) => m.electrical.fixtures.some((f) => f.kind === "light") && m.openings.some((o) => o.type === "manDoor"),
  evaluate: (m) => {
    const switches = m.electrical.fixtures.filter((f) => f.kind === "switch");
    const out: Finding[] = [];
    for (const o of m.openings) {
      if (o.type !== "manDoor") continue;
      const wall = m.walls.find((w) => w.id === o.wallId);
      if (!wall) continue;
      const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      const dx = (wall.end.x - wall.start.x) / len;
      const dy = (wall.end.y - wall.start.y) / len;
      const cx = wall.start.x + dx * (o.offsetFt + o.widthFt / 2);
      const cy = wall.start.y + dy * (o.offsetFt + o.widthFt / 2);
      const near = switches.some((s) => Math.hypot(s.x - cx, s.y - cy) <= 6);
      if (!near) {
        const side = { n: "north", s: "south", e: "east", w: "west" }[wall.side ?? "s"];
        const u = o.offsetFt + o.widthFt + 1.5 < len ? o.offsetFt + o.widthFt + 1.5 : Math.max(0.5, o.offsetFt - 1.5);
        out.push({ severity: "info", rule: "mep.electrical.switchAtEntry", message: `No switch by the ${side} door.`, entityIds: [o.id], fix: { label: "Add a switch beside it", command: "addFixtureAt", args: { kind: "switch", x: wall.start.x + dx * u, y: wall.start.y + dy * u, wallId: wall.id } } });
      }
    }
    return out;
  },
};

/** Zones with waterers should be on their own GFCI circuit — derived automatically; flag heaters in stalls. */
export const heaterPlacement: Rule = {
  id: "mep.electrical.heaterPlacement",
  title: "No unit heaters in stalls",
  source: "Industry",
  rationale: "Electric unit heaters belong in tack, wash and office rooms, well above bedding; in a stall they are a fire and burn hazard.",
  applies: (m) => m.electrical.fixtures.some((f) => f.kind === "heater"),
  evaluate: (m) =>
    m.electrical.fixtures
      .filter((f) => f.kind === "heater" && m.zones.some((z) => (z.type === "pen" || z.type === "kidding" || z.type === "hay") && fixturesInZone(m, z).some((x) => x.id === f.id)))
      .map((f) => {
        const z = m.zones.find((zz) => fixturesInZone(m, zz).some((x) => x.id === f.id))!;
        return { severity: "warn" as const, rule: "mep.electrical.heaterPlacement", message: `Unit heater in ${z.name} (${zoneRect(z).w}×${zoneRect(z).d} ${z.type}) — move it to a tack, wash or office room.`, entityIds: [f.id] };
      }),
};

/** Nothing an animal can reach: no outlets or switches inside a pen. */
export const deviceAnimalReach: Rule = {
  id: "mep.electrical.animalReach",
  title: "Devices out of animal reach",
  source: "NEC:547.5 physical protection (2023: 547.26)",
  rationale: "Receptacles and switches belong on the aisle side of the stall front at 48\", never inside the pen — on its outside wall or in the open — where they get chewed, kicked and soaked. Waterers inside the pen are hard-wired in conduit.",
  applies: (m) => m.electrical.fixtures.some((f) => f.kind === "outlet" || f.kind === "switch"),
  evaluate: (m) =>
    m.electrical.fixtures
      .filter((f) => (f.kind === "outlet" || f.kind === "switch") && !(f.facing && !f.wallId)) // partition-mounted devices sit on the stall front's aisle side
      .flatMap((f) => {
        const pen = m.zones.find((z) => (z.type === "pen" || z.type === "kidding") && fixturesInZone(m, z).some((x) => x.id === f.id));
        if (!pen) return [];
        return [{ severity: "warn" as const, rule: "mep.electrical.animalReach", message: `${FIXTURE_PRESETS[f.kind].short} is inside ${pen.name} — move it to the aisle side of the stall front.`, entityIds: [f.id, pen.id] }];
      }),
};

export const ELECTRICAL_RULES: Rule[] = [panelPlaced, panelWorkspace, serviceCapacity, lightingLevel, luminaireProtection, deviceAnimalReach, heaterPlacement, switchAtEntry, voltageDrop, agriculturalWiring, equipotentialPlane];
