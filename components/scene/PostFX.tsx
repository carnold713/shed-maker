"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Screen-space ambient occlusion (GTAO) + denoise through three's TSL
 * post-processing. Runs on the WebGPU renderer (both its WebGPU and WebGL2
 * backends); on the plain WebGL renderer it is a no-op and R3F renders as
 * usual. This is the contact shading that makes the "soft box / GI" look.
 */
export function PostFX({ enabled = true }: { enabled?: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const isWebGPU = (gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer === true;
  const active = enabled && isWebGPU;
  const ppRef = useRef<{ render: () => void; dispose?: () => void } | null>(null);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    (async () => {
      try {
        const [{ PostProcessing }, tsl, { ao }, { denoise }] = await Promise.all([
          import("three/webgpu"),
          import("three/tsl"),
          import("three/addons/tsl/display/GTAONode.js"),
          import("three/addons/tsl/display/DenoiseNode.js"),
        ]);
        if (disposed) return;
        const { pass, mrt, output, normalView, vec4 } = tsl;
        const renderer = gl as unknown as ConstructorParameters<typeof PostProcessing>[0];
        const pp = new PostProcessing(renderer);
        const scenePass = pass(scene, camera);
        scenePass.setMRT(mrt({ output, normal: normalView }));
        const color = scenePass.getTextureNode("output");
        const normal = scenePass.getTextureNode("normal");
        const depth = scenePass.getTextureNode("depth");
        const aoPass = ao(depth, normal, camera);
        // Feet-scale scene: a ~3' sampling radius reads as soft contact shading.
        (aoPass as unknown as { radius: { value: number } }).radius.value = 3;
        (aoPass as unknown as { distanceExponent: { value: number } }).distanceExponent.value = 1.2;
        (aoPass as unknown as { thickness: { value: number } }).thickness.value = 0.8;
        (aoPass as unknown as { scale: { value: number } }).scale.value = 1.3;
        (aoPass as unknown as { resolutionScale: number }).resolutionScale = 0.75;
        const aoDenoised = denoise(aoPass.getTextureNode(), depth, normal, camera);
        // AO is a single-channel texture: take .r, and leave alpha alone.
        const occlusion = (aoDenoised as unknown as { r: unknown }).r;
        const rgb = (color as unknown as { rgb: { mul: (x: unknown) => unknown } }).rgb.mul(occlusion);
        pp.outputNode = (vec4 as unknown as (a: unknown, b: unknown) => typeof color)(rgb, (color as unknown as { a: unknown }).a);
        ppRef.current = pp as unknown as { render: () => void; dispose?: () => void };
        invalidate();
      } catch (e) {
        console.warn("[viewer] post-processing unavailable, rendering without AO", e);
        ppRef.current = null;
      }
    })();
    return () => {
      disposed = true;
      ppRef.current?.dispose?.();
      ppRef.current = null;
    };
    // Rebuild when the camera object changes (perspective <-> isometric).
  }, [active, gl, scene, camera, invalidate]);

  // Keep the renderer size in sync (post-processing allocates its own targets).
  useEffect(() => {
    invalidate();
  }, [size.width, size.height, invalidate]);

  // Priority 1 takes over rendering from R3F; when no post-processing is ready, render directly.
  useFrame(({ gl: r, scene: s, camera: c }) => {
    if (!active) {
      r.render(s, c);
      return;
    }
    if (ppRef.current) ppRef.current.render();
    else r.render(s, c);
  }, 1);

  return null;
}
