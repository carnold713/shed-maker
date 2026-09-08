# ADR-0013 — Electrical: placed devices, derived circuits

**Status:** accepted · 2026-09-08 · owner: Electrician (`agents/electrician.md`, research: `docs/research/electrical-planning.md`)

## Context
The owner wants to plan lights and outlets, see the amperage and voltage they need, and see how runs route through the walls — as an add-on that never blocks the rest of the design.

## Decision
- **Model state** (`model.electrical`): a service (`amps`, `feederLengthFt`, `feedFrom`), a wiring method, and a list of fixtures (`kind` light · floodlight · outlet · switch · panel · fan · waterer · heater; plan `x`,`y`; `mountFt`; `watts`; `volts`; optional `wallId`, `label`, `switchId`). Wall devices snap to the nearest exterior wall in the command (`lib/model/electrical.ts`). One panel per barn; `autoPlacePanel` puts it on a utility/tack room wall, else beside the first man door.
- **Everything else is derived** in `lib/electrical/derive.ts` and never stored: circuits (lights on 15 A, outlets on 20 A GFCI at 180 VA each, fans and waterers on their own 20 A circuits, 240 V loads on dedicated 2-pole breakers), grouping along a nearest-neighbour chain from the panel and splitting at 80 % of the breaker; conductor size from the breaker, upsized until voltage drop ≤ 3 % (K = 12.9 Cu); the plan route of every circuit (along the walls for wall devices, across the truss chords for ceiling devices, at a wiring belt of ~8'); wire feet by gauge, conduit feet, box count; the NEC 220 demand load, panel utilisation and spaces, feeder conductor and its drop; and the lighting level of every zone by the lumen method (targets in `lib/electrical/lighting.ts`, 0.5 utilisation factor).
- **Rules** (`rules/mep/electrical.ts`, 11 rules, all advisory: highest severity `warn`): panel placed and not in a stall / wet room, service vs demand with a next-size fix, light levels with a one-click "Light {zone}" fix, guarded fixtures ≥ 8' in stalls, no outlets or switches inside a pen, no unit heaters in stalls, a switch by every walk-in door with a fix, voltage-drop notes, agricultural wiring / GFCI note, equipotential plane note. Citations use 2020 NEC numbers with the 2023 renumbering in parentheses; `RuleSource` gained `NEC:`, `ASABE:` and `MWPS:` forms.
- **Geometry** (`lib/geometry/electrical.ts`, layer `electrical`): fixture bodies (lights glow via an emissive material group) plus thin boxes for every run segment and drop, so the 3D view shows the routing. **Plan** (`components/plan/FixtureLayer.tsx`): standard symbols and dashed circuit runs coloured by circuit kind.
- **Cost**: electrical lines in the estimate come from the derivation (panel, breakers, devices, boxes, wire by gauge, conduit, feeder by service size), priced from placeholder SKUs in `rules/materials/prices.ts` (category `electrical`).
- **Sheet E1** in the blueprint pack: plan with symbols and home runs, panel schedule, load summary, notes.

## Consequences
- The derivation is O(n²) in fixtures per circuit kind (nearest-neighbour ordering) — fine for barns (< 200 devices).
- Circuit assignment is deterministic for a given model; users cannot pin a device to a circuit yet (`model.overrides` is the intended path).
- Not modelled: three-phase, well pumps, door openers, exterior tank de-icers, conduit fill — listed in the research doc §11 as open questions.
