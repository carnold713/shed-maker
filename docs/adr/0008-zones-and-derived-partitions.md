# ADR-0008 — Zones as grid rectangles; partitions derived; interior grows the envelope

**Status:** accepted · 2026-09-07 · Architect + UX + 3D

## Context
SPEC §5 stores zones as polygons; §18 makes the interior drive the exterior; §21 asks for tile-style editing ("RollerCoaster Tycoon" feel: stamp, drag, resize, duplicate, array). Interior walls in §10.2 are listed under `walls`.

## Decisions
1. **Zones are axis-aligned rectangles on a 1' grid**, stored as 4-point polygons (schema unchanged, polygon stays available for L-shapes later). Commands snap to the grid, to bay lines, and to neighbouring zone edges within 0.6'.
2. **Interior partitions are derived from zone edges**, never stored. Every zone edge off the exterior wall line is a partition; shared edges deduplicate; a pen or room gets one door on its longest edge shared with an aisle. Pen partitions use the species kick-wall and grille heights; room partitions run full height. Consequence: moving a pen moves its walls; there is no separate wall-editing mode for the interior (SPEC §5.3 `walls[]` interior entries remain reserved for user-placed walls that are not zone edges).
3. **Auto-grow.** Adding, moving, or resizing a zone past the exterior wall grows the footprint: the truss-span dimension on the 2' module, the bay dimension on `frame.bayFt`. The building never shrinks automatically; "Fit building to interior" shrink-wraps on demand. A rule flags zones outside the walls with a "Grow building to fit" fix when auto-grow is off.
4. **Outside access is a linked opening.** A pen with `outsideAccess` on an exterior wall owns a Dutch door (`Opening.zoneId`) that is created, re-centred, and removed by the zone commands. At a corner the south/east/north/west order decides the wall.
5. **Layout generators** (§23) are commands: centre-aisle (one stall per bay each side, optional tack/feed bays) and shed-row (outside doors). They reset the interior and resize the cross-section, keeping the length on the bays.

## Consequences
- Species presets live in `rules/animals/presets.ts` with citations; every number the pen tools use comes from there.
- Framing does not yet see the partitions (no stud members for stick-framed partitions, no posts for T&G channels); M2 adds them from `derivePartitions`.
- The plan is now the primary interior editor; the 3D view shows floors, kick-walls, grilles and stall doors and lets you right-click them, but does not drag them.
