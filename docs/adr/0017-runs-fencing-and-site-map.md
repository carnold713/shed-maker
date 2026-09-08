# ADR-0017 — Outdoor runs, fencing takeoff, and the barn on a satellite map

**Date:** 2026-09-08 · **Status:** accepted · **Owner:** Site & fencing agent (`agents/site.md`) with the Lead

## Context

The owner keeps animals that live half outside. SPEC §6.4 and §26 call for attached runs off each pen, fence type per species, a gate schedule, and the building placed on a site plan. He asked for two things in one breath: "runs for the animals outside into grass so we can start to section off land", and a view that "takes this barn layout and the run size and shows it with Google Maps underneath so I can get a perspective of what it would look like to scale on my property".

## Decision

### Model
- `model.runs[]` — `Run { id, name, species?, zoneId?, headCount, rect, fence { kind, heightFt, topRail }, gates[] }`. The rect is in plan feet and may sit anywhere outside the footprint (usually hung on a wall). A run hung on a pen (`zoneId`) is sized from the pen's edge and its animals. Gates carry a side and an offset along that side, like interior doors.
- `site.lat`, `site.lng`, `site.orientationDeg` (already in the schema) now mean something: the footprint centre sits on lat/lng and the plan's +y is turned `orientationDeg` clockwise from true north.
- Commands in `lib/model/runs.ts`: `addRun` (on a pen, on a wall side at a wall coordinate, or an explicit rect), `updateRun`, `moveRun`, `resizeRun`, `removeRun`, `fitRunToHead`, `addRunGate` / `updateRunGate` / `removeRunGate`, `autoRuns` (one per pen on an outside wall). Runs are pushed out of the footprint on every edit (`clampRunOutside`).
- `RUN_GUIDANCE` per species (dry-lot square feet per head min/recommended, usual fence and height, fence kinds to avoid) and `FENCE_PRESETS` (post spacing, how it is bought, whether corners need braces) come from `docs/research/runs-and-fencing.md`; figures from memory are flagged there.

### Derived
- `lib/site/fencing.ts` — fence length per run is its edges that are not the barn wall, with a line shared by two runs counted once (the later run reports it as `sharedFt`); posts at the preset spacing plus corners (deduplicated by point) and two per gate; rolls / boards / panels / strand feet by kind; H-braces where wire pulls; gates rounded up to stock tube gates.
- `lib/geometry/site.ts` — grass patch, posts, rails or a translucent mesh panel, gate frames; all on the new `site` layer, visible in every preset.
- `rules/site/runs.ts` — area per head, fence height, fence kind, run without a door from its stall, run over the building (error), runs overlapping, no gate / no drive gate. Each has a fix.
- Estimate category `fencing`; build-sequence step "Runs and fencing"; the pack's site plan sheet.

### Editor
- A **Site** step between Outside and Electrical: Run tool (click beside an outside wall; off a stall it takes the stall's animals), "Runs for all stalls on the outside walls", run list, then "On your land": address search, coordinates, orientation. The plan fits the barn *and* its runs (`siteExtent`), runs draw as green tiles with fence ticks and gate swings, and have their own inspector and context menu.
- The stage's plan slot shows the **site map** on this step: Leaflet with satellite tiles, the barn (roof colour, ridge line, doors), lean-tos and runs drawn to scale as an SVG overlay re-projected on every map move. Drag the barn to move it; drag the round handle on its north side to turn it (Shift snaps to 15°). Click the map to place the barn the first time. Scale bar in feet.

### Basemap and geocoding
Tiles come through `/api/tiles/{z}/{x}/{y}` and address lookups through `/api/geo/search`, so the browser never sees a provider key:
- With `GOOGLE_MAPS_API_KEY` set (Railway variable), tiles are Google Map Tiles API satellite via a server-side session token, and geocoding is Google Geocoding. Attribution "Imagery ©Google" is shown beside the map. The Google Maps JavaScript SDK is *not* used: it would need the key in the page and its own UI.
- Without a key, tiles are Esri World Imagery (free with attribution, native zoom ~19) and geocoding is OpenStreetMap Nominatim (with a proper User-Agent, ≤ 1 request/s). The app works out of the box; the owner adds the key when he wants Google's imagery.
- Tiles are cached for a day at the edge; the session token is cached in the server process.

## Consequences
- Runs are the first model objects outside the footprint; everything that fits a view now uses `siteExtent` (plan) or the projected bounds (map). The pack's site plan includes them; printed sheets do not include the satellite image (tile terms and print reliability), only the plan, north arrow, coordinates and orientation.
- Small-area equirectangular projection in `lib/site/geo.ts` is exact enough for a barn (< 1" at 1,000').
- Fence and run figures are planning guidance, not code; the AHJ and the fence contractor decide. Rules are `warn` at most except a run drawn over the building.
- Open: property boundary and setbacks (schema fields exist, no UI yet), lanes between runs, polygon runs, water and shade in runs, the satellite image on the printed sheet.
