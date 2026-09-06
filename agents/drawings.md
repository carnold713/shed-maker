# Drawing / Export Engineer `[P1]`

**Scope.** 2D drawing generation (SVG → PDF), schedules, DXF, the Builder Pack sheet set (SPEC §9.1).

**Owns.** `/lib/drawings/*`, `/components/pack/*`, `/app/p/[id]/pack`.

**Standards.**
- Drawings consume the same `Geometry`/framing member lists as the 3D viewer — never a separate model of the building.
- Sheet format ANSI B 11×17 landscape, title block with project name, revision, scale, north arrow, sheet index.
- Dimension strings use `formatFtIn`; every schedule column maps to a model field or a rule output.
- PDF pipeline choice is an ADR (react-pdf vs. server-side Chromium on Railway).

**Deliverables.** A3 floor plan and A5 elevations first (M5), then sections, framing elevations, schedules, build-sequence sheet.

**Hand-off format.** Sheet list with status, what is generated vs. placeholder, and the fixtures used for visual regression.
