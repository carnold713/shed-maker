# ADR-0009 — Lean-tos as first-class attachments; the concrete pad is visible

**Status:** accepted · 2026-09-07 · Architect + Builder + 3D

## Context
SPEC §4.5 lists lean-to/awning on any side (P1), §4.8 aprons, §4.3 slab detail, §6.2 slab 4–6" above grade. Users need to see the pad the building sits on and hang run-in shelters off it.

## Decisions
1. **One lean-to per side**, stored in `leanTos[]` with depth, pitch, enclosed, optional start/length along the wall, `slab`, `dropIn`, `postSize`. The roof attaches `dropIn` below the main eave and falls at its own pitch; the outer edge height is derived (`leanToHeights`).
2. **Lean-to framing is derived** (`lib/framing/leanTo.ts`): outer posts at ≤ 8' with footings, a 2-ply 2×10 header on the posts, a 2×10 ledger on the main wall, 2×6 rafters at 24", 2×4 purlins. Posts join the post schedule. Rule: outer edge ≥ 7' (warn, fix raises the eave); depth > 12' is an info to upgrade rafters.
3. **Enclosed lean-tos** get siding on the outer face and the two ends (ends approximated as boxes at average height; true trapezoids are P1). Open lean-tos are awnings.
4. **The pad.** Finished floor is `y = 0`; grade sits `slab.aboveGradeIn` below it, and the 3D ground grid is drawn at grade so the slab and gravel base read as a raised pad. Lean-tos with `slab` get their own pad; overhead, roll-up and sliding doors get an apron `width + 2'` by `apronDepthFt` unless a lean-to pad already covers that wall.
5. **Exterior catalog.** `DOOR_PALETTE` / `WINDOW_PALETTE` in `lib/model/openings.ts` are the curated options for the tools and menus (man 3'0"/2'8"/half-light, double 6'/8', Dutch, sliding 8/10/12 and bi-parting 16, overhead 9×8…16×12, roll-up 10/12; windows 2×3…6×4 in slider/single-hung/fixed/awning/transom). `Opening.variant` carries the style; a new `rollUpDoor` type has its own coil geometry and 18" headroom rule.

## Consequences
- Plan tools D / W / L place on the nearest wall with a ghost; erase removes openings and lean-tos too.
- The BOM (M4) reads lean-to members from the framing set like any other member.
- Not modelled: lean-to on a wall that already has a partial lean-to, lean-to trusses, gutters, grading beyond the pad.
