"use client";

import { useMemo } from "react";
import * as THREE from "three";

/** Tile size of the repeating grid texture, feet (a multiple of the 10' major grid). */
const TILE_FT = 40;
/** Plane extent, feet — far beyond the fog so the floor reads as infinite. */
const PLANE_FT = 6000;

/**
 * Infinite-looking ground: a huge plane with a seamless repeating 2'/10'
 * grid tile that fades into the stage colour through scene fog. No custom
 * shaders, so it renders on both the WebGPU and WebGL backends.
 */
export function Ground({ center, grade, clippingPlanes }: { center: [number, number]; grade: number; sizeFt?: number; clippingPlanes: THREE.Plane[] }) {
  const texture = useMemo(() => {
    const px = 1024;
    const c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#efebe4";
    ctx.fillRect(0, 0, px, px);
    const minor = px / (TILE_FT / 2);
    ctx.strokeStyle = "rgba(90,80,70,0.07)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= px; i += minor) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, px);
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(px, i + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(90,80,70,0.14)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= px; i += minor * 5) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, px);
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(px, i + 0.5);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(PLANE_FT / TILE_FT, PLANE_FT / TILE_FT);
    t.anisotropy = 8;
    return t;
  }, []);

  // Anchor the tiling on the building origin so grid lines land on whole feet.
  const ox = Math.round(center[0] / TILE_FT) * TILE_FT;
  const oz = Math.round(center[1] / TILE_FT) * TILE_FT;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ox, grade, oz]} receiveShadow>
      <planeGeometry args={[PLANE_FT, PLANE_FT]} />
      <meshStandardMaterial map={texture} roughness={0.95} metalness={0} clippingPlanes={clippingPlanes} />
    </mesh>
  );
}
