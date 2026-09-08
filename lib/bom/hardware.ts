/**
 * Hardware schedule (SPEC §7.4, §20; research: docs/research/construction-details.md §12).
 * Every line says what it is, how many, and where it goes. Counts follow the
 * Builder's "hardware per unit" table; `HW` holds the per-unit constants.
 */
import type { BuildingModel } from "@/lib/model/schema";
import type { FramingSet } from "@/lib/framing/types";
import type { Geometry } from "@/lib/geometry/types";
import { interiorDoors } from "@/lib/interior/partitions";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";

export interface HardwareLine {
  sku: string;
  description: string;
  quantity: number;
  unit: "each" | "lf" | "lb";
  /** Where it goes, for the install notes. */
  note: string;
  /** Group for the printed schedule. */
  group: "Posts & footings" | "Carriers & girts" | "Trusses & purlins" | "Braces" | "Roof & wall steel" | "Lean-to" | "Doors & windows" | "Stalls";
}

/** Fastening defaults (research §12). */
export const HW = {
  upliftBlocksPerPost: 2,
  upliftLagsPerPost: 4,
  rebarPerPost: 2,
  boltsPerPostCarrier: 2, // ½" × 8" carriage bolts, notched detail
  carrierPlyNailsPerFt: 2, // 16d, two rows at 12"
  girtNailsPerCrossing: 2, // 16d ring-shank
  skirtNailsPerCrossing: 3,
  trussToeNailsPerBearing: 3,
  hurricaneTiesPerBearing: 1,
  tieNailsEach: 10,
  spacerBlockNails: 4,
  purlinToeNailsPerCrossing: 2,
  purlinLapNails: 3,
  roofScrewsPerPanel: (rows: number) => 16 + 5 * Math.max(0, rows - 2),
  wallScrewsPerPanel: (rows: number) => 16 + 4 * Math.max(0, rows - 2),
  kneeBraceBolt: 1,
  kneeBraceNails: 6,
  slidingTrackFactor: 2, // track length = 2 × opening width
  nailsPerLb16d: 45,
  matsPerStall: 6, // 4' × 6' × ¾" mats in a 12 × 12
} as const;

export function hardwareSchedule(model: BuildingModel, framing: FramingSet, geometry: Geometry): HardwareLine[] {
  const out: HardwareLine[] = [];
  const add = (group: HardwareLine["group"], sku: string, description: string, quantity: number, unit: HardwareLine["unit"], note: string) => {
    if (quantity > 0) out.push({ sku, description, quantity: Math.ceil(quantity), unit, note, group });
  };
  const stick = model.frame.system === "stickFrame";
  const mainPosts = framing.posts.filter((p) => !p.id.startsWith("ltpost"));
  const posts = mainPosts.length;
  const bearingPosts = mainPosts.filter((p) => p.role !== "endwall").length;
  const trusses = framing.trussSpec?.count ?? 0;
  const bearings = trusses * 2;
  const carriers = framing.members.filter((m) => m.kind === "carrier" && !m.entityId.startsWith("lt_"));
  const carrierFt = carriers.reduce((a, m) => a + m.lengthFt, 0);
  const girts = framing.members.filter((m) => m.kind === "girt");
  const skirts = framing.members.filter((m) => m.kind === "skirt");
  const bay = model.frame.bayFt;
  const girtCrossings = girts.reduce((a, m) => a + Math.floor(m.lengthFt / bay + 1e-9) + 1, 0);
  const skirtCrossings = skirts.reduce((a, m) => a + Math.floor(m.lengthFt / bay + 1e-9) + 1, 0);
  const purlins = framing.members.filter((m) => m.kind === "purlin" && !m.entityId.startsWith("lt_"));
  const purlinCrossings = purlins.reduce((a, m) => a + Math.floor(m.lengthFt / (model.frame.trusses.spacingIn / 12) + 1e-9) + 1, 0);
  const purlinRowsPerPlane = purlins.length ? Math.max(1, Math.round(purlins.length / (model.roof.form === "shed" ? 1 : 2))) : 0;
  const braces = framing.members.filter((m) => m.kind === "kneeBrace").length;

  // ---- Posts & footings
  if (!stick && model.frame.post.foundation === "embedded") {
    add("Posts & footings", "hw.upliftBlock", "PT 2×6 × 12\" uplift blocks", posts * HW.upliftBlocksPerPost, "each", "Two per post, 6\" above the pad, lagged on opposite faces.");
    add("Posts & footings", "hw.lag12x5", "½\" × 5\" HDG lag screws", posts * HW.upliftLagsPerPost, "each", "Two per uplift block.");
    add("Posts & footings", "hw.rebar", "#4 × 9\" rebar pins", posts * HW.rebarPerPost, "each", "Crossed through the post at 3\" and 9\" up.");
  } else if (!stick) {
    add("Posts & footings", "hw.postBracket", "Wet-set post base brackets", posts, "each", "Set in the pier; keep the post 1\" off the concrete.");
  }
  // ---- Carriers & girts
  if (!stick) {
    add("Carriers & girts", "hw.carriageBolt", "½\" × 8\" HDG carriage bolts, nuts and washers", bearingPosts * HW.boltsPerPostCarrier, "each", "Two per bearing post through both carrier plies in the notch; washers both sides.");
    const carrierNails = carrierFt * HW.carrierPlyNailsPerFt + carriers.length * 6;
    const girtNails = girtCrossings * HW.girtNailsPerCrossing + skirtCrossings * HW.skirtNailsPerCrossing;
    add("Carriers & girts", "hw.nail16d.lb", "16d HDG ring-shank nails (lb)", (carrierNails + girtNails) / HW.nailsPerLb16d, "lb", `${Math.ceil(carrierNails)} for the carrier plies, ${Math.ceil(girtNails)} for girts and skirt (${HW.girtNailsPerCrossing} per girt–post, ${HW.skirtNailsPerCrossing} per skirt–post).`);
    if (model.frame.girts.mount === "bookshelf") add("Carriers & girts", "hw.girtHanger", "Bookshelf girt hangers", girts.length * 2, "each", "One at each girt end.");
    add("Carriers & girts", "hw.ptBarrier.lf", "Barrier strip between the skirt and the concrete / steel", skirts.reduce((a, m) => a + m.lengthFt, 0), "lf", "15-lb felt or poly, 8\" wide, over the skirt face.");
  } else {
    add("Carriers & girts", "hw.anchorBolt", "½\" anchor bolts", Math.ceil(framing.members.filter((m) => m.kind === "plate" && m.id.endsWith("bottom")).reduce((a, m) => a + m.lengthFt / 6 + 1, 0)), "each", "Every 6' and within 12\" of each plate end.");
  }
  // ---- Trusses & purlins
  if (bearings) {
    add("Trusses & purlins", "hw.hurricaneTie", "Hurricane ties (H2.5A class)", bearings * HW.hurricaneTiesPerBearing, "each", "One per truss bearing; fill every hole.");
    add("Trusses & purlins", "hw.tieNail", "1½\" × 0.131 tie nails", bearings * HW.tieNailsEach, "each", `${HW.tieNailsEach} per tie.`);
    add("Trusses & purlins", "hw.spacerBlock", "2×4 × 46½\" truss spacer blocks", Math.max(0, trusses - 1) * 2, "each", "One per truss space on each bearing wall, four 16d each.");
    const trussNails = bearings * HW.trussToeNailsPerBearing + Math.max(0, trusses - 1) * 2 * HW.spacerBlockNails + purlinCrossings * HW.purlinToeNailsPerCrossing + purlins.length * HW.purlinLapNails;
    add("Trusses & purlins", "hw.nail16d.lb", "16d nails for truss toe-nails, spacer blocks and purlins (lb)", trussNails / HW.nailsPerLb16d, "lb", `${HW.trussToeNailsPerBearing} toe-nails per bearing, ${HW.purlinToeNailsPerCrossing} per purlin–truss crossing, ${HW.purlinLapNails} per lap.`);
  }
  // ---- Braces
  if (braces) {
    add("Braces", "hw.carriageBolt", "½\" × 8\" carriage bolts for knee braces", braces * HW.kneeBraceBolt, "each", "One at the post end of each brace.");
    add("Braces", "hw.braceBlock", "2×6 × 24\" brace blocks", braces, "each", "Nailed flat to the truss bottom chord with six 16d; the brace bears on it.");
  }
  // ---- Steel
  let roofPanels = 0;
  let wallPanels = 0;
  let roofLf = 0;
  let wallLf = 0;
  for (const b of geometry.boxes) {
    if (b.kind === "roofPlane") {
      const along = Math.max(b.size[0], b.size[2]);
      const across = Math.min(b.size[0], b.size[2]);
      roofPanels += Math.ceil(along / 3);
      roofLf += Math.ceil(along / 3) * across;
    }
    if (b.kind === "wallSkin" || b.kind === "leanToSkin") {
      const along = Math.max(b.size[0], b.size[2]);
      wallPanels += Math.ceil(along / 3);
      wallLf += Math.ceil(along / 3) * b.size[1];
    }
  }
  const girtRows = Math.max(2, Math.round(model.eaveHeightFt / (model.frame.girts.spacingIn / 12)) + 1);
  const roofScrews = roofPanels * HW.roofScrewsPerPanel(purlinRowsPerPlane);
  const wallScrews = wallPanels * HW.wallScrewsPerPanel(girtRows);
  add("Roof & wall steel", "hw.panelScrew", "#10 × 1\" panel screws with EPDM washers (+10%)", (roofScrews + wallScrews) * 1.1, "each", `${roofScrews} roof (16 per panel + 5 per extra purlin row), ${wallScrews} wall (16 + 4 per extra girt row).`);
  add("Roof & wall steel", "hw.stitchScrew", "¼\" × ⅞\" lap (stitch) screws", roofLf / 2 + wallLf / 3, "each", "Every 24\" on roof laps, 36\" on wall laps.");
  add("Roof & wall steel", "hw.panelScrew", "#10 × 1\" trim screws (+ stitch screws to panels)", Math.ceil((roofLf + wallLf) / 10) * 2, "each", "About ten into wood and ten stitch per 10' of trim.");
  add("Roof & wall steel", "closure.lf", "Foam closures", roofPanels * 3 * 3, "lf", "Outside closure at the eave, two inside at the ridge, per roof panel.");
  add("Roof & wall steel", "hw.butyl.lf", "Butyl tape", (model.footprint.kind === "rect" ? (model.roof.ridgeAxis === "ns" ? model.footprint.dFt : model.footprint.wFt) : 0) + roofPanels * 0.5, "lf", "Under the ridge cap laps and every panel end lap.");
  // ---- Lean-to
  for (const lt of model.leanTos) {
    const rafters = framing.members.filter((m) => m.id.startsWith(`ltrafter_${lt.id}`)).length;
    const ledgerPosts = framing.posts.filter((p) => p.wallId === (model.walls.find((w) => w.side === lt.side)?.id ?? "") && !p.id.startsWith("ltpost")).length;
    const ledgerFt = framing.members.filter((m) => m.id === `ltledger_${lt.id}`).reduce((a, m) => a + m.lengthFt, 0);
    add("Lean-to", "hw.rafterHanger", "Slopeable rafter hangers (LSSR26Z class)", rafters, "each", `${lt.side.toUpperCase()} lean-to: one per rafter at the ledger.`);
    add("Lean-to", "hw.hurricaneTie", "Hurricane ties at the lean-to header", rafters, "each", "One per rafter where it bears on the header.");
    add("Lean-to", "hw.lag12x8", "½\" × 8\" HDG lag screws, ledger to posts", ledgerPosts * 2, "each", "Two at every barn post the ledger crosses, staggered.");
    add("Lean-to", "hw.structuralScrew", "¼\" × 4½\" structural screws, ledger between posts", ledgerFt * 0.75, "each", "Every 16\", staggered top and bottom, into the girt behind.");
    add("Lean-to", "hw.postCap", "Post caps / ties at the lean-to outer posts", framing.posts.filter((p) => p.id.startsWith(`ltpost_${lt.id}`)).length, "each", "Header to post.");
  }
  // ---- Doors & windows
  for (const o of model.openings) {
    switch (o.type) {
      case "slidingDoor": {
        const track = o.widthFt * HW.slidingTrackFactor;
        add("Doors & windows", "hw.slidingTrack.lf", `Sliding door track, ${Math.round(track)}' with brackets and 2×8 track board`, track, "lf", `Track twice the ${o.widthFt}' opening; bracket every 2' + 1; ⅜" × 4" lags at 16" into the track board.`);
        add("Doors & windows", "hw.slidingLeafKit", "Sliding leaf hardware (2 trolleys, stay roller, latch, stops, handles)", o.swing === "biParting" ? 2 : 1, "each", "Per leaf.");
        break;
      }
      case "overheadDoor":
      case "rollUpDoor":
        add("Doors & windows", "hw.ohFraming", "Overhead / roll-up door framing kit (2×6 PT jambs, head, 2-ply header on hangers, weather-stop)", 1, "each", `${o.widthFt}' × ${o.heightFt}' door; the door, track and springs come from the supplier.`);
        break;
      case "manDoor":
      case "doubleDoor":
      case "dutchDoor":
        add("Doors & windows", "hw.doorBuck", "Door buck (2×6 jambs + head + PT sill, shims, foam, drip cap, J-trim, sealant)", 1, "each", `${o.widthFt}' × ${o.heightFt}' ${o.type === "dutchDoor" ? "Dutch door: 4 T-hinges, 2 latches, chew guard" : "pre-hung unit: 18 screws, lockset"}.`);
        break;
      case "window":
        add("Doors & windows", "hw.windowKit", "Window install kit (2×6 sill/head/jambs, flashing tape, fin screws, J-trim, head trim, sealant)", 1, "each", `${o.widthFt}' × ${o.heightFt}' window; rough opening unit + ½".`);
        break;
      default:
        break;
    }
  }
  // ---- Stalls
  const pens = model.zones.filter((z) => z.type === "pen" || z.type === "kidding");
  if (pens.length) {
    let sections = 0;
    let grilleLf = 0;
    for (const b of geometry.boxes) {
      if (b.kind === "partition" && b.material === "floorWood") sections += Math.max(1, Math.ceil(Math.max(b.size[0], b.size[2]) / 12));
      if (b.kind === "grille") grilleLf += Math.max(b.size[0], b.size[2]);
    }
    add("Stalls", "hw.uChannel.lf", "Steel U-channel for the kick boards", sections * 2 * 4.25, "lf", "One 4'-3\" channel on each post face of every stall section, six ¼\" × 3\" lags each.");
    add("Stalls", "hw.lag14x3", "¼\" × 3\" lags for channels and grilles", sections * 2 * 6 + Math.ceil(grilleLf / 12) * 4, "each", "Six per channel, four per grille panel.");
    add("Stalls", "hw.mat", "Rubber stall mats, 4' × 6' × ¾\"", pens.reduce((a, z) => a + HW.matsPerStall * Math.max(0.5, (Math.abs((z.polygon[2].x - z.polygon[0].x) * (z.polygon[2].y - z.polygon[0].y)) || 144) / 144), 0), "each", "Six per 12 × 12 stall over the concrete.");
    add("Stalls", "hw.stallSmalls", "Stall smalls (feeder, waterer bracket, hooks, blanket bar, salt holder) per stall", pens.length, "each", "Per stall.");
  }
  for (const { door } of interiorDoors(model)) {
    const preset = INTERIOR_DOOR_PRESETS[door.type];
    for (const h of preset.hardware) add("Stalls", h.sku, h.label, h.sku === "hw.stallTrack" ? Math.ceil((door.widthFt * 2) / 8) : h.qty, "each", `${preset.label}.`);
  }
  // Merge identical sku+description lines.
  const merged = new Map<string, HardwareLine>();
  for (const l of out) {
    const k = `${l.group}|${l.sku}|${l.description}`;
    const cur = merged.get(k);
    if (cur) cur.quantity += l.quantity;
    else merged.set(k, { ...l });
  }
  return [...merged.values()];
}
