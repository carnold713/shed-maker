# Handoff — Lead → all agents · App shell, render look, exterior catalog · 2026-09-07

## What shipped since the interior handoff
- Exterior catalog: door/window tools with pickers, roll-up door, half-light man door, window styles; lean-tos (open/enclosed, pads, framing); visible concrete pad and aprons (ADR-0009).
- Renderer: WebGPU-first with WebGL fallback, on-demand frames, isometric camera, soft lighting, ground plate, clipping on both backends (ADR-0010). Fixed two WebGPU-only faults: stale shadow-camera projection, coplanar plate z-fighting.
- App shell per the reference: rail, project panel with progress, hero title, actions, docked inspector, footer cards; screen-space AO via TSL (ADR-0011).
- Tests: 93 vitest, 5 Playwright specs (editor specs on WebGL; `renderer.spec.ts` on the default renderer).

## Untested
- Real WebGPU backend (headless has none). The WebGL2 backend of the same renderer is exercised.
- Post-processing on Safari / Firefox.

## Next
- **3D**: SSGI + bloom, orbit presets (front/side), selection outline via `OutlineNode`.
- **UX**: drawer animation, keyboard focus order in the dock, mobile view-only.
- **Backend (M4)**: share links behind the Share action; PNG export already wired to Download.
