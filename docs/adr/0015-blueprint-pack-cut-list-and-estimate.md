# ADR-0015 — Blueprint pack, cut list, hardware schedule, build sequence, cost estimate

**Status:** accepted · 2026-09-08 · owners: Drawing/Export, Builder, Lead (research: `docs/research/construction-details.md`)

## Context
The owner wants a normal person to download blueprints and confidently assemble the barn: how boards are cut (notches, birdsmouths, 45° brace ends), braces, brackets and stall hardware, the order of work, and a raw-materials cost.

## Decision
- **Pack page** `/p/[id]/pack` renders printable Letter-landscape sheets from the model with the same derivations the editor uses (nothing stored): G0 cover & index · A1 floor plan (grid bubbles, D/W tags, stall doors) · S1 foundation & post plan with the post schedule · S2 wall framing elevations (posts, skirt, girts, carrier, headers, openings, heights) · S3 roof framing plan with the truss order · E1 electrical plan & panel schedule · A2 door, window, interior-door and room schedules · M1 materials & cost · M2 cut list · M3 hardware · M4 build sequence. `@media print` puts one sheet per page; "Print / Save as PDF" uses the browser.
- **Cut list** (`lib/bom/cutlist.ts`): one line per identical piece with end codes (S square, P plumb, B birdsmouth, 45 parallel 45°, N notch), the stock to buy and pieces per stick (pairing on a stick when it wastes less; 45° brace ends nest), continuous runs split so joints land only on posts or trusses with alternate rows staggered (`staggerRun`), no stub shorter than one module, purlins lapped 12" past the truss, lean-to rafters with a computed birdsmouth (seat, heel, depth against the ¼-depth limit, HAP), posts with the carrier notch, trusses as a supplier order line. Reports bought vs cut board feet.
- **Knee braces** are generated (`kneeBrace` members) on every bearing-wall post when the eave is ≥ 10' or the span ≥ 30' (RCO §328 prescriptive path): 2×6 at 45°, legs 36" (48" for ≥ 14' eaves or ≥ 40' spans), long edge = a·√2 + 11".
- **Hardware schedule** (`lib/bom/hardware.ts`) follows the Builder's per-unit table: uplift blocks, lags and rebar per post; carrier bolts per bearing post; nails by the pound from crossings; ties, tie nails and spacer blocks per truss; panel screws as 16 + 5·(rows − 2) per roof panel and 16 + 4·(rows − 2) per wall panel plus stitch screws, closures and butyl; lean-to hangers, ties and ledger lags; per-opening kits; stall channels, lags, mats and smalls; interior-door hardware from the door presets. Every line says where it goes.
- **Build sequence** (`lib/bom/sequence.ts`): 20–26 steps parametrised by the model (hole count and size, diagonal to check, post inset, notch depth, truss spacing, slab, doors, electrical, stalls), each with a check and the sheet to have in hand.
- **Estimate** (`lib/bom/estimate.ts`): quantities × placeholder unit prices from `rules/materials/prices.ts` (every item `source: "placeholder"`), per-project overrides in `model.priceOverrides` edited from the Plans step, a ±15 % band, and the label "raw materials only" wherever a figure appears.

## Consequences
- The pack is derived on the client from the saved model; it has no server dependency beyond loading the project.
- Numbers on the sheets trace to a member, a rule or a research table (SPEC §1.4); values the Builder could not verify online are flagged in the research doc §13.
- Not yet: PDF generation server-side, share links for builders, per-sheet scales, lean-to rafter tails and the notched-carrier geometry in 3D (listed in the handoff).
