/**
 * Placeholder unit costs for the raw-materials estimate (SPEC §7.8, §28).
 * These are national-average ballpark figures, NOT quotes. Every line is
 * labelled `placeholder`; the user can override any of them per project
 * (`model.priceOverrides`). Source: Industry (big-box and lumber-yard list
 * prices, 2025–2026), rounded.
 */
export interface PriceItem {
  sku: string;
  description: string;
  unit: "bf" | "each" | "sqft" | "lf" | "cuyd" | "bag" | "lb";
  unitCost: number;
  category: PriceCategory;
  source: "placeholder";
}

export type PriceCategory = "lumber" | "posts" | "trusses" | "roofSteel" | "siding" | "trim" | "concrete" | "hardware" | "doors" | "windows" | "interior" | "electrical" | "plumbing";

export const PRICE_CATEGORY_LABEL: Record<PriceCategory, string> = {
  lumber: "Framing lumber",
  posts: "Posts",
  trusses: "Trusses",
  roofSteel: "Roof steel",
  siding: "Siding",
  trim: "Trim & closures",
  concrete: "Concrete & gravel",
  hardware: "Hardware & fasteners",
  doors: "Doors",
  windows: "Windows",
  interior: "Stall fronts & partitions",
  electrical: "Electrical",
  plumbing: "Drains & pipe",
};

export const PRICES: PriceItem[] = [
  // Lumber, per board foot (SPF #2 / SYP; PT premium separate)
  { sku: "lumber.spf", description: "Dimensional lumber, SPF #2", unit: "bf", unitCost: 0.95, category: "lumber", source: "placeholder" },
  { sku: "lumber.pt", description: "Pressure-treated lumber (UC3B/UC4B)", unit: "bf", unitCost: 1.35, category: "lumber", source: "placeholder" },
  { sku: "post.6x6", description: "6×6 PT post, ground contact", unit: "bf", unitCost: 1.6, category: "posts", source: "placeholder" },
  { sku: "post.laminated", description: "3-ply laminated column", unit: "bf", unitCost: 2.4, category: "posts", source: "placeholder" },
  // Trusses, per truss, by span band
  { sku: "truss.le24", description: "Common truss ≤ 24' span", unit: "each", unitCost: 150, category: "trusses", source: "placeholder" },
  { sku: "truss.le32", description: "Common truss 25–32' span", unit: "each", unitCost: 210, category: "trusses", source: "placeholder" },
  { sku: "truss.le40", description: "Common truss 33–40' span", unit: "each", unitCost: 290, category: "trusses", source: "placeholder" },
  { sku: "truss.gt40", description: "Common truss > 40' span", unit: "each", unitCost: 420, category: "trusses", source: "placeholder" },
  // Steel, per square foot of panel
  { sku: "steel.roof29", description: "29 ga steel roofing panel", unit: "sqft", unitCost: 2.1, category: "roofSteel", source: "placeholder" },
  { sku: "steel.wall29", description: "29 ga steel siding panel", unit: "sqft", unitCost: 2.0, category: "siding", source: "placeholder" },
  { sku: "trim.lf", description: "Steel trim (ridge, rake, eave, corner, base)", unit: "lf", unitCost: 3.2, category: "trim", source: "placeholder" },
  { sku: "closure.lf", description: "Foam closure strips", unit: "lf", unitCost: 0.6, category: "trim", source: "placeholder" },
  // Concrete
  { sku: "concrete.cuyd", description: "Ready-mix concrete, 3500 psi, delivered", unit: "cuyd", unitCost: 165, category: "concrete", source: "placeholder" },
  { sku: "concrete.bag", description: "80 lb bagged concrete (post collars)", unit: "bag", unitCost: 7.5, category: "concrete", source: "placeholder" },
  { sku: "gravel.cuyd", description: "Compacted gravel base", unit: "cuyd", unitCost: 45, category: "concrete", source: "placeholder" },
  { sku: "mesh.sqft", description: "Welded wire mesh / fiber reinforcement", unit: "sqft", unitCost: 0.35, category: "concrete", source: "placeholder" },
  // Hardware (per unit)
  { sku: "hw.hurricaneTie", description: "Hurricane tie (H2.5A class)", unit: "each", unitCost: 1.1, category: "hardware", source: "placeholder" },
  { sku: "hw.carriageBolt", description: "½\" × 8\" carriage bolt with nut/washer", unit: "each", unitCost: 3.2, category: "hardware", source: "placeholder" },
  { sku: "hw.structuralScrew", description: "¼\" × 4\" structural screw", unit: "each", unitCost: 0.55, category: "hardware", source: "placeholder" },
  { sku: "hw.panelScrew", description: "#10 × 1½\" steel panel screw w/ washer", unit: "each", unitCost: 0.09, category: "hardware", source: "placeholder" },
  { sku: "hw.nail16d.lb", description: "16d ring-shank nails", unit: "lb", unitCost: 3.8, category: "hardware", source: "placeholder" },
  { sku: "hw.upliftCleat", description: "Uplift cleat / rebar per post", unit: "each", unitCost: 6, category: "hardware", source: "placeholder" },
  { sku: "hw.postBracket", description: "Wet-set post base bracket", unit: "each", unitCost: 38, category: "hardware", source: "placeholder" },
  { sku: "hw.slidingTrack.lf", description: "Sliding door track, brackets and track board", unit: "lf", unitCost: 14, category: "hardware", source: "placeholder" },
  { sku: "hw.slidingLeafKit", description: "Sliding leaf hardware set (trolleys, stay roller, latch, stops, handles)", unit: "each", unitCost: 140, category: "hardware", source: "placeholder" },
  { sku: "hw.upliftBlock", description: "PT 2×6 × 12\" uplift block", unit: "each", unitCost: 2.5, category: "hardware", source: "placeholder" },
  { sku: "hw.lag12x5", description: "½\" × 5\" HDG lag screw", unit: "each", unitCost: 1.4, category: "hardware", source: "placeholder" },
  { sku: "hw.lag12x8", description: "½\" × 8\" HDG lag screw with washer", unit: "each", unitCost: 2.6, category: "hardware", source: "placeholder" },
  { sku: "hw.lag14x3", description: "¼\" × 3\" lag screw", unit: "each", unitCost: 0.35, category: "hardware", source: "placeholder" },
  { sku: "hw.rebar", description: "#4 × 9\" rebar pin", unit: "each", unitCost: 1.2, category: "hardware", source: "placeholder" },
  { sku: "hw.girtHanger", description: "Bookshelf girt hanger", unit: "each", unitCost: 3.4, category: "hardware", source: "placeholder" },
  { sku: "hw.ptBarrier.lf", description: "Skirt barrier strip (felt / poly), 8\" wide", unit: "lf", unitCost: 0.25, category: "hardware", source: "placeholder" },
  { sku: "hw.anchorBolt", description: "½\" anchor bolt", unit: "each", unitCost: 1.8, category: "hardware", source: "placeholder" },
  { sku: "hw.tieNail", description: "1½\" × 0.131 tie nail", unit: "each", unitCost: 0.03, category: "hardware", source: "placeholder" },
  { sku: "hw.spacerBlock", description: "2×4 × 46½\" truss spacer block", unit: "each", unitCost: 2.2, category: "hardware", source: "placeholder" },
  { sku: "hw.braceBlock", description: "2×6 × 24\" brace block", unit: "each", unitCost: 2.6, category: "hardware", source: "placeholder" },
  { sku: "hw.stitchScrew", description: "¼\" × ⅞\" lap screw", unit: "each", unitCost: 0.08, category: "hardware", source: "placeholder" },
  { sku: "hw.butyl.lf", description: "Butyl sealant tape", unit: "lf", unitCost: 0.3, category: "hardware", source: "placeholder" },
  { sku: "hw.rafterHanger", description: "Slopeable rafter hanger (LSSR26Z class) with nails", unit: "each", unitCost: 9.5, category: "hardware", source: "placeholder" },
  { sku: "hw.postCap", description: "Post cap / tie set", unit: "each", unitCost: 18, category: "hardware", source: "placeholder" },
  { sku: "hw.ohFraming", description: "Overhead door framing kit (PT jambs, head, 2-ply header, hangers)", unit: "each", unitCost: 160, category: "hardware", source: "placeholder" },
  { sku: "hw.doorBuck", description: "Door buck and install kit", unit: "each", unitCost: 85, category: "hardware", source: "placeholder" },
  { sku: "hw.windowKit", description: "Window install kit (bucks, flashing, trims, sealant)", unit: "each", unitCost: 55, category: "hardware", source: "placeholder" },
  { sku: "hw.mat", description: "Rubber stall mat, 4' × 6' × ¾\"", unit: "each", unitCost: 48, category: "interior", source: "placeholder" },
  { sku: "hw.stallSmalls", description: "Stall smalls (feeder, hooks, blanket bar, salt holder)", unit: "each", unitCost: 70, category: "interior", source: "placeholder" },
  { sku: "hw.stallDoorKit", description: "Stall sliding door hardware kit", unit: "each", unitCost: 120, category: "interior", source: "placeholder" },
  { sku: "hw.gateHinge", description: "Gate hinge/latch set", unit: "each", unitCost: 45, category: "interior", source: "placeholder" },
  { sku: "hw.uChannel.lf", description: "Steel U-channel for T&G kick-walls", unit: "lf", unitCost: 4.5, category: "interior", source: "placeholder" },
  { sku: "grille.lf", description: "Stall grille panel (per lf of partition)", unit: "lf", unitCost: 32, category: "interior", source: "placeholder" },
  { sku: "tg.2x6.lf", description: "2×6 T&G kick-wall board", unit: "lf", unitCost: 1.9, category: "interior", source: "placeholder" },
  // Doors and windows, per unit
  { sku: "door.man", description: "Steel man door, prehung", unit: "each", unitCost: 420, category: "doors", source: "placeholder" },
  { sku: "door.double", description: "Double steel door", unit: "each", unitCost: 1100, category: "doors", source: "placeholder" },
  { sku: "door.dutch", description: "Dutch door (stall exterior)", unit: "each", unitCost: 650, category: "doors", source: "placeholder" },
  { sku: "door.sliding.sqft", description: "Sliding door leaf (site-built, steel-clad)", unit: "sqft", unitCost: 9, category: "doors", source: "placeholder" },
  { sku: "door.overhead.sqft", description: "Sectional overhead door, installed hardware", unit: "sqft", unitCost: 18, category: "doors", source: "placeholder" },
  { sku: "door.rollup.sqft", description: "Roll-up coil door", unit: "sqft", unitCost: 15, category: "doors", source: "placeholder" },
  { sku: "window.sqft", description: "Vinyl slider / fixed window with grille", unit: "sqft", unitCost: 28, category: "windows", source: "placeholder" },
  // Interior doors (stall fronts and rooms) and their hardware
  { sku: "door.stallSlide", description: "Sliding stall door leaf (site-built, grille top)", unit: "each", unitCost: 380, category: "interior", source: "placeholder" },
  { sku: "door.stallHinged", description: "Hinged stall door leaf", unit: "each", unitCost: 320, category: "interior", source: "placeholder" },
  { sku: "door.dutchInterior", description: "Interior Dutch door (two leaves)", unit: "each", unitCost: 520, category: "interior", source: "placeholder" },
  { sku: "door.woodPrehung", description: "Pre-hung wood door, interior", unit: "each", unitCost: 260, category: "doors", source: "placeholder" },
  { sku: "hw.stallTrack", description: "Box track, 8' section with end stops", unit: "each", unitCost: 95, category: "interior", source: "placeholder" },
  { sku: "hw.stallHanger", description: "Trolley hanger", unit: "each", unitCost: 22, category: "interior", source: "placeholder" },
  { sku: "hw.stallLatch", description: "Stall door latch", unit: "each", unitCost: 18, category: "interior", source: "placeholder" },
  { sku: "hw.floorGuide", description: "Floor guide / stay roller", unit: "each", unitCost: 12, category: "interior", source: "placeholder" },
  { sku: "hw.strapHinge", description: "Heavy strap hinge, 12\"", unit: "each", unitCost: 14, category: "interior", source: "placeholder" },
  { sku: "hw.holdBack", description: "Door hold-back hook", unit: "each", unitCost: 6, category: "interior", source: "placeholder" },
  { sku: "hw.lockset", description: "Lockset / passage set", unit: "each", unitCost: 35, category: "hardware", source: "placeholder" },
  // Electrical (docs/research/electrical-planning.md §9)
  { sku: "elec.panel", description: "Main-breaker sub-panel, 100 A, 20 spaces, NEMA 1", unit: "each", unitCost: 180, category: "electrical", source: "placeholder" },
  { sku: "elec.breaker1", description: "Single-pole breaker", unit: "each", unitCost: 12, category: "electrical", source: "placeholder" },
  { sku: "elec.breaker2", description: "Two-pole breaker", unit: "each", unitCost: 28, category: "electrical", source: "placeholder" },
  { sku: "elec.groundRods", description: "Two ground rods, clamps and 6 AWG GEC", unit: "each", unitCost: 60, category: "electrical", source: "placeholder" },
  { sku: "elec.lightStrip", description: "4' LED vapor-tight strip light, 40 W", unit: "each", unitCost: 48, category: "electrical", source: "placeholder" },
  { sku: "elec.flood", description: "LED wall pack / floodlight, 50 W", unit: "each", unitCost: 45, category: "electrical", source: "placeholder" },
  { sku: "elec.outletGfci", description: "20 A WR GFCI duplex with in-use cover", unit: "each", unitCost: 26, category: "electrical", source: "placeholder" },
  { sku: "elec.switch", description: "Single-pole switch with weatherproof cover", unit: "each", unitCost: 8, category: "electrical", source: "placeholder" },
  { sku: "elec.fan", description: "24\" agricultural circulation fan", unit: "each", unitCost: 160, category: "electrical", source: "placeholder" },
  { sku: "elec.waterer", description: "Heated automatic waterer", unit: "each", unitCost: 450, category: "electrical", source: "placeholder" },
  { sku: "elec.heater", description: "240 V electric unit heater, 5 kW", unit: "each", unitCost: 380, category: "electrical", source: "placeholder" },
  { sku: "elec.box", description: "NEMA 4X PVC device / junction box", unit: "each", unitCost: 7, category: "electrical", source: "placeholder" },
  { sku: "elec.wire14.ft", description: "14 AWG Cu (UF-B 14/2 w/ ground)", unit: "lf", unitCost: 0.55, category: "electrical", source: "placeholder" },
  { sku: "elec.wire12.ft", description: "12 AWG Cu (UF-B 12/2 w/ ground)", unit: "lf", unitCost: 0.8, category: "electrical", source: "placeholder" },
  { sku: "elec.wire10.ft", description: "10 AWG Cu (UF-B 10/2 w/ ground)", unit: "lf", unitCost: 1.3, category: "electrical", source: "placeholder" },
  { sku: "elec.wire8.ft", description: "8 AWG Cu THWN (2 + ground)", unit: "lf", unitCost: 2.2, category: "electrical", source: "placeholder" },
  { sku: "elec.wire6.ft", description: "6 AWG Cu THWN (2 + ground)", unit: "lf", unitCost: 3.4, category: "electrical", source: "placeholder" },
  { sku: "elec.conduit.ft", description: "¾\" PVC Schedule 40 conduit with fittings and straps", unit: "lf", unitCost: 1.4, category: "electrical", source: "placeholder" },
  { sku: "elec.feeder60.ft", description: "60 A feeder: 4 × 6 AWG Cu THWN in 1¼\" PVC, buried 18\"", unit: "lf", unitCost: 6.5, category: "electrical", source: "placeholder" },
  { sku: "elec.feeder100.ft", description: "100 A feeder: 3 AWG Cu (or 1 AWG Al) in 1½\" PVC, buried 18\"", unit: "lf", unitCost: 11, category: "electrical", source: "placeholder" },
  { sku: "elec.feeder200.ft", description: "200 A feeder: 3/0 Cu (or 4/0 Al) in 2\" PVC, buried 18\"", unit: "lf", unitCost: 22, category: "electrical", source: "placeholder" },
  { sku: "elec.circuitMisc", description: "Straps, connectors, wire nuts, labels per circuit", unit: "each", unitCost: 18, category: "electrical", source: "placeholder" },
  // Floor drainage (ADR-0016)
  { sku: "drain.floor4", description: "4\" floor drain with deep-seal trap, sediment bucket and cast grate", unit: "each", unitCost: 95, category: "plumbing", source: "placeholder" },
  { sku: "drain.trench.lf", description: "Trench drain channel with hoof-rated grate", unit: "lf", unitCost: 52, category: "plumbing", source: "placeholder" },
  { sku: "drain.catchBasin", description: "Catch basin / trap at a trench drain outlet", unit: "each", unitCost: 120, category: "plumbing", source: "placeholder" },
  { sku: "drain.trapPrimer", description: "Trap primer valve", unit: "each", unitCost: 45, category: "plumbing", source: "placeholder" },
  { sku: "pipe.pvc3.ft", description: "3\" PVC drain pipe", unit: "lf", unitCost: 1.9, category: "plumbing", source: "placeholder" },
  { sku: "pipe.pvc4.ft", description: "4\" PVC drain pipe", unit: "lf", unitCost: 2.6, category: "plumbing", source: "placeholder" },
  { sku: "pipe.pvc6.ft", description: "6\" PVC drain pipe", unit: "lf", unitCost: 4.4, category: "plumbing", source: "placeholder" },
  { sku: "pipe.fitting", description: "PVC drain fitting (elbow, wye, coupling)", unit: "each", unitCost: 11, category: "plumbing", source: "placeholder" },
  { sku: "pipe.cleanout", description: "Cleanout with cap and floor cover", unit: "each", unitCost: 32, category: "plumbing", source: "placeholder" },
  { sku: "pipe.bedding.ft", description: "Gravel pipe bedding, 4\" under and cover", unit: "lf", unitCost: 1.1, category: "plumbing", source: "placeholder" },
  { sku: "drain.daylightEnd", description: "Daylight end: rodent screen, flap and splash pad", unit: "each", unitCost: 40, category: "plumbing", source: "placeholder" },
  { sku: "drain.dryWell", description: "Dry well: pit, 4 cu yd of stone, barrel and fabric", unit: "each", unitCost: 420, category: "plumbing", source: "placeholder" },
];

export const PRICE_BY_SKU: Record<string, PriceItem> = Object.fromEntries(PRICES.map((p) => [p.sku, p]));

export function unitCost(sku: string, overrides: Record<string, number> = {}): number {
  if (overrides[sku] !== undefined) return overrides[sku];
  return PRICE_BY_SKU[sku]?.unitCost ?? 0;
}
