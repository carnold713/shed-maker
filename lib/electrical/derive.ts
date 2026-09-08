/**
 * Electrical derivation (ADR-0013): from placed fixtures and the service
 * size, work out circuits, breaker and wire sizes, voltage drop, the plan
 * routes each circuit follows, the panel load and the lighting level of
 * every zone. Pure and deterministic; the plan, the inspector, the rules
 * and the blueprint sheets all read this.
 *
 * Code basis (2023 NEC unless noted): 547.5 wiring methods / GFCI in
 * agricultural buildings, 210.19(A) IN 4 voltage drop, 210.20(A) continuous
 * loads at 125 %, 220.14(I) 180 VA per receptacle, 220.44 receptacle demand,
 * 430.24 largest motor + 25 %, 310.16 conductor ampacity (60 °C column for
 * NM / UF), 310.12 service & feeder conductors.
 */
import type { BuildingModel, ElectricalFixture, FixtureKind, Zone } from "@/lib/model/schema";
import { zoneRect } from "@/lib/model/zones";
import { lumensNeeded, lumensOf, TARGET_FC } from "./lighting";
import { FIXTURE_PRESETS, fixturesInZone } from "@/lib/model/electrical";

export type CircuitKind = "lighting" | "receptacle" | "fan" | "waterer" | "dedicated";

export interface Circuit {
  id: string;
  /** Panel label, e.g. "L1", "R2", "H1". */
  label: string;
  kind: CircuitKind;
  breakerAmps: number;
  volts: 120 | 240;
  poles: 1 | 2;
  gfci: boolean;
  fixtureIds: string[];
  /** Sum of nameplate loads (receptacles counted at 180 VA), watts. */
  connectedWatts: number;
  /** Design load for the breaker (continuous loads at 125 %), watts. */
  designWatts: number;
  loadAmps: number;
  /** Conductor size, AWG copper. */
  wireAwg: number;
  /** One-way run to the farthest device, feet (plan route + drops). */
  runFt: number;
  /** Cable / conductor feet to buy for this circuit (route + drops + 15 % + a foot per box). */
  wireFt: number;
  voltageDropPct: number;
  /** True when the gauge was bumped to hold voltage drop under 3 %. */
  upsizedForDrop: boolean;
}

export interface RouteSegment {
  circuitId: string;
  /** Plan polyline, feet. */
  points: { x: number; y: number }[];
  lengthFt: number;
}

export interface ZoneLighting {
  zoneId: string;
  name: string;
  type: Zone["type"];
  sqFt: number;
  targetFc: number;
  neededLumens: number;
  providedLumens: number;
  /** Estimated maintained foot-candles from the lights inside the zone. */
  estimatedFc: number;
  lightCount: number;
  /** Additional default LED strips to reach the target. */
  moreLights: number;
}

export interface PanelLoad {
  connectedWatts: number;
  /** NEC 220 demand load, VA. */
  demandVa: number;
  demandAmps: number;
  serviceAmps: number;
  utilisationPct: number;
  byCategory: Record<CircuitKind, number>;
  /** Breaker spaces used (2 per 240 V circuit). */
  breakerSpaces: number;
  /** Recommended panel size, spaces. */
  panelSpaces: number;
  /** Feeder conductor, copper, for the service size (NEC 310.12). */
  feederAwg: string;
  feederAlAwg: string;
  feederDropPct: number;
}

export interface ElectricalDerived {
  fixtures: ElectricalFixture[];
  panel: { x: number; y: number; wallId?: string; placed: boolean };
  circuits: Circuit[];
  routes: RouteSegment[];
  load: PanelLoad;
  zoneLighting: ZoneLighting[];
  /** Total conductor feet by gauge (for the bill of materials). */
  wireByAwg: { awg: number; ft: number }[];
  conduitFt: number;
  boxes: number;
  /** Height the runs travel at, feet (top of the walls / bottom chords). */
  routeHeightFt: number;
}

/** Copper conductor ampacity at 60 °C (NM/UF), NEC 310.16, and circular mils. */
const CU: { awg: number; amps: number; cm: number }[] = [
  { awg: 14, amps: 15, cm: 4107 },
  { awg: 12, amps: 20, cm: 6530 },
  { awg: 10, amps: 30, cm: 10380 },
  { awg: 8, amps: 40, cm: 16510 },
  { awg: 6, amps: 55, cm: 26240 },
];
const STANDARD_BREAKERS = [15, 20, 25, 30, 40, 50, 60];
const K_COPPER = 12.9;
const MAX_DROP_PCT = 3;
const RECEPTACLE_VA = 180;
const MAX_RECEPTACLES_PER_CIRCUIT = 8;

function gaugeFor(amps: number): number {
  return (CU.find((c) => c.amps >= amps) ?? CU[CU.length - 1]).awg;
}

function cmOf(awg: number): number {
  return (CU.find((c) => c.awg === awg) ?? CU[CU.length - 1]).cm;
}

function breakerFor(designWatts: number, volts: number): number {
  const amps = designWatts / volts;
  return STANDARD_BREAKERS.find((b) => b >= amps) ?? 60;
}

/** Perimeter arc-length parameter of a point on the walls, clockwise from the SW corner. */
function perimeterS(W: number, D: number, p: { x: number; y: number }): number {
  const eps = 1e-6;
  if (Math.abs(p.y) < eps) return p.x; // south
  if (Math.abs(p.x - W) < eps) return W + p.y; // east
  if (Math.abs(p.y - D) < eps) return W + D + (W - p.x); // north
  return 2 * W + D + (D - p.y); // west
}

function perimeterPoint(W: number, D: number, s: number): { x: number; y: number } {
  const P = 2 * (W + D);
  s = ((s % P) + P) % P;
  if (s <= W) return { x: s, y: 0 };
  if (s <= W + D) return { x: W, y: s - W };
  if (s <= 2 * W + D) return { x: W - (s - W - D), y: D };
  return { x: 0, y: D - (s - 2 * W - D) };
}

/** Clockwise path along the walls from arc-length sa to sb (forward), with the corners in between. */
function forwardPath(W: number, D: number, sa: number, sb: number): { x: number; y: number }[] {
  const P = 2 * (W + D);
  const corners = [W, W + D, 2 * W + D, P];
  const dist = ((sb - sa) % P + P) % P;
  const pts = [perimeterPoint(W, D, sa)];
  let s = ((sa % P) + P) % P;
  let travelled = 0;
  let guard = 0;
  while (travelled < dist - 1e-6 && guard++ < 16) {
    const next = corners.find((c) => c > s + 1e-6) ?? P;
    const step = Math.min(next - s, dist - travelled);
    s += step;
    travelled += step;
    if (s >= P - 1e-9) s -= P;
    pts.push(perimeterPoint(W, D, s));
  }
  return pts;
}

/** Shortest path along the walls between two perimeter points, with the corners in between. */
function perimeterPath(W: number, D: number, a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
  const P = 2 * (W + D);
  const sa = perimeterS(W, D, a);
  const sb = perimeterS(W, D, b);
  const fwd = ((sb - sa) % P + P) % P;
  const pts = fwd <= P / 2 ? forwardPath(W, D, sa, sb) : forwardPath(W, D, sb, sa).reverse();
  pts[0] = a;
  pts[pts.length - 1] = b;
  return pts;
}

function onPerimeter(W: number, D: number, p: { x: number; y: number }) {
  const eps = 1e-6;
  return Math.abs(p.y) < eps || Math.abs(p.x - W) < eps || Math.abs(p.y - D) < eps || Math.abs(p.x) < eps;
}

/** Foot of the perpendicular from an interior point to the nearest wall. */
function nearestWallFoot(W: number, D: number, p: { x: number; y: number }): { x: number; y: number } {
  const cands = [
    { x: p.x, y: 0, d: p.y },
    { x: W, y: p.y, d: W - p.x },
    { x: p.x, y: D, d: D - p.y },
    { x: 0, y: p.y, d: p.x },
  ];
  const best = cands.sort((a, b) => a.d - b.d)[0];
  return { x: best.x, y: best.y };
}

/** Route between two devices: along the walls for wall devices, across the bottom chords for ceiling devices. */
function pathBetween(W: number, D: number, a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
  const aWall = onPerimeter(W, D, a);
  const bWall = onPerimeter(W, D, b);
  if (aWall && bWall) return perimeterPath(W, D, a, b);
  if (aWall && !bWall) {
    const foot = nearestWallFoot(W, D, b);
    return [...perimeterPath(W, D, a, foot), b];
  }
  if (!aWall && bWall) {
    const foot = nearestWallFoot(W, D, a);
    return [a, ...perimeterPath(W, D, foot, b)];
  }
  if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) return [a, b];
  return [a, { x: b.x, y: a.y }, b];
}

function polylineLength(pts: { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

function circuitKindOf(kind: FixtureKind): CircuitKind | null {
  switch (kind) {
    case "light":
    case "floodlight":
      return "lighting";
    case "outlet":
      return "receptacle";
    case "fan":
      return "fan";
    case "waterer":
      return "waterer";
    case "heater":
      return "dedicated";
    default:
      return null;
  }
}

/** Capacity rules per circuit kind: breaker, and the design-load ceiling per circuit. */
const CIRCUIT_RULES: Record<CircuitKind, { breaker: number; gfci: boolean; maxDesignWatts: number; continuous: boolean }> = {
  lighting: { breaker: 15, gfci: false, maxDesignWatts: 15 * 120 * 0.8, continuous: true },
  receptacle: { breaker: 20, gfci: true, maxDesignWatts: 20 * 120 * 0.8, continuous: false },
  fan: { breaker: 20, gfci: false, maxDesignWatts: 20 * 120 * 0.8, continuous: true },
  waterer: { breaker: 20, gfci: true, maxDesignWatts: 20 * 120 * 0.8, continuous: true },
  dedicated: { breaker: 30, gfci: false, maxDesignWatts: Infinity, continuous: true },
};

const LABEL_PREFIX: Record<CircuitKind, string> = { lighting: "L", receptacle: "R", fan: "F", waterer: "W", dedicated: "H" };

/** Nearest-neighbour chain from the panel; keeps runs short and daisy-chains sensibly. */
function chainFrom(start: { x: number; y: number }, items: ElectricalFixture[]): ElectricalFixture[] {
  const left = items.slice();
  const out: ElectricalFixture[] = [];
  let cur = start;
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((f, i) => {
      const d = Math.abs(f.x - cur.x) + Math.abs(f.y - cur.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const [f] = left.splice(bi, 1);
    out.push(f);
    cur = f;
  }
  return out;
}

export function deriveElectrical(model: BuildingModel): ElectricalDerived {
  const fp = model.footprint.kind === "rect" ? model.footprint : { wFt: 24, dFt: 36 };
  const W = fp.wFt;
  const D = fp.dFt;
  const fixtures = model.electrical.fixtures;
  const placedPanel = fixtures.find((f) => f.kind === "panel");
  const panel = placedPanel ? { x: placedPanel.x, y: placedPanel.y, wallId: placedPanel.wallId, placed: true } : { x: 3, y: 0, wallId: "wall_ext_s", placed: false };
  // Wiring belt: conduit along the girts at 7'6"–8', above horse reach and below the bottom chords.
  const routeHeightFt = Math.max(6.5, Math.min(8, model.eaveHeightFt - 1));

  // ---- Group fixtures into circuits.
  const circuits: Circuit[] = [];
  const routes: RouteSegment[] = [];
  const counters: Record<CircuitKind, number> = { lighting: 0, receptacle: 0, fan: 0, waterer: 0, dedicated: 0 };
  const byKind = new Map<CircuitKind, ElectricalFixture[]>();
  for (const f of fixtures) {
    const k = circuitKindOf(f.kind);
    if (!k) continue;
    byKind.set(k, [...(byKind.get(k) ?? []), f]);
  }

  const makeCircuit = (kind: CircuitKind, members: ElectricalFixture[]) => {
    const rules = CIRCUIT_RULES[kind];
    const volts: 120 | 240 = kind === "dedicated" ? members[0].volts : 120;
    const connectedWatts = members.reduce((s, f) => s + (f.kind === "outlet" ? RECEPTACLE_VA : f.watts), 0);
    const designWatts = rules.continuous ? connectedWatts * 1.25 : connectedWatts;
    const breakerAmps = kind === "dedicated" ? breakerFor(designWatts, volts) : rules.breaker;
    const loadAmps = connectedWatts / volts;
    // Route: panel -> chain of devices.
    const ordered = chainFrom({ x: panel.x, y: panel.y }, members);
    const pts: { x: number; y: number }[] = [];
    let prev: { x: number; y: number } = { x: panel.x, y: panel.y };
    let planFt = 0;
    for (const f of ordered) {
      const seg = pathBetween(W, D, prev, f);
      planFt += polylineLength(seg);
      pts.push(...(pts.length ? seg.slice(1) : seg));
      prev = f;
    }
    const drops = ordered.reduce((s, f) => s + Math.abs(routeHeightFt - f.mountFt), 0) + Math.abs(routeHeightFt - (placedPanel?.mountFt ?? 5));
    const runFt = planFt + drops;
    let wireAwg = gaugeFor(breakerAmps);
    let upsized = false;
    let dropPct = (2 * K_COPPER * loadAmps * runFt) / cmOf(wireAwg) / volts * 100;
    while (dropPct > MAX_DROP_PCT && wireAwg > 6) {
      wireAwg = CU[CU.findIndex((c) => c.awg === wireAwg) + 1].awg;
      upsized = true;
      dropPct = (2 * K_COPPER * loadAmps * runFt) / cmOf(wireAwg) / volts * 100;
    }
    const id = `ckt_${kind}_${++counters[kind]}`;
    circuits.push({
      id,
      label: `${LABEL_PREFIX[kind]}${counters[kind]}`,
      kind,
      breakerAmps,
      volts,
      poles: volts === 240 ? 2 : 1,
      gfci: rules.gfci,
      fixtureIds: ordered.map((f) => f.id),
      connectedWatts,
      designWatts,
      loadAmps: +loadAmps.toFixed(2),
      wireAwg,
      runFt: +runFt.toFixed(1),
      wireFt: Math.ceil(runFt * 1.15 + ordered.length + 1),
      voltageDropPct: +dropPct.toFixed(2),
      upsizedForDrop: upsized,
    });
    routes.push({ circuitId: id, points: pts, lengthFt: +planFt.toFixed(1) });
  };

  for (const kind of ["lighting", "receptacle", "fan", "waterer", "dedicated"] as CircuitKind[]) {
    const members = byKind.get(kind) ?? [];
    if (!members.length) continue;
    if (kind === "dedicated") {
      for (const f of members) makeCircuit(kind, [f]);
      continue;
    }
    const rules = CIRCUIT_RULES[kind];
    // Fill circuits along a spatial chain so each one covers a contiguous run.
    const ordered = chainFrom({ x: panel.x, y: panel.y }, members);
    let group: ElectricalFixture[] = [];
    let groupWatts = 0;
    for (const f of ordered) {
      const w = (f.kind === "outlet" ? RECEPTACLE_VA : f.watts) * (rules.continuous ? 1.25 : 1);
      const tooMany = kind === "receptacle" && group.length >= MAX_RECEPTACLES_PER_CIRCUIT;
      if (group.length && (groupWatts + w > rules.maxDesignWatts || tooMany)) {
        makeCircuit(kind, group);
        group = [];
        groupWatts = 0;
      }
      group.push(f);
      groupWatts += w;
    }
    if (group.length) makeCircuit(kind, group);
  }

  // ---- Panel load (NEC 220, non-dwelling, simplified).
  const byCategory: Record<CircuitKind, number> = { lighting: 0, receptacle: 0, fan: 0, waterer: 0, dedicated: 0 };
  for (const c of circuits) byCategory[c.kind] += c.connectedWatts;
  const receptacleCount = fixtures.filter((f) => f.kind === "outlet").length;
  const recVa = receptacleCount * RECEPTACLE_VA;
  const recDemand = recVa <= 10000 ? recVa : 10000 + (recVa - 10000) * 0.5;
  const fans = fixtures.filter((f) => f.kind === "fan").map((f) => f.watts);
  const largestFan = fans.length ? Math.max(...fans) : 0;
  const demandVa = byCategory.lighting * 1.25 + recDemand + byCategory.fan + largestFan * 0.25 + byCategory.waterer * 1.25 + byCategory.dedicated;
  const serviceAmps = model.electrical.service.amps;
  const demandAmps = demandVa / 240;
  const connectedWatts = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const breakerSpaces = circuits.reduce((s, c) => s + c.poles, 0);
  const panelSpaces = breakerSpaces <= 8 ? 12 : breakerSpaces <= 16 ? 20 : breakerSpaces <= 24 ? 30 : 40;
  const feeder = serviceAmps <= 60 ? { cu: "6 AWG", al: "4 AWG", cm: 26240 } : serviceAmps <= 100 ? { cu: "3 AWG", al: "1 AWG", cm: 52620 } : serviceAmps <= 150 ? { cu: "1/0 AWG", al: "3/0 AWG", cm: 105600 } : { cu: "3/0 AWG", al: "4/0 AWG", cm: 167800 };
  const feederDropPct = (2 * K_COPPER * Math.max(demandAmps, serviceAmps * 0.5) * model.electrical.service.feederLengthFt) / feeder.cm / 240 * 100;

  const load: PanelLoad = {
    connectedWatts,
    demandVa: Math.round(demandVa),
    demandAmps: +demandAmps.toFixed(1),
    serviceAmps,
    utilisationPct: Math.round((demandAmps / serviceAmps) * 100),
    byCategory,
    breakerSpaces,
    panelSpaces,
    feederAwg: feeder.cu,
    feederAlAwg: feeder.al,
    feederDropPct: +feederDropPct.toFixed(2),
  };

  // ---- Zone lighting.
  const zoneLighting: ZoneLighting[] = model.zones.map((z) => {
    const r = zoneRect(z);
    const sqFt = r.w * r.d;
    const lights = fixturesInZone(model, z, "light");
    const provided = lights.reduce((s, f) => s + lumensOf(f.watts), 0);
    const needed = lumensNeeded(z.type, sqFt);
    const per = lumensOf(FIXTURE_PRESETS.light.watts);
    return {
      zoneId: z.id,
      name: z.name,
      type: z.type,
      sqFt,
      targetFc: TARGET_FC[z.type],
      neededLumens: Math.round(needed),
      providedLumens: Math.round(provided),
      estimatedFc: sqFt > 0 ? +((provided * 0.5) / sqFt).toFixed(1) : 0,
      lightCount: lights.length,
      moreLights: Math.max(0, Math.ceil((needed - provided) / per - 1e-6)),
    };
  });

  const wireMap = new Map<number, number>();
  for (const c of circuits) wireMap.set(c.wireAwg, (wireMap.get(c.wireAwg) ?? 0) + c.wireFt);
  const wireByAwg = [...wireMap.entries()].map(([awg, ft]) => ({ awg, ft })).sort((a, b) => b.awg - a.awg);
  const conduitFt = model.electrical.wiring === "pvcConduit" ? Math.ceil(routes.reduce((s, r) => s + r.lengthFt, 0) * 1.1) : 0;

  return {
    fixtures,
    panel,
    circuits,
    routes,
    load,
    zoneLighting,
    wireByAwg,
    conduitFt,
    boxes: fixtures.filter((f) => f.kind !== "panel").length,
    routeHeightFt,
  };
}

/** Circuit a fixture landed on, if any. */
export function circuitOf(d: ElectricalDerived, fixtureId: string): Circuit | undefined {
  return d.circuits.find((c) => c.fixtureIds.includes(fixtureId));
}
