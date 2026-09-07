# ADR-0010 — WebGPU-first renderer, soft studio look, on-demand frames

**Status:** accepted · 2026-09-07 · 3D + UX

## Context
The M1 viewer was technically correct but flat: one hemisphere light, one hard shadow, a grey grid, dark default steel. Collin asked for a video-game feel — soft lighting, a pad the building sits on, a polished floating UI (reference: isometric render sets and glass-panel dashboards).

## Decisions
1. **Renderer.** `three/webgpu`'s `WebGPURenderer` when `navigator.gpu` exists, otherwise `WebGLRenderer` (`components/scene/renderer.ts`). The WebGPU renderer falls back to its own WebGL2 backend when the browser advertises WebGPU but cannot create a context. `?renderer=webgl` or `localStorage["barn.renderer"] = "webgl"` forces WebGL; e2e editor specs use that (software rendering makes the WebGPU/WebGL2 backend too slow for interaction-heavy specs), and `renderer.spec.ts` exercises the default path.
2. **No GLSL in the scene.** Everything is standard materials + instancing so both backends work: drei's `Grid` (custom shader) was replaced by a canvas-textured ground plate.
3. **Clipping on both backends.** Materials keep `clippingPlanes` (WebGL); on WebGPU the building is parented under a `ClippingGroup` carrying the same planes (`ClipGroup.tsx`).
4. **Lighting.** Procedural `RoomEnvironment` through the backend's own PMREM generator for fill/reflections (no HDR download), a warm key light with PCF-soft shadows, a cool sky fill, ACES tone mapping. Transparent canvas over a CSS dusk gradient.
5. **Frames on demand.** `frameloop="demand"`; anything that mutates the scene outside React (instance matrices, camera fits, environment, clipping) calls `invalidate()`. Idle CPU/GPU is ~0.
6. **Isometric camera** toggle (I) using an orthographic camera fit to the bounds; presets still fit per view.
7. **UI.** Glass floating panels (`.glass`), chip buttons, rounded cards, orange accent, rounder type stack; new-project default colours are warm off-white siding and slate roof.

## Consequences
- Screenshots re-render synchronously before `toDataURL` (no `preserveDrawingBuffer` on WebGPU).
- The real WebGPU backend is not exercised in CI (headless has no GPU); it shares the API surface with the tested WebGL2 backend of the same renderer.
- Post-processing (AO, bloom) is the next visual step and should be done with TSL nodes so it runs on both backends.
