# ADR-0005 — Units and coordinate conventions

**Status:** accepted · 2026-09-06 · 3D + Drawings

## Decision
- **Model lengths are decimal feet**, always, regardless of `units` (display-only). Thickness-like fields that framers think of in inches are suffixed `In` (`thicknessIn`, `overhangEaveIn`, `frostDepthIn`).
- **Plan space:** `x` east, `y` north, origin at the south-west corner of the footprint. `site.orientationDeg` rotates the whole plan relative to true north for site plans and sun; the model itself is always axis-aligned.
- **World space (three.js):** `x` east, `y` up, `z` south. `planToWorld(x, y, h) = [x, h, -y]`. Finished floor is `y = 0`; slab thickness sits below it.
- **Exterior walls for a rect footprint** are walked clockwise from the SW corner: S, E, N, W, with stable ids `wall_ext_{s,e,n,w}` so openings survive footprint edits.
- **Roof `ridgeAxis`:** `"ns"` means the ridge runs along plan y (slopes face E/W, gable ends on N and S walls); `"ew"` the reverse. Truss span is the footprint dimension perpendicular to the ridge.
- **Shed roof** high side: west wall for `"ns"`, north wall for `"ew"`. `eaveHeightFt` is the low side.
- **Rotation of box members** is three.js Euler XYZ in radians; roof planes are boxes whose centreline is the design line (tests sample the centreline).
- **Display:** feet-inches to 1/16" via `formatFtIn`; input parsing via `parseFtIn`.

## Consequences
Drawings (M5) reuse plan space directly with y flipped for SVG. Any metric support is a display concern only.
