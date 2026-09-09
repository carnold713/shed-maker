"use client";

import * as THREE from "three";
import type { UvRule } from "./boxUv";

/**
 * Procedural PBR texture sets (albedo, normal, roughness) drawn on canvases
 * once per session. No downloads, no licences, and the scale is exact: a
 * tile is `tileFt` feet, so steel ribs land every 9" and boards every 5½"
 * whatever the box size. "tinted" sets carry a luminance-only albedo that
 * the model's colour multiplies; the others carry their own colour.
 */

export type TextureKind = "framing" | "ptWood" | "boards" | "painted" | "steelRibs" | "boardBatten" | "concrete" | "gravel" | "dirt" | "grass" | "stone" | "rubber";

export interface TextureSet {
  kind: TextureKind;
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  /** Size of one tile, feet. */
  tileFt: number;
  /** Multiply by the model / vertex colour (luminance albedo) rather than carry its own colour. */
  tinted: boolean;
  normalScale: number;
  rule: UvRule;
}

const cache = new Map<TextureKind, TextureSet>();

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Tileable value noise on an n×n lattice. */
function valueNoise(x: number, y: number, n: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const w = (i: number, j: number) => hash(((xi + i) % n + n) % n, ((yi + j) % n + n) % n, seed);
  const a = w(0, 0);
  const b = w(1, 0);
  const c = w(0, 1);
  const d = w(1, 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Tileable fbm in [0,1]; `sx`/`sy` stretch the lattice (grain). */
function fbm(u: number, v: number, octaves: number, base: number, seed: number, sx = 1, sy = 1): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let n = base;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(u * n * sx, v * n * sy, Math.round(n * sx) || 1, seed + o * 7);
    norm += amp;
    amp *= 0.5;
    n *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

interface Maps {
  albedo: Float32Array; // rgb per pixel, 0..1
  height: Float32Array; // 0..1
  rough: Float32Array; // 0..1
  px: number;
}

function blank(px: number): Maps {
  return { albedo: new Float32Array(px * px * 3), height: new Float32Array(px * px), rough: new Float32Array(px * px), px };
}

function toTexture(px: number, fill: (i: number, x: number, y: number, out: [number, number, number]) => void, srgb: boolean): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = px;
  c.height = px;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(px, px);
  const out: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const i = y * px + x;
      fill(i, x, y, out);
      img.data[i * 4] = Math.max(0, Math.min(255, Math.round(out[0] * 255)));
      img.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(out[1] * 255)));
      img.data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(out[2] * 255)));
      img.data[i * 4 + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Normal map from a tileable height field (Sobel), strength in height units per pixel. */
function normalFrom(m: Maps, strength: number): THREE.Texture {
  const { height: h, px } = m;
  const at = (x: number, y: number) => h[(((y % px) + px) % px) * px + (((x % px) + px) % px)];
  return toTexture(
    px,
    (i, x, y, out) => {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * strength;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      out[0] = 0.5 - dx / len / 2;
      out[1] = 0.5 - dy / len / 2;
      out[2] = 0.5 + 1 / len / 2;
    },
    false,
  );
}

function pack(m: Maps, strength: number, opts: { kind: TextureKind; tileFt: number; tinted: boolean; normalScale: number; rule: UvRule }): TextureSet {
  const map = toTexture(m.px, (i, _x, _y, out) => { out[0] = m.albedo[i * 3]; out[1] = m.albedo[i * 3 + 1]; out[2] = m.albedo[i * 3 + 2]; }, true);
  const roughnessMap = toTexture(m.px, (i, _x, _y, out) => { out[0] = 1; out[1] = m.rough[i]; out[2] = 1; }, false); // green channel is roughness
  const normalMap = normalFrom(m, strength);
  return { ...opts, map, normalMap, roughnessMap };
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function set(m: Maps, i: number, rgb: [number, number, number], h: number, r: number) {
  m.albedo[i * 3] = rgb[0];
  m.albedo[i * 3 + 1] = rgb[1];
  m.albedo[i * 3 + 2] = rgb[2];
  m.height[i] = h;
  m.rough[i] = r;
}

// ---------------------------------------------------------------------------
// The sets
// ---------------------------------------------------------------------------

/** Sawn softwood: long grain along v, an early/late-wood streak pattern and the odd knot. */
function wood(px: number, light: [number, number, number], dark: [number, number, number], seed: number, rough: number, tileFt: number, kind: TextureKind, rule: UvRule): TextureSet {
  const m = blank(px);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      // Grain: fine across u, long along v; rings drift slowly.
      const drift = fbm(u, v, 3, 2, seed + 11, 1, 1) * 0.5;
      const rings = Math.sin((u * 26 + drift * 4 + fbm(u, v, 2, 4, seed + 3, 1, 0.25) * 2) * Math.PI);
      const streak = fbm(u, v, 4, 8, seed, 6, 0.5);
      const g = 0.55 + 0.25 * rings + 0.2 * (streak - 0.5) * 2;
      // Knots: a few dark ellipses.
      let knot = 0;
      for (let k = 0; k < 3; k++) {
        const kx = hash(k, 1, seed);
        const ky = hash(k, 2, seed);
        const rx = 0.02 + hash(k, 3, seed) * 0.02;
        const ry = rx * 1.8;
        const ddx = (Math.abs(u - kx + 0.5) % 1) - 0.5;
        const ddy = (Math.abs(v - ky + 0.5) % 1) - 0.5;
        const d = Math.hypot(ddx / rx, ddy / ry);
        if (d < 1) knot = Math.max(knot, 1 - d * 0.6);
      }
      const t = Math.max(0, Math.min(1, g)) * (1 - knot * 0.6);
      const rgb = mix(dark, light, t);
      set(m, y * px + x, rgb, 0.5 + 0.35 * (t - 0.5) - knot * 0.3, rough + 0.1 * (0.5 - t));
    }
  return pack(m, 3.5, { kind, tileFt, tinted: false, normalScale: 0.5, rule });
}

/** Tongue-and-groove boards: a seam every 5½", grain along v. */
function boards(px: number): TextureSet {
  const base = wood(px, [0.86, 0.72, 0.5], [0.55, 0.4, 0.24], 21, 0.75, 2, "boards", "grain");
  // Overprint seams into the maps by rebuilding with a seam mask.
  const m = blank(px);
  const seamEvery = 5.5 / 12 / 2; // fraction of a 2' tile
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const s = (u / seamEvery) % 1;
      const seam = s < 0.03 || s > 0.97 ? 1 : 0;
      const bevel = Math.min(s, 1 - s) < 0.06 ? 0.7 : 0;
      const streak = fbm(u, v, 4, 8, 21, 6, 0.5);
      const rings = Math.sin((u * 30 + fbm(u, v, 2, 4, 24, 1, 0.25) * 2) * Math.PI);
      const t = Math.max(0, Math.min(1, 0.55 + 0.22 * rings + 0.4 * (streak - 0.5)));
      const rgb = mix([0.55, 0.4, 0.24], [0.86, 0.72, 0.5], t * (1 - seam * 0.5));
      set(m, y * px + x, rgb, 0.5 + 0.3 * (t - 0.5) - seam * 0.5 - bevel * 0.15, 0.75 + 0.1 * (0.5 - t));
    }
  base.map.dispose();
  base.normalMap.dispose();
  base.roughnessMap.dispose();
  return pack(m, 4, { kind: "boards", tileFt: 2, tinted: false, normalScale: 0.6, rule: "grain" });
}

/** Painted smooth surface (trim, door leaves): faint grain, luminance only. */
function painted(px: number): TextureSet {
  const m = blank(px);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const g = fbm(u, v, 3, 16, 41, 4, 0.5);
      const l = 0.92 + 0.06 * (g - 0.5);
      set(m, y * px + x, [l, l, l], 0.5 + 0.1 * (g - 0.5), 0.5 + 0.1 * (g - 0.5));
    }
  return pack(m, 1.5, { kind: "painted", tileFt: 2, tinted: true, normalScale: 0.25, rule: "grain" });
}

/**
 * R-panel steel: major ribs 9" on centre (¾" tall, 1¼" wide with 45° sides),
 * two shallow stiffening ribs between, ribs along v. Luminance albedo so the
 * model's colour applies; a hint of streaking so it isn't dead flat.
 */
function steelRibs(px: number, tileFt: number): TextureSet {
  const m = blank(px);
  const ribPeriod = 0.75 / tileFt; // 9" in tile units
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const s = (u / ribPeriod) % 1; // 0..1 across one rib pitch
      const majorHalf = (1.25 / 12 / 0.75) / 2; // rib top half-width in pitch units
      const flankW = (0.75 / 12 / 0.75); // 45° flank width
      const d = Math.min(s, 1 - s); // distance from the rib centre line in pitch units
      let h: number;
      if (d < majorHalf) h = 1;
      else if (d < majorHalf + flankW) h = 1 - (d - majorHalf) / flankW;
      else {
        // Two minor stiffening ribs at 1/3 and 2/3 of the flat.
        const f = (d - majorHalf - flankW) / (0.5 - majorHalf - flankW);
        const m1 = Math.exp(-Math.pow((f - 0.33) / 0.06, 2));
        const m2 = Math.exp(-Math.pow((f - 0.66) / 0.06, 2));
        h = 0.12 * (m1 + m2);
      }
      const streak = fbm(u, v, 3, 6, 61, 1, 8);
      const l = 0.9 + 0.05 * (streak - 0.5) - (d < majorHalf + flankW ? 0.02 : 0);
      set(m, y * px + x, [l, l, l], h * 0.9 + 0.05, 0.42 + 0.08 * (streak - 0.5));
    }
  return pack(m, 6, { kind: "steelRibs", tileFt, tinted: true, normalScale: 1, rule: "ribsVertical" });
}

/** Board-and-batten: 12" boards with a 2½" batten over each joint, vertical. */
function boardBatten(px: number): TextureSet {
  const m = blank(px);
  const period = 1 / 4; // 12" in a 4' tile
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const s = (u / period) % 1;
      const battenHalf = (2.5 / 12) / 2;
      const d = Math.min(s, 1 - s);
      const batten = d < battenHalf ? 1 : 0;
      const grain = fbm(u, v, 4, 10, 71, 8, 0.4);
      const l = 0.82 + 0.1 * (grain - 0.5) + batten * 0.04;
      set(m, y * px + x, [l, l, l], 0.4 + batten * 0.5 + 0.06 * (grain - 0.5), 0.72 + 0.1 * (grain - 0.5));
    }
  return pack(m, 5, { kind: "boardBatten", tileFt: 4, tinted: true, normalScale: 0.8, rule: "ribsVertical" });
}

function speckle(px: number, kind: TextureKind, a: [number, number, number], b: [number, number, number], tileFt: number, rough: number, seed: number, scale: number, bump: number): TextureSet {
  const m = blank(px);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const n = fbm(u, v, 5, scale, seed);
      const fine = fbm(u, v, 2, scale * 8, seed + 5);
      const t = Math.max(0, Math.min(1, 0.3 + n * 0.5 + (fine - 0.5) * 0.4));
      set(m, y * px + x, mix(a, b, t), 0.5 + (n - 0.5) * bump + (fine - 0.5) * bump * 0.6, rough + 0.08 * (t - 0.5));
    }
  return pack(m, 2.5, { kind, tileFt, tinted: false, normalScale: 0.5, rule: "plain" });
}

/** Grass: two-tone noise with a fine blade texture. */
function grass(px: number): TextureSet {
  const m = blank(px);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const patch = fbm(u, v, 4, 3, 91);
      const blades = fbm(u, v, 3, 48, 93, 1, 3);
      const t = Math.max(0, Math.min(1, patch * 0.6 + blades * 0.6 - 0.1));
      const rgb = mix([0.3, 0.42, 0.18], [0.58, 0.66, 0.3], t);
      set(m, y * px + x, rgb, 0.5 + (blades - 0.5) * 0.8, 0.92);
    }
  return pack(m, 1.5, { kind: "grass", tileFt: 6, tinted: false, normalScale: 0.35, rule: "plain" });
}

/** Stacked stone veneer: a few random courses of rounded stones with a recessed mortar joint. */
function stone(px: number): TextureSet {
  const m = blank(px);
  // Courses: ~5 per 4' tile with jittered heights; stones ~8–14" long, staggered.
  const courses = 5;
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const u = x / px;
      const v = y / px;
      const c = Math.floor(v * courses);
      const cv = (v * courses) % 1;
      const offset = hash(c, 0, 5) * 0.4;
      const stoneLen = 0.18 + hash(c, 1, 5) * 0.08;
      const s = (((u + offset) / stoneLen) % 1 + 1) % 1;
      const sIndex = Math.floor((u + offset) / stoneLen);
      const jointH = 0.09; // mortar share of the course height
      const jointW = 0.07; // mortar share of the stone length
      const inJoint = cv < jointH || s < jointW;
      // Rounded face: a dome over the stone.
      const fx = (s - jointW) / (1 - jointW);
      const fy = (cv - jointH) / (1 - jointH);
      const dome = inJoint ? 0 : Math.max(0, 1 - Math.pow(Math.abs(fx - 0.5) * 2, 3) * 0.5 - Math.pow(Math.abs(fy - 0.5) * 2, 3) * 0.5);
      const tone = hash(sIndex, c, 9);
      const grain = fbm(u, v, 3, 20, 97);
      const base: [number, number, number] = tone < 0.33 ? [0.66, 0.6, 0.5] : tone < 0.66 ? [0.55, 0.5, 0.43] : [0.72, 0.67, 0.58];
      const rgb = inJoint ? mix([0.42, 0.4, 0.37], [0.5, 0.48, 0.45], grain) : mix(base, [base[0] * 0.8, base[1] * 0.8, base[2] * 0.8], grain * 0.6);
      set(m, y * px + x, rgb, inJoint ? 0.15 : 0.35 + dome * 0.6 + (grain - 0.5) * 0.08, inJoint ? 0.95 : 0.85 + (grain - 0.5) * 0.1);
    }
  return pack(m, 3, { kind: "stone", tileFt: 4, tinted: false, normalScale: 0.9, rule: "plain" });
}

export function getTextureSet(kind: TextureKind): TextureSet {
  const hit = cache.get(kind);
  if (hit) return hit;
  let t: TextureSet;
  switch (kind) {
    case "framing":
      t = wood(512, [0.9, 0.78, 0.58], [0.62, 0.46, 0.28], 7, 0.82, 2, "framing", "grain");
      break;
    case "ptWood":
      t = wood(512, [0.68, 0.6, 0.42], [0.4, 0.34, 0.2], 13, 0.86, 2, "ptWood", "grain");
      break;
    case "boards":
      t = boards(512);
      break;
    case "painted":
      t = painted(256);
      break;
    case "steelRibs":
      t = steelRibs(512, 3);
      break;
    case "boardBatten":
      t = boardBatten(512);
      break;
    case "concrete":
      t = speckle(512, "concrete", [0.72, 0.71, 0.68], [0.86, 0.85, 0.82], 6, 0.9, 31, 4, 0.25);
      break;
    case "gravel":
      t = speckle(512, "gravel", [0.55, 0.52, 0.47], [0.8, 0.77, 0.7], 3, 0.95, 37, 24, 0.9);
      break;
    case "dirt":
      t = speckle(512, "dirt", [0.45, 0.36, 0.26], [0.68, 0.58, 0.44], 6, 0.95, 43, 5, 0.5);
      break;
    case "grass":
      t = grass(512);
      break;
    case "stone":
      t = stone(1024);
      break;
    case "rubber":
      t = speckle(256, "rubber", [0.22, 0.21, 0.2], [0.34, 0.33, 0.31], 2, 0.9, 53, 30, 0.35);
      break;
  }
  cache.set(kind, t);
  return t;
}

/** Which texture set a geometry material uses in realistic mode, if any. */
export function textureFor(material: string, wainscotKind: "steel" | "stone" | "board"): TextureKind | null {
  switch (material) {
    case "wood":
      return "framing";
    case "ptWood":
      return "ptWood";
    case "floorWood":
      return "boards";
    case "trim":
    case "door":
      return "painted";
    case "siding":
    case "roofing":
      return "steelRibs";
    case "wainscot":
      return wainscotKind === "board" ? "boardBatten" : "steelRibs";
    case "stone":
      return "stone";
    case "concrete":
      return "concrete";
    case "gravel":
      return "gravel";
    case "dirt":
      return "dirt";
    case "grass":
      return "grass";
    case "mats":
      return "rubber";
    default:
      return null;
  }
}

/** UV rule per material: roofing ribs run down the slope; everything else follows its texture set. */
export function uvRuleFor(material: string, set: TextureSet | null): UvRule {
  if (material === "roofing") return "ribsSlope";
  return set?.rule ?? "plain";
}
