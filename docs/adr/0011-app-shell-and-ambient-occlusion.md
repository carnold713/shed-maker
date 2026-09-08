# ADR-0011 — App shell (rail · project panel · stage) and screen-space AO

**Status:** accepted · 2026-09-07 · UX + 3D

## Context
Collin's reference is a dashboard where the 3D model is the hero on a cream stage, a left rail and project panel carry status and progress, and summary cards sit below. The render look is clay-white with soft, "softbox" lighting and visible contact shading (ambient occlusion).

## Decisions
1. **Shell.** `Rail` (icons: home, 3D, plan, split, checks, builder pack) · `ProjectPanel` (name, notes, size/frame/roof, status, design-progress checklist derived from the model, save version) · stage (`StageHeader` title + Share / Download / More floating over the canvas; view chips; the plan, the 3D or both) · `InspectorDock` as an in-flow column on the right (never over the canvas) · `BottomCards` footer (materials at a glance from `lib/bom/quick.ts`, check summary). Below the `2xl` breakpoint the project panel becomes a drawer toggled from the rail.
2. **Ambient occlusion** (`components/scene/PostFX.tsx`): three TSL `pass` → MRT (color + view normals) → `ao` (GTAO) → `denoise`, multiplied into the colour. Runs on the WebGPU renderer (WebGPU or WebGL2 backend); on the plain WebGL renderer the component renders the scene directly. The AO texture is single-channel, so only `.r` is used and alpha is preserved.
3. **Look.** AgX tone mapping, room-environment fill at 0.9, warm key with a wide PCF-soft radius, two broad fills, clay palette defaults (off-white siding, pale roof, pale wood), cream stage background in-scene (the pass needs an opaque scene).
4. **Materials at a glance** is an estimate (stock lengths, no waste); the wording says so.

## Consequences
- Post-processing doubles the per-frame cost on software GL; `frameloop="demand"` keeps idle cost at zero.
- The dock and panel widths (21rem each) plus the rail leave ~880px of stage at 1280px; split view is usable but tight there.
- Next visual steps: SSGI (`three/addons/tsl/display/SSGINode.js`) for bounced light, bloom for glazing, an "orbit-to-front" camera preset.
