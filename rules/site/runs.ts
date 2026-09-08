import type { Finding, Rule } from "../types";
import { FENCE_PRESETS, overlapsBuilding, runArea, runEdges, runGuidanceFor, runRect, runSqFtPerHead } from "@/lib/model/runs";
import { exteriorEdgesOf } from "@/lib/model/zones";
import { SPECIES_PRESETS } from "@/rules/animals/presets";

/** Outdoor run and fencing rules (ADR-0017, docs/research/runs-and-fencing.md §7). Advisory except overlap with the building. */

const animal = (species?: Parameters<typeof runGuidanceFor>[0]) => (species ? SPECIES_PRESETS[species].label.split(" /")[0].toLowerCase() : "animal");

export const runSpace: Rule = {
  id: "site.run.space",
  title: "Run gives each animal enough ground",
  source: "Species:extension dry-lot guidance (docs/research/runs-and-fencing.md §2)",
  rationale: "A run that is too small turns to mud and manure in a season and the animals stand in it. Extension dry-lot figures are per head; a horse wants at least a 12' × 24' run off its stall and 400–1,000 sq ft in a lot.",
  applies: (m) => m.runs.length > 0,
  evaluate: (m) =>
    m.runs
      .filter((r) => runSqFtPerHead(r) < runGuidanceFor(r.species).minSqFtPerHead - 1e-6)
      .map((r) => {
        const g = runGuidanceFor(r.species);
        return { severity: "warn" as const, rule: "site.run.space", message: `${r.name} gives each ${animal(r.species)} ${Math.round(runSqFtPerHead(r))} sq ft; at least ${g.minSqFtPerHead} is needed (${g.recSqFtPerHead} recommended).`, entityIds: [r.id], fix: { label: "Grow it to the recommended size", command: "fitRunToHead", args: { id: r.id } } };
      }),
};

export const runFenceHeight: Rule = {
  id: "site.run.fenceHeight",
  title: "Fence is tall enough for the animal",
  source: "Species:extension fencing guidance (docs/research/runs-and-fencing.md §3)",
  rationale: "Horses go over 4' fences, goats over anything under 4', and a 6' fence is what keeps a dog in and a coyote out of a chicken run.",
  applies: (m) => m.runs.length > 0,
  evaluate: (m) =>
    m.runs
      .filter((r) => r.fence.heightFt < runGuidanceFor(r.species).minFenceHeightFt - 1e-6)
      .map((r) => {
        const g = runGuidanceFor(r.species);
        return { severity: "warn" as const, rule: "site.run.fenceHeight", message: `${r.name}: a ${r.fence.heightFt}' fence is low for ${animal(r.species)}s — ${g.fenceHeightFt}' is usual, ${g.minFenceHeightFt}' the minimum.`, entityIds: [r.id], fix: { label: `Make it ${g.fenceHeightFt}'`, command: "updateRun", args: { id: r.id, patch: { fence: { heightFt: g.fenceHeightFt } } } } };
      }),
};

export const runFenceKind: Rule = {
  id: "site.run.fenceKind",
  title: "Fence type suits the animal",
  source: "Species:extension fencing guidance (docs/research/runs-and-fencing.md §3)",
  rationale: "Field fence with 6\" openings catches a horse's hoof or a goat's head; poultry netting stops nothing bigger than a hen; electric alone does not hold small animals or keep predators out.",
  applies: (m) => m.runs.length > 0,
  evaluate: (m) =>
    m.runs
      .filter((r) => runGuidanceFor(r.species).avoid.includes(r.fence.kind))
      .map((r) => {
        const g = runGuidanceFor(r.species);
        return { severity: "warn" as const, rule: "site.run.fenceKind", message: `${r.name}: ${FENCE_PRESETS[r.fence.kind].label.toLowerCase()} is not right for ${animal(r.species)}s. ${g.note}`, entityIds: [r.id], fix: { label: `Use ${FENCE_PRESETS[g.fence].label.toLowerCase()}`, command: "updateRun", args: { id: r.id, patch: { fence: { kind: g.fence, heightFt: g.fenceHeightFt } } } } };
      }),
};

export const runPenDoor: Rule = {
  id: "site.run.penDoor",
  title: "Run opens from its stall",
  source: "Industry",
  rationale: "The point of an attached run is that the stall's outside door opens into it, so the animal comes and goes without being led. A run on a pen with no outside door is a fenced lawn.",
  applies: (m) => m.runs.some((r) => r.zoneId),
  evaluate: (m) =>
    m.runs
      .filter((r) => {
        if (!r.zoneId) return false;
        const z = m.zones.find((x) => x.id === r.zoneId);
        if (!z) return false;
        const edgeSides = exteriorEdgesOf(m, z).map((e) => e.side);
        const doors = m.openings.filter((o) => o.type !== "window" && o.zoneId === z.id);
        const wallDoors = m.openings.filter((o) => o.type !== "window" && !o.zoneId && edgeSides.some((s) => o.wallId === `wall_ext_${s}`));
        return doors.length === 0 && wallDoors.length === 0;
      })
      .map((r) => ({ severity: "warn" as const, rule: "site.run.penDoor", message: `${r.name} is hung on ${m.zones.find((z) => z.id === r.zoneId)?.name ?? "a stall"}, which has no door to the outside.`, entityIds: [r.id, r.zoneId!], fix: { label: "Give the stall a Dutch door", command: "setOutsideAccess", args: { id: r.zoneId, on: true } } })),
};

export const runOverlapsBuilding: Rule = {
  id: "site.run.building",
  title: "Run is outside the walls",
  source: "Industry",
  rationale: "A run is fenced ground outside the barn; one drawn over the building would put fence posts through the slab.",
  applies: (m) => m.runs.length > 0,
  evaluate: (m) => m.runs.filter((r) => overlapsBuilding(m, runRect(r))).map((r) => ({ severity: "error" as const, rule: "site.run.building", message: `${r.name} overlaps the building.`, entityIds: [r.id] })),
};

export const runsOverlap: Rule = {
  id: "site.run.overlap",
  title: "Runs don't overlap each other",
  source: "Industry",
  rationale: "Two runs that overlap share ground the fence takeoff counts twice; runs side by side share one fence line instead.",
  applies: (m) => m.runs.length > 1,
  evaluate: (m) => {
    const out: Finding[] = [];
    for (let i = 0; i < m.runs.length; i++)
      for (let j = i + 1; j < m.runs.length; j++) {
        const a = m.runs[i].rect;
        const b = m.runs[j].rect;
        const eps = 1e-6;
        if (a.x < b.x + b.w - eps && a.x + a.w > b.x + eps && a.y < b.y + b.d - eps && a.y + a.d > b.y + eps) out.push({ severity: "warn", rule: "site.run.overlap", message: `${m.runs[i].name} and ${m.runs[j].name} overlap.`, entityIds: [m.runs[i].id, m.runs[j].id] });
      }
    return out;
  },
};

export const runHasGate: Rule = {
  id: "site.run.gate",
  title: "Run has a gate",
  source: "Industry",
  rationale: "You need a way in from outside for the wheelbarrow, the vet and the farrier that doesn't go through the stall. A 4' walk gate is the minimum; a 12' gate lets a tractor in to scrape the lot.",
  applies: (m) => m.runs.length > 0,
  evaluate: (m) =>
    m.runs.flatMap((r) => {
      const fenced = runEdges(m, r).filter((e) => !e.onBuilding);
      if (r.gates.length === 0) return [{ severity: "info" as const, rule: "site.run.gate", message: `${r.name} has no gate from outside.`, entityIds: [r.id], fix: { label: "Add a 4' walk gate", command: "addRunGate", args: { runId: r.id } } }];
      if (runArea(r) >= 1200 && !r.gates.some((g) => g.widthFt >= 10) && fenced.some((e) => e.lengthFt >= 14)) return [{ severity: "info" as const, rule: "site.run.gate", message: `${r.name} is big enough to scrape with a tractor but its widest gate is ${Math.max(...r.gates.map((g) => g.widthFt))}'. A 12' gate saves a lot of forking.`, entityIds: [r.id], fix: { label: "Add a 12' drive gate", command: "addRunGate", args: { runId: r.id, widthFt: 12 } } }];
      return [];
    }),
};

export const fenceHasGate: Rule = {
  id: "site.fence.gate",
  title: "Paddock has a gate",
  source: "Industry",
  rationale: "A fence closed all the way round needs a gate wide enough for what goes in: 4' for people, 12' for a tractor or a spreader.",
  applies: (m) => m.fences.some((f) => f.closed),
  evaluate: (m) => m.fences.filter((f) => f.closed && f.gates.length === 0).map((f) => ({ severity: "info" as const, rule: "site.fence.gate", message: `${f.name} is closed all the way round with no gate.`, entityIds: [f.id], fix: { label: "Add a 12' gate", command: "addFenceGate", args: { id: f.id, widthFt: 12 } } })),
};

export const RUN_RULES: Rule[] = [runOverlapsBuilding, runsOverlap, runSpace, runFenceHeight, runFenceKind, runPenDoor, runHasGate, fenceHasGate];
