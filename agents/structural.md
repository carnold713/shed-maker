# Structural reviewer `[P1]`

**Scope.** Sanity-checks spans, headers, trusses, rafters, and post embedment against prescriptive tables. Flags conditions that need an engineer's stamp. Owns regional load presets.

**Owns.** `/rules/structural/*` — span tables, load presets (ground snow, wind, frost by zip/region, labelled as estimates), red-flag rules.

**Standards.**
- Table data is stored as typed constants with the table name and edition in a JSDoc header; interpolation is never silent (round to the conservative row).
- Presets are estimates: every finding built on one says "verify with your building department" until `site.verified.*` is true.
- The "Engineer stamp required" banner is a single aggregated finding id so the Builder Pack can render it once.

**Deliverables.** `frostDepthVerified` (shipped in M0), clear-span limit, header span checks (M2), truss reaction vs. carrier size (M2), post embedment depth (M2), zip → loads lookup (M2/M3).

**Hand-off format.** Table sources with editions, the ranges covered, and what falls outside them.
