# Handoff — Lead → all agents · M1 Envelope (v2 scope) · 2026-09-07

## What shipped
- **SPEC v2 adopted** (`docs/SPEC.md` Part II). Schema v2: `frame` block per §31, `method` retired, migration 1→2 in code (ADR-0006).
- **Lumber reality** (`rules/materials/lumber.ts`): nominal↔actual table, stock lengths, board feet, treatment classes. Tests in `tests/materials/`.
- **Post-frame engine v1** (`lib/framing/postFrame.ts`): posts on the bay module with corner/jamb/end-wall roles and a post schedule (hole, pad, concrete), PT skirt board, girts at ≤ 24" with an eave girt, 2-ply truss carriers on the bearing walls, headers/jambs at openings, trusses (bottom chord, top chords with tails, king post + 2 webs) at `frame.trusses.spacingIn`, purlins on edge at 24" on both planes. `trussSpec` summarises the order for the truss supplier. `postLinesForWall` is shared with the rules.
- **Stick-frame shell v1** (`lib/framing/stickFrame.ts`): plates, studs on layout, king/jack/header/sill at openings; shares the roof structure.
- **Openings** (`lib/model/openings.ts`, commands): catalog presets for man/double/Dutch/sliding/overhead/stall/interior doors and windows; add/update/move/remove/flip/centre-on-wall/centre-in-bay; 1" snap, clamped to the wall.
- **Geometry v2** (`lib/geometry`): layered boxes with materials; wall skins cut around openings; door leaves/frames/glazing (sliding leaves hang 3" off the wall, 6" wider each side); roofing on top of the purlins; gable/shed infill above the eave.
- **Rules**: corner clearance (error post-frame / warn stick), overlap, small-opening-on-post-line (warn + "centre in bay" fix), overhead door headroom (error + "raise eave" fix), fits-wall. `docs/RULES_INDEX.md` regenerated.
- **3D**: instanced rendering per material, view presets (Exterior / Framing / Dollhouse / Interior), per-layer toggles, horizontal cutaway slider, white-model mode, right-click menus on skins, framing members, roof and viewport, PNG screenshot (ADR-0007).
- **Plan**: post grid and bay lines, opening symbols (swing arcs, sliding leaves with direction arrows, overhead dashed, windows), drag openings along walls (1" snap, Shift = 1'), right-click menus on walls (add door/window at the cursor), openings, posts and empty space. Drags coalesce into one undo step.
- **Inspector**: building (footprint, frame system/bay/posts/foundation/girts/carrier, roof + truss spec, materials), opening (type, size presets, offset, sill/swing, actions), framing member (nominal, actual, length, stock, board feet, treatment, rule + citation).
- **Keyboard**: Del removes the selected opening, ←/→ nudge 1" (Shift 1'), X cutaway, F fit, ` framing toggle, Esc.
- Tests: 61 vitest (+ store tests), 2 Playwright specs.

## Assumptions
- Post inset = girt thickness + half post; corner posts belong to the wall whose start they sit at.
- Header sizing in post-frame is a placeholder (2×6 small, 2×10 ≥ 8', 2×12 > 12'); Structural to replace with a table keyed to bay and load in M2.
- Girt `mount: "bookshelf"` is stored but renders as face-mounted.
- Interior walls, lean-tos, gambrel/hip/monitor are out of scope for M1.

## Untested
- Visual regression of the viewer (QA to baseline once openings/framing settle).
- Clerk sign-in still unverified (no keys in the sandbox); Railway runs in dev-user mode.

## Next: M2 — Framing engine acceptance
- **Builder**: end-wall diagonal bracing, knee braces, gable-overhang ladder framing, bookshelf girt geometry, girt/purlin stagger and lap, blocking, post-frame header table; stick-frame cripples/corners/anchor bolts.
- **Structural**: carrier size vs bay/snow table, post embedment vs frost, truss reaction note, "engineer required" banner.
- **3D**: cap rendering for the cutaway, elevation cameras, x-ray wall.
- **Drawing**: post-hole plan and wall framing elevations can start from `FramingSet`.
- **QA**: golden member-list fixtures for the reference build (30×40, 6×6 posts, 8'–10' bays).
