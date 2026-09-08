# ADR-0016 — Floor drainage: placed drains, derived under-slab pipe

**Status:** accepted · 2026-09-08 · owner: MEP (plumbing) / Builder

## Context
Wash bays and aisles need drains, the slab has to slope to them, and the pipe under the slab has to fall to somewhere outside. The concrete crew needs this before the pour (slopes, drain bodies at floor line, sleeves) as much as the plumber does.

## Decision
- **Model** (`model.drainage`): `drains` (floor or trench, plan position, trench length and axis), an optional `outlet` (kind daylight · dry well · septic · storm, on an exterior wall at an offset), pipe diameter, pipe fall (⅛" or ¼" per foot) and `siteFallIn` — how much lower the ground is at the outlet point. Commands in `lib/model/drainage.ts`; `autoDrainWashBays` puts a trench across each wash bay and an outlet on the nearest wall.
- **Derived** (`lib/plumbing/drainage.ts`, never stored): each drain's catchment (its zone, else a 24' box) with the slab slope (¼"/ft in wash bays and at trenches, ⅛"/ft elsewhere) and the high point; the pipe network — a trunk from the farthest drain to the outlet leaving square through the wall, laterals teeing into it; run lengths; drain inverts (10" floor drain, 12" trench catch basin) and the outlet invert set by the deepest arrival; cleanouts at the head, every bend and every 100'; and whether a daylight outlet actually clears the ground (crown + 2") given the site fall. Notes for the concrete crew are generated from the same numbers.
- **Rules** (`rules/mep/drainage.ts`, advisory): wash bay without a drain (fix), drains without an outlet (fix), daylight needs more fall (fix: dry well), slope run over 25', drain inside a stall, traps / primers / where wash water may go. Citations `IPC:` (704.1 slope, 708.1 cleanouts, 1002 traps, 412 floor drains) and MWPS.
- **Geometry** (`lib/geometry/drainage.ts`, layer `drainage`): grates and trench channels at floor level, drain bodies, pipe boxes at their falling inverts, the outlet stub through the wall, cleanout covers.
- **UI:** tools and a Drains section in the Building step beside the slab options; drains and the outlet are selectable and draggable on the plan with slope arrows, dash-dot runs and cleanouts shown in that step; item panels give the crew figures. Cost lines in a `plumbing` category; a "Under-slab drains" step in the build sequence; sheet **P1 Floor drainage plan** with the schedule, pipe summary and crew notes.

## Consequences
- Routing is Manhattan under the slab and ignores footings; the notes say to keep 3' clear. Laterals join only the trunk.
- Site fall is a single number the user enters; a real site survey replaces it.
- Roof / gutter drainage and interior plumbing supply are out of scope (MEP persona, M7).
