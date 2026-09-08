/**
 * New-barn wizard (UX audit §5.2): four answers become a complete barn —
 * layout pattern sized to the stall count, doors at the aisle ends, a
 * window per stall, and (optionally) lights, outlets and a panel.
 */
import type { BuildingModel, Species } from "./schema";
import { createDefaultModel } from "./defaults";
import { applyLayout } from "./layouts";
import { exteriorEdgeOf, removeZone, zoneRect } from "./zones";
import { addOpening } from "./commands";
import { EXTERIOR_WALL_IDS } from "./walls";
import { autoLightAll, addFixture } from "./electrical";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { DOOR_PALETTE, WINDOW_PALETTE } from "./openings";

export type WizardLayout = "centerAisle" | "shedRow" | "empty";

export interface WizardAnswers {
  species: Species;
  count: number;
  layout: WizardLayout;
  size: "fit" | "custom";
  wFt?: number;
  dFt?: number;
  aisleEndDoors: boolean;
  stallWindows: boolean;
  electrical: boolean;
  name?: string;
}

export const WIZARD_DEFAULTS: WizardAnswers = { species: "horse", count: 4, layout: "centerAisle", size: "fit", wFt: 24, dFt: 36, aisleEndDoors: true, stallWindows: true, electrical: true };

/** Size that fits `count` stalls in the chosen pattern, before rounding to the post spacing. */
export function fitSize(a: Pick<WizardAnswers, "species" | "count" | "layout">): { wFt: number; dFt: number } {
  const p = SPECIES_PRESETS[a.species];
  const [stallW, stallD] = p.minPen;
  const n = Math.max(1, Math.round(a.count));
  if (a.layout === "centerAisle") {
    const perSide = Math.ceil(n / 2);
    return { wFt: stallD * 2 + p.aisleRecommendedFt, dFt: Math.max(perSide * stallW, 16) };
  }
  if (a.layout === "shedRow") return { wFt: Math.max(stallD, 12), dFt: Math.max(n * stallW, 12) };
  return { wFt: 24, dFt: 36 };
}

export function defaultName(species: Species): string {
  const label = SPECIES_PRESETS[species].label.split(" /")[0];
  return `${label} barn`;
}

/** Build the whole model; deterministic apart from ids. */
export function createFromWizard(a: WizardAnswers, now?: Date): BuildingModel {
  const fit = fitSize(a);
  const custom = a.size === "custom" && a.wFt && a.dFt;
  const wFt = custom ? a.wFt! : fit.wFt;
  const dFt = custom ? a.dFt! : fit.dFt;
  let m = createDefaultModel({ name: a.name?.trim() || defaultName(a.species), wFt, dFt, now });
  if (a.layout === "empty") return m;
  m = applyLayout(m, a.layout, { species: a.species });
  // The generator fills the length; trim to the asked-for count (northernmost first).
  const pens = m.zones.filter((z) => z.type === "pen").sort((x, y) => zoneRect(y).y - zoneRect(x).y || zoneRect(y).x - zoneRect(x).x);
  for (const extra of pens.slice(0, Math.max(0, pens.length - a.count))) m = removeZone(m, extra.id);
  if (a.aisleEndDoors && a.layout === "centerAisle") {
    const aisle = m.zones.find((z) => z.type === "aisle");
    if (aisle && m.footprint.kind === "rect") {
      const r = zoneRect(aisle);
      const slide = DOOR_PALETTE.find((d) => d.key === "slide10")!;
      const w = Math.min(slide.widthFt, r.w - 1);
      const { wFt: W } = m.footprint;
      // South wall u = x; north wall u = W - x (walls walk clockwise).
      m = addOpening(m, { wallId: EXTERIOR_WALL_IDS.s, type: slide.type, centerFt: r.x + r.w / 2, widthFt: w, heightFt: slide.heightFt, sillFt: 0, swing: "slideRight" });
      m = addOpening(m, { wallId: EXTERIOR_WALL_IDS.n, type: slide.type, centerFt: W - (r.x + r.w / 2), widthFt: w, heightFt: slide.heightFt, sillFt: 0, swing: "slideRight" });
    }
  } else if (a.aisleEndDoors && a.layout === "shedRow") {
    // Shed row has no aisle: one entry door on the short wall.
    const man = DOOR_PALETTE.find((d) => d.key === "man36")!;
    m = addOpening(m, { wallId: EXTERIOR_WALL_IDS.s, type: man.type, centerFt: 4, widthFt: man.widthFt, heightFt: man.heightFt, sillFt: 0, swing: "out" });
  }
  if (a.stallWindows) {
    const win = WINDOW_PALETTE.find((w) => w.key === "w34")!;
    for (const z of m.zones.filter((zz) => zz.type === "pen")) {
      const edge = exteriorEdgeOf(m, z);
      if (!edge) continue;
      const r = zoneRect(z);
      const along = edge.side === "n" || edge.side === "s" ? r.w : r.d;
      if (along < win.widthFt + 1) continue;
      // Shed-row stalls already have a Dutch door on that wall: put the window beside it.
      const shift = z.outsideAccess ? Math.min(along / 2 - win.widthFt / 2 - 0.5, 3.5) : 0;
      m = addOpening(m, { wallId: EXTERIOR_WALL_IDS[edge.side], type: "window", centerFt: edge.centerFt + shift, widthFt: win.widthFt, heightFt: win.heightFt, sillFt: win.sillFt, variant: win.variant });
    }
  }
  if (a.electrical) {
    m = autoLightAll(m);
    // A GFCI outlet by the panel and one at the far end of the aisle.
    const panel = m.electrical.fixtures.find((f) => f.kind === "panel");
    if (panel && m.footprint.kind === "rect") {
      m = addFixture(m, { kind: "outlet", x: panel.x + (panel.wallId === EXTERIOR_WALL_IDS.s || panel.wallId === EXTERIOR_WALL_IDS.n ? 3 : 0), y: panel.y + (panel.wallId === EXTERIOR_WALL_IDS.e || panel.wallId === EXTERIOR_WALL_IDS.w ? 3 : 0), wallId: panel.wallId });
      const door = m.openings.find((o) => o.type === "manDoor" || o.type === "slidingDoor");
      const wall = door ? m.walls.find((w) => w.id === door.wallId) : undefined;
      if (door && wall) {
        const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        const dx = (wall.end.x - wall.start.x) / len;
        const dy = (wall.end.y - wall.start.y) / len;
        const u = Math.min(len - 1, door.offsetFt + door.widthFt + 1.5);
        m = addFixture(m, { kind: "switch", x: wall.start.x + dx * u, y: wall.start.y + dy * u, wallId: wall.id });
      }
    }
  }
  return m;
}

/** One-line description of what the wizard will build, for the live preview. */
export function describeWizard(a: WizardAnswers): string {
  const fit = fitSize(a);
  const custom = a.size === "custom" && a.wFt && a.dFt;
  const w = custom ? a.wFt! : fit.wFt;
  const d = custom ? a.dFt! : fit.dFt;
  const label = SPECIES_PRESETS[a.species].label.toLowerCase();
  const parts = [a.layout === "empty" ? "an empty building" : `${a.count} ${label} stall${a.count > 1 ? "s" : ""}`, `≈ ${w}' × ${d}'`, `${(w * d).toLocaleString()} sq ft`];
  if (custom && a.layout !== "empty" && (w < fit.wFt || d < fit.dFt)) parts.push(`the stalls need ${fit.wFt}' × ${fit.dFt}' — the building will grow`);
  return parts.join(" · ");
}
