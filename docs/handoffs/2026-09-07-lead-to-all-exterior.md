# Handoff — Lead → all agents · Exterior catalog, lean-tos, concrete pad · 2026-09-07

## What shipped
- **Door / Window tools** in the plan palette (D / W) with curated pickers; click a wall to place with a ghost preview. Same options in the wall's right-click menu. New `rollUpDoor` type (coil box, 18" headroom rule, apron). Man door `halfLight` variant with glazing; window styles.
- **Lean-to tool** (L) and "Add lean-to" on the wall menu / Concrete & lean-tos panel: per side, 8–16' deep, 1–4:12, open or enclosed, pad on/off, partial span. Inspector shows attachment and outer-edge heights. Framing: posts, header, ledger, rafters, purlins; geometry: roof plane, skins, pad. Rules: clearance (warn + raise-eave fix), rafter span info.
- **Concrete**: slab + gravel base rendered above grade (grid at grade), aprons outside vehicle doors (toggle, depth), lean-to pads; plan shows aprons and pads.
- Tests: 7 new vitest cases (`tests/interior/leanTos.test.ts`), `tests/e2e/exterior.spec.ts`.

## Assumptions
- Lean-to rafters 2×6 at 24", header 2-ply 2×10, ledger 2×10 lagged to the posts; posts same foundation as the main posts.
- Apron width = door + 1' each side; 8' deep default.
- Enclosed lean-to end walls are boxes at the average height.

## Next
- **Builder**: lean-to knee braces, gutter/downspout note, apron thickened edge in the foundation detail; lean-to members in the BOM with stagger.
- **Drawing**: aprons and lean-to pads on the foundation plan; lean-to on elevations.
- **UX**: drag the lean-to's outer edge in plan to set depth; window/door drag from the palette onto a wall.
