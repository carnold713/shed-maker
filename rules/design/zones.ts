import type { Rule, Finding } from "../types";
import { rectsOverlap, rectsShareEdge, zoneRect, zonesOutside } from "@/lib/model/zones";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { formatFtIn } from "@/lib/units";

/** Zones cannot overlap. */
export const zonesOverlap: Rule = {
  id: "design.zones.overlap",
  title: "Zones do not overlap",
  source: "Industry",
  rationale: "Two pens or rooms cannot occupy the same floor; the partition between them has nowhere to go.",
  applies: (m) => m.zones.length > 1,
  evaluate: (m) => {
    const out: Finding[] = [];
    const rs = m.zones.map((z) => ({ z, r: zoneRect(z) }));
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++)
        if (rectsOverlap(rs[i].r, rs[j].r)) out.push({ severity: "error", rule: "design.zones.overlap", message: `${rs[i].z.name} overlaps ${rs[j].z.name}.`, entityIds: [rs[i].z.id, rs[j].z.id] });
    return out;
  },
};

/** Zones must sit inside the building — or the building grows (SPEC §18.2). */
export const zonesInsideFootprint: Rule = {
  id: "design.zones.insideFootprint",
  title: "Zones inside the footprint",
  source: "Industry",
  rationale: "A pen past the exterior wall means the building needs another bay or a wider truss span.",
  applies: (m) => m.zones.length > 0,
  evaluate: (m) => {
    const outside = zonesOutside(m);
    if (outside.length === 0) return [];
    return [
      {
        severity: "error",
        rule: "design.zones.insideFootprint",
        message: `${outside.map((z) => z.name).join(", ")} ${outside.length === 1 ? "extends" : "extend"} past the exterior walls.`,
        entityIds: outside.map((z) => z.id),
        fix: { label: "Grow building to fit", command: "growToFitZones" },
      },
    ];
  },
};

/** Pen below the species minimum (SPEC §5.2 validation example). */
export const penMinimumSize: Rule = {
  id: "animals.pen.minimumSize",
  title: "Pen meets species minimum",
  source: "Species:extension guidelines (see rules/animals/presets.ts)",
  rationale: "Below-minimum pens stress animals and are hard to clean; recommended sizes are larger still.",
  applies: (m) => m.zones.some((z) => z.type === "pen" || z.type === "kidding"),
  evaluate: (m) =>
    m.zones
      .filter((z) => (z.type === "pen" || z.type === "kidding") && z.species)
      .flatMap((z) => {
        const p = SPECIES_PRESETS[z.species!];
        const r = zoneRect(z);
        const [mw, md] = p.minPen;
        const fits = (r.w >= mw - 1e-6 && r.d >= md - 1e-6) || (r.w >= md - 1e-6 && r.d >= mw - 1e-6);
        if (z.headCount && p.groupSqFtPerHead) {
          const need = z.headCount * p.groupSqFtPerHead;
          if (r.w * r.d < need - 1e-6)
            return [{ severity: "warn" as const, rule: "animals.pen.minimumSize", message: `${z.name} is ${r.w * r.d} sq ft for ${z.headCount} ${p.label.toLowerCase()} — ${p.groupSqFtPerHead} sq ft/head needs ${need}.`, entityIds: [z.id] }];
          return [];
        }
        if (fits) return [];
        return [
          {
            severity: "warn" as const,
            rule: "animals.pen.minimumSize",
            message: `${z.name} is ${formatFtIn(r.w)}×${formatFtIn(r.d)} — below the ${mw}×${md} minimum for a ${p.label.toLowerCase()} (${p.recommendedPen.join("×")} recommended).`,
            entityIds: [z.id],
            fix: { label: `Resize to ${mw}×${md}`, command: "resizeZoneTo", args: { id: z.id, w: mw, d: md } },
          },
        ];
      }),
};

/** Aisle width vs the species it serves (SPEC §5.1, §22). */
export const aisleMinWidth: Rule = {
  id: "design.aisle.minWidth",
  title: "Aisle wide enough",
  source: "Species:extension-equine (12' min, 14' recommended for horses)",
  rationale: "Aisles must pass a horse being led beside a cart or a small tractor; narrow aisles are the most common regret.",
  applies: (m) => m.zones.some((z) => z.type === "aisle"),
  evaluate: (m) => {
    const pens = m.zones.filter((z) => z.type === "pen" && z.species);
    const strictest = pens.reduce((acc, z) => Math.max(acc, SPECIES_PRESETS[z.species!].aisleMinFt), 0);
    if (strictest === 0) return [];
    return m.zones
      .filter((z) => z.type === "aisle")
      .flatMap((z) => {
        const r = zoneRect(z);
        const width = Math.min(r.w, r.d);
        if (width >= strictest - 1e-6) return [];
        return [{ severity: "warn" as const, rule: "design.aisle.minWidth", message: `${z.name} is ${formatFtIn(width)} wide; ${formatFtIn(strictest)} minimum for the animals housed here.`, entityIds: [z.id] }];
      });
  },
};

/** Every pen needs a way out: an aisle on one side, or outside access (SPEC §5.5). */
export const penHasAccess: Rule = {
  id: "design.pen.access",
  title: "Pen has a door to an aisle or outside",
  source: "Industry",
  rationale: "A pen you cannot reach without walking through another pen cannot be mucked, fed, or evacuated.",
  applies: (m) => m.zones.some((z) => z.type === "pen"),
  evaluate: (m) => {
    const aisles = m.zones.filter((z) => z.type === "aisle" || z.type === "open").map(zoneRect);
    return m.zones
      .filter((z) => z.type === "pen")
      .flatMap((z) => {
        if (z.outsideAccess) return [];
        const r = zoneRect(z);
        if (aisles.some((a) => rectsShareEdge(a, r))) return [];
        return [{ severity: "warn" as const, rule: "design.pen.access", message: `${z.name} has no aisle beside it and no outside door.`, entityIds: [z.id], fix: { label: "Give it an outside door", command: "setOutsideAccess", args: { id: z.id } } }];
      });
  },
};

/** Partition off the post grid — informational (SPEC §18.1). */
export const partitionOnPostLine: Rule = {
  id: "framing.partitions.onPostLine",
  title: "Stall walls land on post lines",
  source: "NFBA:Post-Frame Building Design Manual",
  rationale: "A stall wall on a post line can be built between the posts with T&G in channels; off the grid it becomes a stick-framed partition.",
  applies: (m) => m.frame.system !== "stickFrame" && m.zones.length > 0,
  evaluate: (m) => {
    const bayAxis = m.roof.ridgeAxis === "ns" ? "y" : "x";
    const extent = m.footprint.kind === "rect" ? (bayAxis === "y" ? m.footprint.dFt : m.footprint.wFt) : 0;
    const off = new Set<number>();
    const ids: string[] = [];
    for (const z of m.zones) {
      if (z.type === "aisle") continue;
      const r = zoneRect(z);
      for (const c of bayAxis === "y" ? [r.y, r.y + r.d] : [r.x, r.x + r.w]) {
        if (c < 1e-6 || c > extent - 1e-6) continue;
        if (Math.abs(c / m.frame.bayFt - Math.round(c / m.frame.bayFt)) > 1e-6) {
          off.add(+c.toFixed(2));
          ids.push(z.id);
        }
      }
    }
    if (off.size === 0) return [];
    return [{ severity: "info", rule: "framing.partitions.onPostLine", message: `Stall walls at ${[...off].sort((a, b) => a - b).map((c) => formatFtIn(c)).join(", ")} are off the ${m.frame.bayFt}' post grid — they will be stick-framed partitions.`, entityIds: [...new Set(ids)] }];
  },
};
