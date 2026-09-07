import * as THREE from "three";
import type { CanvasProps } from "@react-three/fiber";

/**
 * Renderer factory: WebGPU when the browser has it (three/webgpu), otherwise
 * the WebGL renderer. Both are driven through the same three.js scene API;
 * the scene uses standard materials and no GLSL, so either backend works.
 */
type GlFactory = Exclude<CanvasProps["gl"], undefined | object> extends (props: infer P) => unknown ? (props: P) => Promise<THREE.WebGLRenderer> : never;

export const createRenderer: GlFactory = async (props) => {
  const canvas = (props as { canvas: HTMLCanvasElement }).canvas;
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { gpu?: unknown }) : undefined;
  // Runtime override for tests / troubleshooting: ?renderer=webgl or localStorage "barn.renderer" = "webgl".
  let forceWebGL = process.env.NEXT_PUBLIC_DISABLE_WEBGPU === "1";
  try {
    const q = new URLSearchParams(window.location.search).get("renderer");
    const ls = window.localStorage.getItem("barn.renderer");
    if (q === "webgl" || ls === "webgl") forceWebGL = true;
  } catch {
    /* no storage */
  }
  if (nav?.gpu && !forceWebGL) {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const r = new WebGPURenderer({ canvas, antialias: true, alpha: true });
      await r.init();
      (window as unknown as { __barnRenderer?: string }).__barnRenderer = "webgpu";
      return r as unknown as THREE.WebGLRenderer;
    } catch (e) {
      console.warn("[viewer] WebGPU init failed, falling back to WebGL", e);
    }
  }
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  (window as unknown as { __barnRenderer?: string }).__barnRenderer = "webgl";
  return r;
};
