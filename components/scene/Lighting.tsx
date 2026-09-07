"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Soft studio lighting: a procedural room environment for reflections and
 * fill (no HDR download), a warm key light with soft shadows, a cool sky
 * fill, and ACES tone mapping. Aims for the "clean render" look rather than
 * a flat lit box.
 */
export const GROUND_SIZE_FT = 160;

export function Lighting({ center, radius }: { center: [number, number, number]; radius: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let cancelled = false;
    let env: THREE.Texture | null = null;
    let dispose: (() => void) | null = null;
    const isWebGPU = (gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer === true;
    (async () => {
      if (isWebGPU) {
        // The WebGPU renderer (and its WebGL2 fallback backend) has its own PMREM generator.
        const { PMREMGenerator } = await import("three/webgpu");
        const pmrem = new PMREMGenerator(gl as never);
        const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
        env = rt.texture;
        dispose = () => {
          rt.dispose();
          pmrem.dispose();
        };
      } else {
        const pmrem = new THREE.PMREMGenerator(gl as THREE.WebGLRenderer);
        const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
        env = rt.texture;
        dispose = () => {
          rt.dispose();
          pmrem.dispose();
        };
      }
      if (cancelled) {
        dispose?.();
        return;
      }
      scene.environment = env;
      scene.environmentIntensity = 0.55;
      invalidate();
    })().catch((e) => console.warn("[viewer] environment lighting unavailable", e));
    return () => {
      cancelled = true;
      scene.environment = null;
      dispose?.();
    };
  }, [gl, scene, invalidate]);

  const [cx, , cz] = center;
  // The shadow frustum must cover everything that receives shadows (the whole ground plate),
  // otherwise the map's edge texels smear across the uncovered area.
  const shadowExtent = GROUND_SIZE_FT / 2 + 12;
  const keyRef = useRef<THREE.DirectionalLight>(null);

  // The WebGL shadow-map code rebuilds the shadow camera's projection when it creates the map;
  // the WebGPU backend does not, so do it explicitly whenever the frustum changes.
  useEffect(() => {
    const light = keyRef.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -shadowExtent;
    cam.right = shadowExtent;
    cam.top = shadowExtent;
    cam.bottom = -shadowExtent;
    cam.near = 1;
    cam.far = 400;
    cam.updateProjectionMatrix();
    light.target.position.set(cx, 0, cz);
    light.target.updateMatrixWorld();
    light.shadow.needsUpdate = true;
    invalidate();
  }, [shadowExtent, cx, cz, invalidate]);
  return (
    <>
      <hemisphereLight args={["#fff4e6", "#b9c4cf", 0.55]} />
      <directionalLight
        ref={keyRef}
        position={[cx - 45, 110, cz + 85]}
        intensity={2.4}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
        shadow-radius={4}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={1}
        shadow-camera-far={400}
      />
      <directionalLight position={[cx - radius, radius * 0.5, cz - radius * 0.6]} intensity={0.5} color="#cfe0ff" />
    </>
  );
}
