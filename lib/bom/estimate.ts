/**
 * Raw-materials cost estimate (SPEC §7.8, §28). Quantities come from the
 * framing set, geometry and model; prices from rules/materials/prices.ts
 * (placeholders) with per-project overrides. Waste factors per §7.8.
 * Never presented as a quote: the UI labels every figure "estimate".
 */
import type { BuildingModel } from "@/lib/model/schema";
import type { FramingSet } from "@/lib/framing/types";
import type { Geometry } from "@/lib/geometry/types";
import { boardFeet, stockLength, type LumberSize } from "@/rules/materials/lumber";
import { PRICE_CATEGORY_LABEL, unitCost, type PriceCategory } from "@/rules/materials/prices";
import { hardwareSchedule } from "./hardware";
import { interiorDoors } from "@/lib/interior/partitions";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";
import { deriveFencing } from "@/lib/site/fencing";
import { FENCE_PRESETS } from "@/lib/model/runs";
import { CUPOLA_SIZES_IN, WAINSCOT_LABEL } from "@/lib/model/looks";
import { formatFtIn } from "@/lib/units";
import { deriveElectrical } from "@/lib/electrical/derive";
import { FIXTURE_PRESETS } from "@/lib/model/electrical";
import { deriveDrainage } from "@/lib/plumbing/drainage";

export interface EstimateLine {
  category: PriceCategory;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  cost: number;
}

export interface Estimate {
  lines: EstimateLine[];
  byCategory: { category: PriceCategory; label: string; cost: number }[];
  /** Materials subtotal with waste. */
  total: number;
  /** Low/high band (±15% on placeholder prices). */
  low: number;
  high: number;
}

export const WASTE = { lumber: 0.1, steel: 0.05, siding: 0.1 } as const;

export function estimateMaterials(model: BuildingModel, framing: FramingSet, geometry: Geometry): Estimate {
  const ov = model.priceOverrides ?? {};
  const lines: EstimateLine[] = [];
  const add = (category: PriceCategory, sku: string, description: string, quantity: number, unit: string) => {
    if (quantity <= 0) return;
    const uc = unitCost(sku, ov);
    lines.push({ category, sku, description, quantity: round(quantity), unit, unitCost: uc, cost: round(quantity * uc) });
  };

  // ---- Lumber and posts (board feet at stock length + waste)
  let bfSpf = 0;
  let bfPt = 0;
  let bfPost = 0;
  let bfLam = 0;
  for (const m of framing.members) {
    if (m.kind === "footing") continue;
    const stock = stockLength(m.lengthFt);
    const bf = boardFeet(m.nominal as LumberSize, stock.stockFt * stock.pieces);
    if (m.kind === "post") {
      if (m.nominal.startsWith("3ply")) bfLam += bf;
      else bfPost += bf;
    } else if (m.treatment !== "none") bfPt += bf;
    else bfSpf += bf;
  }
  add("lumber", "lumber.spf", "Framing lumber, SPF #2 (+10% waste)", bfSpf * (1 + WASTE.lumber), "bf");
  add("lumber", "lumber.pt", "Pressure-treated lumber (+10% waste)", bfPt * (1 + WASTE.lumber), "bf");
  add("posts", "post.6x6", "PT posts", bfPost, "bf");
  add("posts", "post.laminated", "Laminated columns", bfLam, "bf");

  // ---- Trusses
  if (framing.trussSpec) {
    const span = framing.trussSpec.spanFt;
    const sku = span <= 24 ? "truss.le24" : span <= 32 ? "truss.le32" : span <= 40 ? "truss.le40" : "truss.gt40";
    add("trusses", sku, `${framing.trussSpec.type} trusses, ${span}' span`, framing.trussSpec.count, "each");
  }

  // ---- Steel roofing, siding, trim
  let roofSqFt = 0;
  let sidingSqFt = 0;
  for (const b of geometry.boxes) {
    if (b.kind === "roofPlane") roofSqFt += b.size[0] * b.size[2];
    if (b.kind === "wallSkin") sidingSqFt += b.size[0] * b.size[1];
    if (b.kind === "leanToSkin") sidingSqFt += Math.max(b.size[0], b.size[2]) * b.size[1];
  }
  for (const p of geometry.polygons) if (p.kind === "gableEnd") sidingSqFt += polygonArea(p.vertices);
  add("roofSteel", "steel.roof29", "Roof panels (+5% waste)", roofSqFt * (1 + WASTE.steel), "sqft");
  add("siding", "steel.wall29", "Wall panels (+10% waste)", sidingSqFt * (1 + WASTE.siding), "sqft");
  const trimLf = trimLength(model, geometry);
  add("trim", "trim.lf", "Ridge, rake, eave, corner and base trims", trimLf, "lf");
  add("trim", "closure.lf", "Closure strips at eaves and ridge", model.footprint.kind === "rect" ? 2 * (model.roof.ridgeAxis === "ns" ? model.footprint.dFt : model.footprint.wFt) * 2 : 0, "lf");

  // ---- Concrete
  let slabCuFt = 0;
  let slabSqFt = 0;
  for (const b of geometry.boxes) {
    if (b.kind === "slab" || b.kind === "apron") {
      slabCuFt += b.size[0] * b.size[1] * b.size[2];
      slabSqFt += b.size[0] * b.size[2];
    }
  }
  add("concrete", "concrete.cuyd", "Slab, pads and aprons (+5%)", (slabCuFt / 27) * 1.05, "cuyd");
  const collarCuFt = framing.posts.reduce((a, p) => a + p.concreteCuFt, 0);
  add("concrete", "concrete.bag", "Bagged concrete for post collars (0.6 cu ft/bag)", Math.ceil(collarCuFt / 0.6), "bag");
  add("concrete", "gravel.cuyd", "Gravel base", (slabSqFt * (model.foundation.slab.gravelBaseIn / 12)) / 27, "cuyd");
  if (model.foundation.slab.reinforcement !== "none") add("concrete", "mesh.sqft", "Reinforcement", slabSqFt, "sqft");

  // ---- Hardware (interior door hardware is counted with the doors below)
  for (const h of hardwareSchedule(model, framing, geometry)) {
    if (h.group === "Stalls" && h.sku.startsWith("hw.") && ["hw.stallTrack", "hw.stallHanger", "hw.stallLatch", "hw.floorGuide", "hw.strapHinge", "hw.holdBack", "hw.lockset"].includes(h.sku)) continue;
    add(h.group === "Stalls" ? "interior" : "hardware", h.sku, h.description, h.quantity, h.unit);
  }

  // ---- Doors and windows
  for (const o of model.openings) {
    const area = o.widthFt * o.heightFt;
    switch (o.type) {
      case "manDoor":
      case "interiorDoor":
        add("doors", "door.man", "Man door", 1, "each");
        break;
      case "doubleDoor":
        add("doors", "door.double", "Double door", 1, "each");
        break;
      case "dutchDoor":
        add("doors", "door.dutch", "Dutch door", 1, "each");
        break;
      case "slidingDoor":
        add("doors", "door.sliding.sqft", "Sliding door leaf", area, "sqft");
        add("hardware", "hw.slidingTrack.lf", "Sliding door track", o.widthFt * 2, "lf");
        break;
      case "overheadDoor":
        add("doors", "door.overhead.sqft", "Overhead door", area, "sqft");
        break;
      case "rollUpDoor":
        add("doors", "door.rollup.sqft", "Roll-up door", area, "sqft");
        break;
      case "window":
        add("windows", "window.sqft", "Window", area, "sqft");
        break;
      case "stallDoor":
        add("interior", "hw.stallDoorKit", "Stall door kit", 1, "each");
        break;
    }
  }

  // ---- Interior stall systems
  let kickLf = 0;
  let grilleLf = 0;
  for (const b of geometry.boxes) {
    if (b.kind === "partition") kickLf += Math.max(b.size[0], b.size[2]);
    if (b.kind === "grille") grilleLf += Math.max(b.size[0], b.size[2]);
  }
  const pensKick = kickLf;
  add("interior", "tg.2x6.lf", "2×6 T&G kick-wall boards (kick height ÷ 5.5\" per lf)", pensKick * 8.7, "lf");
  add("interior", "hw.uChannel.lf", "U-channel at posts for kick-walls", pensKick > 0 ? Math.ceil(pensKick / 12) * 8 : 0, "lf");
  add("interior", "grille.lf", "Grille panels above kick-walls", grilleLf, "lf");

  // ---- Interior doors (stall fronts and rooms), by type, with their hardware
  const doorCounts = new Map<string, number>();
  const hwCounts = new Map<string, { qty: number; label: string }>();
  for (const { door } of interiorDoors(model)) {
    const preset = INTERIOR_DOOR_PRESETS[door.type];
    if (preset.unitSku) doorCounts.set(preset.unitSku, (doorCounts.get(preset.unitSku) ?? 0) + 1);
    for (const h of preset.hardware) {
      const qty = h.sku === "hw.stallTrack" ? Math.ceil((door.widthFt * 2) / 8) : h.qty;
      const cur = hwCounts.get(h.sku);
      hwCounts.set(h.sku, { qty: (cur?.qty ?? 0) + qty, label: h.label });
    }
  }
  for (const [sku, n] of doorCounts) {
    const preset = Object.values(INTERIOR_DOOR_PRESETS).find((p) => p.unitSku === sku)!;
    add(sku === "door.man" || sku === "door.woodPrehung" ? "doors" : "interior", sku, `${preset.label}s`, n, "each");
  }
  for (const [sku, h] of hwCounts) add(sku === "hw.lockset" ? "hardware" : "interior", sku, h.label, h.qty, "each");

  // ---- Electrical (rough-in materials; labour and permits excluded)
  if (model.electrical.fixtures.length > 0) {
    const e = deriveElectrical(model);
    add("electrical", "elec.panel", `Sub-panel, ${e.load.serviceAmps} A, ${e.load.panelSpaces} spaces`, 1, "each");
    add("electrical", "elec.groundRods", "Ground rods and grounding electrode conductor", 1, "each");
    add("electrical", "elec.breaker1", "Single-pole breakers", e.circuits.filter((c) => c.poles === 1).length, "each");
    add("electrical", "elec.breaker2", "Two-pole breakers", e.circuits.filter((c) => c.poles === 2).length, "each");
    const byKind = new Map<string, number>();
    for (const f of model.electrical.fixtures) if (f.kind !== "panel") byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
    for (const [kind, n] of byKind) {
      const p = FIXTURE_PRESETS[kind as keyof typeof FIXTURE_PRESETS];
      add("electrical", p.sku, `${p.label}s`, n, "each");
    }
    add("electrical", "elec.box", "PVC device and junction boxes", e.boxes + e.circuits.length, "each");
    for (const w of e.wireByAwg) add("electrical", `elec.wire${w.awg}.ft`, `${w.awg} AWG copper (+15% pulled in)`, w.ft, "lf");
    add("electrical", "elec.conduit.ft", "PVC conduit along the girts and across the chords", e.conduitFt, "lf");
    const feederSku = e.load.serviceAmps <= 60 ? "elec.feeder60.ft" : e.load.serviceAmps <= 125 ? "elec.feeder100.ft" : "elec.feeder200.ft";
    add("electrical", feederSku, `Buried feeder from the ${model.electrical.service.feedFrom === "meter" ? "meter" : "house panel"} (${model.electrical.service.feederLengthFt}')`, model.electrical.service.feederLengthFt + 10, "lf");
    add("electrical", "elec.circuitMisc", "Straps, connectors, labels", e.circuits.length, "each");
  }

  // ---- Floor drainage (rough-in materials)
  if (model.drainage.drains.length > 0) {
    const dd = deriveDrainage(model);
    const floors = model.drainage.drains.filter((d) => d.kind === "floor").length;
    const trenchFt = model.drainage.drains.filter((d) => d.kind === "trench").reduce((s, d) => s + d.lengthFt, 0);
    add("plumbing", "drain.floor4", "Floor drains with trap and grate", floors, "each");
    add("plumbing", "drain.trench.lf", "Trench drain channel and grate", trenchFt, "lf");
    add("plumbing", "drain.catchBasin", "Catch basins at trench drain outlets", model.drainage.drains.filter((d) => d.kind === "trench").length, "each");
    add("plumbing", "drain.trapPrimer", "Trap primers", model.drainage.drains.length, "each");
    add("plumbing", `pipe.pvc${model.drainage.pipeDiaIn}.ft`, `${model.drainage.pipeDiaIn}" PVC drain pipe (+10%)`, dd.pipe.totalFt * 1.1 + (dd.outlet ? 12 : 0), "lf");
    add("plumbing", "pipe.bedding.ft", "Gravel bedding under the pipe", dd.pipe.totalFt, "lf");
    add("plumbing", "pipe.fitting", "Fittings (bends, tees, couplings)", dd.pipe.bends + model.drainage.drains.length * 2, "each");
    add("plumbing", "pipe.cleanout", "Cleanouts", dd.cleanouts.length, "each");
    if (dd.outlet?.kind === "daylight") add("plumbing", "drain.daylightEnd", "Daylight outlet end", 1, "each");
    if (dd.outlet?.kind === "dryWell") add("plumbing", "drain.dryWell", "Dry well", 1, "each");
  }

  // ---- Looks (ADR-0018): cupola, weathervane, awnings, trim boards, wainscot
  const cup = model.roof.cupola;
  if (cup.enabled) {
    const size = CUPOLA_SIZES_IN.reduce((b, s) => (Math.abs(s - cup.sizeIn) < Math.abs(b - cup.sizeIn) ? s : b), CUPOLA_SIZES_IN[0]);
    add("trim", `cupola.${size}`, `Cupola, ${size}" base, ${cup.style}`, cup.count, "each");
    if (cup.style === "windowed") add("trim", "cupola.windowed", "Windowed cupola upcharge", cup.count, "each");
    add("trim", "cupola.saddle", "Cupola saddle cut and flashing", cup.count, "each");
    if (cup.weathervane) add("trim", "weathervane", "Weathervane with roof mount", cup.count, "each");
  }
  const awnings = model.openings.filter((o) => o.awning);
  if (awnings.length) {
    add("trim", "awning.lf", `Awning roofs over ${awnings.length} door${awnings.length > 1 ? "s" : ""} (${awnings.map((o) => `${Math.round(o.widthFt + 2)}' × ${o.awning!.depthFt}'`).join(", ")})`, awnings.reduce((s, o) => s + o.widthFt + 2, 0), "lf");
    const timber = awnings.filter((o) => o.awning!.brackets === "timber").length;
    if (timber) add("trim", "awning.bracket.timber", "Timber knee brackets (2 per awning)", timber * 2, "each");
    if (awnings.length - timber) add("trim", "awning.bracket.steel", "Steel awning brackets (2 per awning)", (awnings.length - timber) * 2, "each");
  }
  if (model.materials.trimStyle !== "none") {
    let lf4 = 0;
    let lf6 = 0;
    let cap = 0;
    for (const o of model.openings) {
      const legs = 2 * (o.heightFt + 0.5);
      const across = o.widthFt + 1;
      if (model.materials.trimStyle === "flat") lf4 += legs + across + (o.type === "window" ? across : 0);
      else if (model.materials.trimStyle === "wide") lf6 += legs + across + (o.type === "window" ? across : 0);
      else {
        lf4 += legs + (o.type === "window" ? across * 2 : 0);
        lf6 += across;
        cap += across + 0.5;
      }
    }
    if (lf4) add("trim", "trim.1x4.lf", `1×4 trim boards around ${model.openings.length} openings (+10%)`, lf4 * 1.1, "lf");
    if (lf6) add("trim", "trim.1x6.lf", "1×6 trim boards (heads and wide legs) (+10%)", lf6 * 1.1, "lf");
    if (cap) add("trim", "trim.cap.lf", "Drip caps over the heads", cap, "lf");
  }
  if (model.materials.wainscot.enabled) {
    let sqft = 0;
    for (const b of geometry.boxes) if (b.kind === "wainscot" && b.material !== "trim") sqft += Math.max(b.size[0], b.size[2]) * b.size[1];
    add("siding", `wainscot.${model.materials.wainscot.kind}.sqft`, `${WAINSCOT_LABEL[model.materials.wainscot.kind]} wainscot, ${formatFtIn(model.materials.wainscot.heightFt)} high (+10%)`, sqft * 1.1, "sqft");
  }

  // ---- Runs and fencing (materials only; the fence contractor's labour is separate)
  if (model.runs.length > 0 || model.fences.length > 0) {
    const f = deriveFencing(model);
    for (const k of f.byKind) {
      const preset = FENCE_PRESETS[k.kind];
      if (preset.material === "roll") add("fencing", k.sku, `${preset.label} (${k.fenceFt}' of fence)`, k.rolls, "each");
      if (preset.material === "board") add("fencing", k.sku, `${preset.label} boards (${k.fenceFt}' of fence)`, k.boards, "each");
      if (preset.material === "panel") add("fencing", k.sku, `${preset.label} panels (${k.fenceFt}' of fence)`, k.panels, "each");
      if (preset.material === "strand") {
        add("fencing", k.sku, `${preset.label} (${k.strandFt}' of strand)`, Math.ceil(k.strandFt / 4000), "each");
        add("fencing", "fence.insulator", "Insulators", k.insulators, "each");
      }
      add("fencing", "fence.post.line", `Line posts, ${preset.postSpacingFt}' on centre`, k.linePosts, "each");
      add("fencing", "fence.post.corner", "Corner and gate posts", k.cornerPosts + k.gatePosts, "each");
      if (k.braces) add("fencing", "fence.brace", "H-brace assemblies at corners and gates", k.braces, "each");
      if (k.topRailBoards) add("fencing", "fence.board.16", "2×6×16' top rail", k.topRailBoards, "each");
      add("fencing", "fence.staples", "Staples and clips", Math.ceil(k.fenceFt / 100), "each");
      add("fencing", "fence.concrete.bag", "Concrete for corner and gate posts", k.concreteBags, "each");
    }
    for (const g of f.gates) add("fencing", `gate.${g.widthFt}`, `${g.widthFt}' tube gates`, g.count, "each");
    if (f.chargers) add("fencing", "fence.charger", "Fence charger", f.chargers, "each");
  }

  // ---- Totals
  const byCat = new Map<PriceCategory, number>();
  for (const l of lines) byCat.set(l.category, (byCat.get(l.category) ?? 0) + l.cost);
  const byCategory = [...byCat.entries()].map(([category, cost]) => ({ category, label: PRICE_CATEGORY_LABEL[category], cost: round(cost) })).sort((a, b) => b.cost - a.cost);
  const total = round(lines.reduce((a, l) => a + l.cost, 0));
  return { lines, byCategory, total, low: round(total * 0.85), high: round(total * 1.15) };
}

/** Approximate trim run: ridge, 2 rakes per gable end, 2 eaves, 4 corners, base all round. */
function trimLength(model: BuildingModel, geometry: Geometry): number {
  if (model.footprint.kind !== "rect") return 0;
  const { wFt: W, dFt: D } = model.footprint;
  const ridgeNS = model.roof.ridgeAxis === "ns";
  const along = ridgeNS ? D : W;
  const span = ridgeNS ? W : D;
  const theta = Math.atan2(model.roof.pitch, 12);
  const rake = (span / 2 + model.roof.overhangEaveIn / 12) / Math.cos(theta);
  const ridge = model.roof.form === "shed" ? 0 : along + (2 * model.roof.overhangGableIn) / 12;
  const eaves = 2 * (along + (2 * model.roof.overhangGableIn) / 12);
  const rakes = model.roof.form === "shed" ? 2 * (span / Math.cos(theta)) : 4 * rake;
  const corners = 4 * model.eaveHeightFt;
  const base = 2 * (W + D);
  const leanTo = geometry.boxes.filter((b) => b.kind === "roofPlane" && b.entityId.startsWith("lt_")).reduce((a, b) => a + Math.max(b.size[0], b.size[2]) * 2, 0);
  return Math.round(ridge + eaves + rakes + corners + base + leanTo);
}

function polygonArea(v: [number, number, number][]): number {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return Math.hypot(nx, ny, nz) / 2;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
