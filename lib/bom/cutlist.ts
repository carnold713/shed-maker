/**
 * Cut list (SPEC §7.4; research: docs/research/construction-details.md §10).
 * Turns the framing set into what a person cuts: one line per identical
 * piece — nominal, treatment, count, cut length, end cuts, the stock to buy
 * and how many pieces come out of each stick — plus the notes a framer
 * needs (notches, birdsmouths, laps, stagger). Trusses are never cut on
 * site; they appear as a supplier order line.
 */
import type { BuildingModel } from "@/lib/model/schema";
import type { FramingKind, FramingMember, FramingSet } from "@/lib/framing/types";
import { actualFt, boardFeet, STOCK_LENGTHS_FT, POST_STOCK_LENGTHS_FT, type LumberSize, type Treatment } from "@/rules/materials/lumber";
import { formatFtIn } from "@/lib/units";
import { kneeBraceLegFt } from "@/lib/framing/postFrame";

/** End-cut codes (research §10): S square · P plumb · L level · B birdsmouth · 45 parallel 45° · N notch. */
export type EndCode = "S" | "P" | "L" | "B" | "45" | "N";

export interface CutLine {
  key: string;
  kind: FramingKind;
  label: string;
  nominal: LumberSize;
  treatment: Treatment;
  count: number;
  cutLengthFt: number;
  cutLength: string;
  ends: string;
  stockFt: number;
  piecesPerStick: number;
  sticks: number;
  boardFeet: number;
  note: string;
  ruleRef: string;
}

export interface StockLine {
  nominal: LumberSize;
  treatment: Treatment;
  stockFt: number;
  count: number;
  boardFeet: number;
}

export interface CutList {
  lines: CutLine[];
  stock: StockLine[];
  /** Board feet bought vs. board feet cut: the real waste of this list. */
  boughtBf: number;
  cutBf: number;
  wastePct: number;
  /** Supplier items that are not cut on site. */
  orders: { label: string; count: number; note: string }[];
  /** Per-member-kind install notes shown once above the table. */
  notes: { kind: string; note: string }[];
}

const KERF_FT = 0.125 / 12;
/** Shared 45° cut saves the end-cut length (7¾" across a 2×6 face) per joint when nesting braces. */
const BRACE_SHARED_CUT_FT = 7.75 / 12;
const MAX_STOCK = 20;

const KIND_LABEL: Record<FramingKind, string> = {
  post: "Post",
  footing: "Footing pad",
  skirt: "Skirt board",
  girt: "Girt",
  carrier: "Truss carrier",
  header: "Header",
  jamb: "Jamb",
  trussTopChord: "Rafter",
  trussBottomChord: "Truss bottom chord",
  trussWeb: "Truss web",
  purlin: "Purlin",
  plate: "Plate",
  stud: "Stud",
  kneeBrace: "Knee brace",
};

/** Birdsmouth and plumb-cut figures for a 2×6 rafter at a pitch (research §3). Inches. */
export function rafterCuts(pitch: number, bearingWidthIn: number) {
  const theta = Math.atan2(pitch, 12);
  const seat = bearingWidthIn;
  const heel = seat * Math.tan(theta);
  const depthPerp = seat * Math.sin(theta);
  const plumbFace = 5.5 / Math.cos(theta);
  const hap = plumbFace - heel;
  const maxDepth = 5.5 / 4; // IRC R802.7.1.1: notch ≤ ¼ depth
  return { thetaDeg: (theta * 180) / Math.PI, seatIn: seat, heelIn: heel, depthPerpIn: depthPerp, plumbFaceIn: plumbFace, hapIn: hap, ok: depthPerp <= maxDepth + 1e-9, maxDepthIn: maxDepth, slopePerFt: 1 / Math.cos(theta) };
}

function ends(m: FramingMember, model: BuildingModel): { ends: string; note: string } {
  const isLeanTo = m.entityId.startsWith("lt_");
  switch (m.kind) {
    case "post": {
      const bearing = model.roof.ridgeAxis === "ns" ? m.entityId === "wall_ext_e" || m.entityId === "wall_ext_w" : m.entityId === "wall_ext_n" || m.entityId === "wall_ext_s";
      if (isLeanTo) return { ends: "S / S", note: "Square both ends; the lean-to header sits on the post top." };
      const notch = model.frame.system !== "stickFrame" ? ` Bearing-wall posts (S / S + N) then get a 1½" × ${(actualFt(model.frame.carrier.size).d * 12).toFixed(2).replace(/\.?0+$/, "")}" notch on the inside face for carrier ply 1 — shoulder flat and level ±⅛".` : "";
      return { ends: bearing && model.frame.system !== "stickFrame" ? "S / S + N" : "S / S", note: `Never cut the treated bottom. Cut the top at the eave line after the posts are set and braced.${notch}` };
    }
    case "carrier":
      return isLeanTo ? { ends: "S / S", note: "Ledger: (2) ½\" × 8\" lags at every post, ¼\" × 4½\" screws at 16\" between; Z-flash the top." } : { ends: "S / S", note: "Ply 1 in the notch crown up, ply 2 lapped; splices only over a post and never both plies at one post; (2) ½\" × 8\" carriage bolts per post." };
    case "girt":
      return { ends: "S / S", note: "Butt at post centres; two bays per stick where possible; adjacent rows never joint on the same post; (2) 16d ring-shank per crossing." };
    case "skirt":
      return { ends: "S / S", note: "Pressure-treated; bottom on the laser line, level ±¼\"; (3) 16d ring-shank per post; splices at posts." };
    case "purlin":
      return isLeanTo ? { ends: "S / S", note: "On edge across the rafters at 24\" along the slope." } : { ends: "S / S", note: "On edge; lap 12\" past the truss and alternate the lap side each row so panel screws still find wood; (2) 16d toe-nails per crossing." };
    case "header":
      return isLeanTo ? { ends: "S / S", note: "2-ply on the outer posts, crown up; toe-nail and tie each rafter." } : { ends: "S / S", note: "Between the jamb posts; ≥ 10' doors get a 2-ply 2×12 on hangers or bearing blocks." };
    case "jamb":
      return { ends: "S / S", note: "2×6 on edge, nailed to the girts; rough opening +0/−⅛\"." };
    case "trussTopChord":
      if (m.id.startsWith("ltrafter_")) {
        const lt = model.leanTos.find((l) => l.id === m.entityId);
        const c = rafterCuts(lt?.pitch ?? 3, 3);
        const l = rafterCuts(lt?.pitch ?? 3, 1.5);
        return { ends: "P / B", note: `Plumb cut at the ledger (hanger) — or birdsmouth ${l.seatIn}" seat / ${fmtIn(l.heelIn)} heel if it bears on top; birdsmouth on the header: ${c.seatIn}" seat, ${fmtIn(c.heelIn)} heel, ${fmtIn(c.depthPerpIn)} deep (limit ${fmtIn(c.maxDepthIn)}); plumb line across the face ${fmtIn(c.plumbFaceIn)}; (3) 16d toe-nails + 1 H2.5A per rafter.` };
      }
      return { ends: "—", note: "Part of a truss — supplier." };
    case "trussBottomChord":
    case "trussWeb":
      return { ends: "—", note: "Part of a truss — supplier." };
    case "kneeBrace": {
      const a = kneeBraceLegFt(model);
      return { ends: "45 / 45", note: `Both ends 45°, parallel (a parallelogram): long edge ${formatFtIn(a * Math.SQRT2 + 11 / 12)}, short edge ${formatFtIn(a * Math.SQRT2)}; end-cut line across the face 7¾". Nest cuts: two per 12' stick.` };
    }
    case "plate":
      return { ends: "S / S", note: "Bottom plate PT; lap the top and cap plates at corners; splices over a stud." };
    case "stud":
      return { ends: "S / S", note: "Pre-cut studs; crown out." };
    default:
      return { ends: "S / S", note: "" };
  }
}

function fmtIn(inches: number): string {
  const whole = Math.floor(inches);
  const frac = Math.round((inches - whole) * 16);
  if (frac === 16) return `${whole + 1}"`;
  if (frac === 0) return `${whole}"`;
  const g = gcd(frac, 16);
  return `${whole ? `${whole} ` : ""}${frac / g}/${16 / g}"`;
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Split a continuous run into pieces that joint only on supports (research §10): k×module pieces, alternate rows start with one module. */
export function staggerRun(lengthFt: number, moduleFt: number, rowIndex: number, lapFt = 0): number[] {
  if (lengthFt <= MAX_STOCK + 1e-9 && lapFt === 0 && lengthFt <= 2 * moduleFt + 1e-9) return [lengthFt];
  // Pick the piece (k modules + lap) with the least waste from the stock list.
  let best = { k: 1, waste: Infinity };
  for (let k = 1; k * moduleFt + lapFt <= MAX_STOCK + 1e-9; k++) {
    const piece = k * moduleFt + lapFt;
    const stock = STOCK_LENGTHS_FT.find((s) => s >= piece - 1e-9);
    if (!stock) break;
    const waste = (stock - piece) / piece;
    if (waste < best.waste - 1e-9 || (Math.abs(waste - best.waste) < 1e-9 && k > best.k)) best = { k, waste };
  }
  const pieceModules = best.k;
  const pieces: number[] = [];
  let remaining = lengthFt;
  // Odd rows start with a short (one-module) piece so joints stagger.
  if (rowIndex % 2 === 1 && pieceModules > 1 && remaining > moduleFt + 1e-9) {
    pieces.push(moduleFt + lapFt);
    remaining -= moduleFt;
  }
  while (remaining > 1e-9) {
    const modules = Math.min(pieceModules, Math.ceil(remaining / moduleFt - 1e-9));
    let take = Math.min(remaining, modules * moduleFt);
    const left = remaining - take;
    // Never leave a stub shorter than one module: stretch this piece to the end if a stick can hold it, else shorten it.
    if (left > 1e-9 && left < moduleFt - 1e-9) take = remaining + lapFt <= MAX_STOCK + 1e-9 ? remaining : Math.max(moduleFt, (modules - 1) * moduleFt);
    pieces.push(take + (remaining - take > 1e-9 ? lapFt : 0));
    remaining -= take;
  }
  return pieces;
}

function rowIndexOf(m: FramingMember): number {
  const match = /_(\d+)_\d+$/.exec(m.id) ?? /_(\d+)$/.exec(m.id);
  return match ? Number(match[1]) : 0;
}

/** Best stock length and pieces per stick for a cut length (pairs pieces on one stick when it wastes less). */
export function pickStock(cutFt: number, kind: FramingKind, sharedCutFt = 0): { stockFt: number; piecesPerStick: number } {
  const stocks = kind === "post" ? POST_STOCK_LENGTHS_FT : STOCK_LENGTHS_FT;
  let best: { stockFt: number; piecesPerStick: number; wastePerPiece: number } | null = null;
  for (const stock of stocks) {
    let n = 0;
    while ((n + 1) * cutFt + n * (KERF_FT - sharedCutFt) <= stock + 1e-9) n++;
    if (n === 0) continue;
    const wastePerPiece = (stock - (n * cutFt - (n - 1) * sharedCutFt)) / n;
    if (!best || wastePerPiece < best.wastePerPiece - 1e-9) best = { stockFt: stock, piecesPerStick: n, wastePerPiece };
  }
  if (!best) {
    // Longer than any stock: splice from the longest.
    const stock = stocks[stocks.length - 1];
    return { stockFt: stock, piecesPerStick: 1 / Math.ceil(cutFt / stock) };
  }
  return { stockFt: best.stockFt, piecesPerStick: best.piecesPerStick };
}

export function cutList(model: BuildingModel, framing: FramingSet): CutList {
  const bay = model.frame.bayFt;
  const trussSpacingFt = model.frame.trusses.spacingIn / 12;
  const groups = new Map<string, CutLine>();
  const notes = new Map<string, string>();
  let cutBf = 0;
  const add = (m: FramingMember, cutLengthFt: number, extraLabel = "") => {
    if (cutLengthFt <= 0.01) return;
    const e = ends(m, model);
    if (e.note && !notes.has(m.kind + (m.entityId.startsWith("lt_") ? "_lt" : ""))) notes.set(m.kind + (m.entityId.startsWith("lt_") ? "_lt" : ""), e.note);
    const len = Math.round(cutLengthFt * 96) / 96; // to ⅛"
    const label = `${m.entityId.startsWith("lt_") ? "Lean-to " : ""}${KIND_LABEL[m.kind]}${extraLabel}`;
    const key = `${label}|${m.nominal}|${m.treatment}|${len.toFixed(4)}|${e.ends}`;
    const cur = groups.get(key);
    if (cur) {
      cur.count += 1;
      return;
    }
    const shared = m.kind === "kneeBrace" ? BRACE_SHARED_CUT_FT : 0;
    const stock = pickStock(len, m.kind, shared);
    groups.set(key, {
      key,
      kind: m.kind,
      label,
      nominal: m.nominal,
      treatment: m.treatment,
      count: 1,
      cutLengthFt: len,
      cutLength: formatFtIn(len, { denom: 8 }),
      ends: e.ends,
      stockFt: stock.stockFt,
      piecesPerStick: stock.piecesPerStick,
      sticks: 0,
      boardFeet: 0,
      note: m.kind === "post" || m.kind === "kneeBrace" ? (m.note ?? "") : "",
      ruleRef: m.ruleRef,
    });
  };

  let trussCount = 0;
  for (const m of framing.members) {
    if (m.kind === "footing") continue;
    if ((m.kind === "trussTopChord" && !m.id.startsWith("ltrafter_")) || m.kind === "trussBottomChord" || m.kind === "trussWeb") {
      if (m.kind === "trussBottomChord") trussCount++;
      continue;
    }
    const isLeanTo = m.entityId.startsWith("lt_");
    if (isLeanTo && (m.kind === "carrier" || m.kind === "header")) {
      for (const piece of staggerRun(m.lengthFt, 8, rowIndexOf(m))) add(m, piece);
      continue;
    }
    if (isLeanTo && m.kind === "purlin") {
      for (const piece of staggerRun(m.lengthFt, 2, rowIndexOf(m), 1)) add(m, piece);
      continue;
    }
    if ((m.kind === "girt" || m.kind === "skirt") && !isLeanTo) {
      for (const piece of staggerRun(m.lengthFt, bay, rowIndexOf(m))) add(m, piece);
      continue;
    }
    if (m.kind === "carrier" && !isLeanTo) {
      for (const piece of staggerRun(m.lengthFt, bay, rowIndexOf(m))) add(m, piece, ` ply`);
      continue;
    }
    if (m.kind === "purlin" && !isLeanTo) {
      for (const piece of staggerRun(m.lengthFt, trussSpacingFt, rowIndexOf(m), 1)) add(m, piece);
      continue;
    }
    if (m.kind === "plate") {
      for (const piece of staggerRun(m.lengthFt, 16 / 12 * 6, rowIndexOf(m))) add(m, piece);
      continue;
    }
    add(m, m.lengthFt);
  }

  const lines = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label) || b.cutLengthFt - a.cutLengthFt);
  const stockMap = new Map<string, StockLine>();
  for (const l of lines) {
    l.sticks = l.piecesPerStick >= 1 ? Math.ceil(l.count / l.piecesPerStick) : Math.ceil(l.count / l.piecesPerStick);
    l.boardFeet = Math.round(boardFeet(l.nominal, l.sticks * l.stockFt) * 10) / 10;
    cutBf += boardFeet(l.nominal, l.count * l.cutLengthFt);
    const k = `${l.nominal}|${l.treatment}|${l.stockFt}`;
    const s = stockMap.get(k);
    if (s) {
      s.count += l.sticks;
      s.boardFeet += l.boardFeet;
    } else stockMap.set(k, { nominal: l.nominal, treatment: l.treatment, stockFt: l.stockFt, count: l.sticks, boardFeet: l.boardFeet });
  }
  const stock = [...stockMap.values()].sort((a, b) => a.nominal.localeCompare(b.nominal) || a.stockFt - b.stockFt);
  const boughtBf = stock.reduce((s, x) => s + x.boardFeet, 0);
  const orders: CutList["orders"] = [];
  if (framing.trussSpec) orders.push({ label: `${framing.trussSpec.type} trusses, ${formatFtIn(framing.trussSpec.spanFt)} span, ${framing.trussSpec.pitch}:12, ${framing.trussSpec.heelIn}" heel, ${framing.trussSpec.overhangIn}" overhang`, count: framing.trussSpec.count, note: "Never field-cut. Give the truss plant the span, pitch, heel, spacing, snow load and the knee-brace reaction." });
  void trussCount;
  return {
    lines,
    stock,
    boughtBf: Math.round(boughtBf),
    cutBf: Math.round(cutBf),
    wastePct: boughtBf > 0 ? Math.round(((boughtBf - cutBf) / boughtBf) * 100) : 0,
    orders,
    notes: [...notes.entries()].map(([kind, note]) => ({ kind: KIND_LABEL[kind.replace("_lt", "") as FramingKind] ? `${kind.endsWith("_lt") ? "Lean-to " : ""}${KIND_LABEL[kind.replace("_lt", "") as FramingKind]}` : kind, note })),
  };
}
