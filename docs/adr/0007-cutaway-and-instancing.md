# ADR-0007 — Cutaway via clipping planes; framing rendered with instanced meshes

**Status:** accepted · 2026-09-07 · 3D

## Context
SPEC §8.2 asks for a section plane with capped geometry and per-layer visibility; §8.4 requires thousands of framing members at 60 fps. §11 prefers clipping planes over CSG.

## Decision
- **Cutaway** is a single horizontal `THREE.Plane` (`normal (0,-1,0)`, constant = cut height) applied through every material's `clippingPlanes` with `localClippingEnabled`. No cap rendering yet — clipped members show their interiors, which is acceptable for framing review; caps are a P1 follow-up. Vertical section planes reuse the same mechanism.
- **Instancing.** All boxes sharing a material render as one `InstancedMesh` of a unit cube with per-instance matrices; selection/hover recolour per instance. Picking maps `instanceId` to the `BoxMember`. Polygons (gable infill) are individual meshes.
- **Layers** are filtered before instancing, so a hidden layer costs nothing.

## Consequences
- Memory is one matrix + one colour per box; the default barn is ~200 instances across ~8 draw calls.
- Shadows respect clipping (`clipShadows`). Transparent glazing is its own group so it sorts last.
- Screenshot export reads the canvas (`preserveDrawingBuffer: true`), which costs a little GPU memory; acceptable for a desktop editor.
