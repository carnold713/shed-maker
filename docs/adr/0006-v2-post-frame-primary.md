# ADR-0006 — Adopt SPEC v2: post-frame is the primary engine, schema v2

**Status:** accepted · 2026-09-07 · Lead + Builder + 3D

## Context
SPEC v2 (Part II, §16–33) makes post-frame the primary construction engine, requires actual lumber dimensions in geometry, and adds the `frame` block (§31). Part II wins over Part I where they conflict.

## Decisions
1. **Schema v2.** `method` is replaced by `frame.system` and the full `frame` parameter block (bay, post, girts, skirt, carrier, trusses, purlins, studs, species). `roof.trussSpacingIn` moves to `frame.trusses.spacingIn`. Migration 1→2 is code in `lib/model/migrations.ts` and runs on read; the Prisma schema is unchanged.
2. **Framing is derived, member-level, and dimensionally real.** `lib/framing` produces `FramingMember`s (nominal, actual box, cut length, treatment, `ruleRef`) from `rules/materials/lumber.ts`. Geometry consumes the framing set; nothing renders a "2×6" as 2"×6".
3. **Plan wall line = outside face of the girts** (the siding plane). Posts sit inside the line by one girt thickness; siding sits outside it. Footprint dimensions are therefore "outside of girts", which is what the steel supplier and the concrete crew measure. Clear interior dimensions (inside face of posts) are computed, not stored (SPEC §19.3). Amends ADR-0005.
4. **Bearing walls follow the ridge.** With `ridgeAxis: "ns"` the east/west walls carry the truss carriers; posts on bearing walls sit on `frame.bayFt`, end-wall posts at ≤ 8'. A remainder bay shorter than 2' merges into the previous bay.
5. **Openings displace posts.** Any opening ≥ 8' gets jamb posts; a smaller opening that lands on a post line drops that post and gets jamb posts, and a `warn` rule offers "centre in bay". Girts and skirt boards are interrupted at openings; headers span between jambs.
6. **Roof datum.** The roofing underside at the wall line is `eave + heel + purlin depth / cos θ`; ridge height includes the panel. The shed roof's high side is the west wall (ridge N–S) or the north wall (ridge E–W); `eaveHeightFt` is the low side (clarifies ADR-0005).
7. **Layers.** Every geometry member declares a layer (`slab, foundation, framing, roofStructure, roofing, siding, openings`); view presets are layer sets plus an optional cut height.

## Consequences
- M1 acceptance is visual as well as tested: the framing preset must read as the reference render (SPEC §16.1). Not yet modelled: end-wall diagonal bracing, knee braces, gable-overhang ladders, bookshelf girt geometry (the `mount` flag exists but renders as face-mounted), truss webs beyond a king post and two diagonals.
- Stick-frame is a secondary shell: plates, studs, kings/jacks/headers/sill in M1; cripples, blocking, corners, anchor bolts in M2.
- The BOM (M4) reads member lengths and stock lengths straight from the framing set; stagger/lap of continuous girts and purlins is an M4 rule, not a geometry concern.
