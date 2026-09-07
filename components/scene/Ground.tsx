"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Soft ground plate: a large rounded slab with a faint 2' grid baked into a
 * canvas texture. Works on both the WebGPU and WebGL backends (no custom
 * shaders), receives shadows, and gives the model something to sit on.
 */
export function Ground({ center, grade, sizeFt = 260, clippingPlanes }: { center: [number, number]; grade: number; sizeFt?: number; clippingPlanes: THREE.Plane[] }) {
  const texture = useMemo(() => {
    const px = 2048;
    const c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    const ctx = c.getContext("2d")!;
    // Warm paper ground with a vignette.
    const g = ctx.createRadialGradient(px / 2, px / 2, px * 0.15, px / 2, px / 2, px * 0.7);
    g.addColorStop(0, "#efe9df");
    g.addColorStop(1, "#d9d2c6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, px, px);
    // Grid: 2' minor, 10' major.
    const ftPerPx = sizeFt / px;
    const minor = 2 / ftPerPx;
    ctx.strokeStyle = "rgba(90,80,70,0.10)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= px; i += minor) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, px);
      ctx.moveTo(0, i);
      ctx.lineTo(px, i);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(90,80,70,0.22)";
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= px; i += minor * 5) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, px);
      ctx.moveTo(0, i);
      ctx.lineTo(px, i);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [sizeFt]);

  // Snap the plate so grid lines land on whole feet relative to the building origin.
  const ox = Math.round(center[0] / 10) * 10;
  const oz = Math.round(center[1] / 10) * 10;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ox, grade, oz]} receiveShadow>
        <planeGeometry args={[sizeFt, sizeFt]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} clippingPlanes={clippingPlanes} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* Thick edge so the plate reads as a slab from low angles. Its top face sits 1" BELOW the
          textured plane: coplanar faces z-fight (stepped bands across the plate on WebGPU). */}
      <mesh position={[ox, grade - 1 - 1 / 12, oz]}>
        <boxGeometry args={[sizeFt, 2, sizeFt]} />
        <meshStandardMaterial color="#cfc7ba" roughness={1} clippingPlanes={clippingPlanes} />
      </mesh>
    </group>
  );
}
