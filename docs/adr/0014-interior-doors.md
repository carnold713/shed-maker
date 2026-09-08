# ADR-0014 — Interior doors on stall fronts and room walls

**Status:** accepted · 2026-09-08 · owner: Architect / UX

## Context
Partitions are derived from zone edges (ADR-0008) and each pen got one implicit sliding door facing the aisle. The owner asked to add doors to stalls and rooms explicitly — sliding and hinged stall doors, Dutch doors, basic wood-frame room doors — and to move and change them.

## Decision
- `Zone.doors: InteriorDoor[]` — each door belongs to the zone it serves and sits in one of that zone's four edges (`side`, `offsetFt` from the west/south end, `widthFt`, `heightFt`, `type` stallSlide · stallHinged · dutch · woodHinged · manDoor · cased, `swing`, `hinge`). `Zone.autoDoor` (default true) keeps the derived default door — sliding on pens, wood door on rooms, open doorway on hay and equipment bays — until the user adds, edits or removes a door, after which the explicit list is canonical.
- `derivePartitions` lands every door in the partition that contains its centre (`PartitionDoor` now carries id, type, height, swing, hinge, plan segment and which side the zone is on). Doors on an edge that is an exterior wall are ignored — outside doors are exterior openings (`outsideAccess`).
- Commands in `lib/model/interiorDoors.ts` snap to 6", refuse overlaps, clamp on zone resize (`clampDoorsToRect`), and re-size on a type change. Presets carry the hardware list per door (track, hangers, latch, hinges, lockset) and the price SKU.
- Geometry draws each type: sliders as a leaf hung on the aisle side with a track twice the width; hinged and Dutch leaves in the partition plane (solid to kick height, grille above, a gap at the Dutch split); wood and steel doors with jambs and a head casing; cased openings as a header only.
- Plan: architectural symbols (offset leaf with a slide arrow; leaf plus quarter arc for hinged), clickable and draggable along the wall; the Door tool in the Layout step ghosts the nearest partition. Clicking a default door makes it a real record and selects it.
- Rules: `design.interiorDoor.width` (species minimum, with a fix) and `design.interiorDoor.exists` (a stall or room with no door).
- Estimate and hardware schedule count doors by type with their hardware; the blueprint pack lists them on A2.

## Consequences
- Old models parse unchanged (`doors` defaults to `[]`, `autoDoor` to true), so every existing pen keeps its default door.
- Doors are stored per zone, so moving a zone moves its doors; a door whose partition disappears (the neighbour was deleted) is kept in the model but not drawn, and the "no door" rule points it out.

## Addendum 2026-09-08 — doors on outside-wall sides and aisle ends

A zone side that lies on the building's exterior wall cannot carry an interior door (there is no partition there), so `addZoneDoor(model, { zoneId, side })` in `lib/model/interiorDoors.ts` routes such a side to `addOpening` with a door sized for the space: sliding doors sized to the aisle (8/10/12/16', 16' bi-parting; height under the eave) for aisles, open floor, equipment and hay; a Dutch door for pens; a 3' entry door for rooms (`defaultExteriorDoorSpec`, MWPS aisle guidance in `docs/research/construction-details.md`). `addEndDoors` applies it to the aisle ends that reach a wall (`endsOnOutsideWalls`); an aisle that stops short of a wall gets no door there, and the label says which end will get one. The Layout Door tool is one tool for both kinds: nearest partition within 2' → interior door of the picked (or the zone's default) type; nearest outside wall within 3' → the picked outside door or the default for the space behind the wall. Exterior openings added this way are ordinary openings (not pen-linked like `outsideAccess`), so they stay put when the zone moves.

