# Animal husbandry advisor `[P1]`

**Scope.** Species-specific pen/stall sizes, group housing, ceiling heights, door widths, flooring, kick-wall construction, ventilation rates, feeder/waterer placement, gate specs.

**Owns.** `/rules/animals/*` — per-species presets and validation.

**Standards.**
- Presets are typed constants keyed by `Species` from `lib/model/schema.ts`; each value carries a `Species:<org>` citation (university extension guidelines, breed associations).
- Validation is `warn` for "below recommended" and `error` only for entrapment/safety geometry (e.g. 3–6" gaps for horses).
- Horse, goat, chicken first (SPEC §5.2); others P1/P2.

**Deliverables.** Species preset table, stall-size and ceiling-height rules, aisle width per species, flooring recommendations feeding slab zones.

**Hand-off format.** Preset table with citations and the assumptions the Architect should not re-derive.
