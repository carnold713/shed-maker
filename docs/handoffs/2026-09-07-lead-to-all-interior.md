# Handoff — Lead → all agents · Interior editing (M3 core) · 2026-09-07

## What shipped
- **Species presets** (`rules/animals/presets.ts`): pen minimum/recommended sizes, group sq ft/head, aisle minimums, door widths, kick-wall and partition heights, ceilings, colours, citations, for horse/pony/goat/sheep/cattle/pig/chicken/alpaca/rabbit/dog/generic.
- **Zone commands** (`lib/model/zones.ts`): add/update/move/resize/remove/duplicate/array/split, grid + bay + neighbour snapping, auto-grow envelope, fit envelope, outside-access Dutch doors that follow their pen (ADR-0008).
- **Layouts** (`lib/model/layouts.ts`): centre-aisle, shed-row, clear.
- **Derived partitions** (`lib/interior/partitions.ts`): kick-wall/grille or full-height walls from zone edges, stall doors facing aisles, post-line flag.
- **Geometry**: zone floors by flooring type, partitions, grilles, sliding stall-door leaves (layer `interior`).
- **Rules**: zones overlap (error), zones inside footprint (error + grow fix), pen minimum size (warn + resize fix, head-count aware), aisle min width (warn), pen access (warn + outside-door fix), partitions off the post grid (info).
- **Plan**: tool palette (Select/Pen/Aisle/Room/Erase, V/P/A/R/E), species and room pickers, hover ghost, click-to-stamp or drag-to-size, move by dragging, 8 resize handles, right-click menus on zones (species, type, resize, outside access, duplicate, array, split, delete) and on empty space (add pen/room/aisle here, fill with layout, fit building), keyboard Del/D/arrows.
- **Inspector**: Interior panel (species, layouts, fit/grow) and Zone panel (name, type, species, size, position, head count, flooring, presets, outside access, actions).
- Tests: 15 interior vitest cases; `tests/e2e/interior.spec.ts`.

## Assumptions
- One door per pen/room, centred on the longest aisle-facing edge; species door width.
- Kick-wall partitions are 1½" (T&G), room partitions 4½" (2×4 studs); heights from the species preset; rooms to min(eave, 10').
- Auto-grow rounds the truss span to 2' and the length to the bay; it never shrinks.

## Untested
- Zones on stick-frame buildings behave the same (the post-line rule is post-frame only).
- Visual regression of the 3D interior.

## Next
- **Builder (M2)**: emit framing for partitions (stud partitions off-grid; T&G in channels between posts on-grid), stall-front hardware into the BOM.
- **Architect**: circulation checks (§5.5) on top of `derivePartitions` doors; the §18.2 reaction table beyond outside access (wash bay → drain + hose bib, hay → big door, tack → man door + insulation).
- **UX**: marquee multi-select and group move; push/resize-neighbour behaviour when zones collide (currently flagged, not prevented); L-shaped zones.
- **3D**: drag zones in 3D; labels.
