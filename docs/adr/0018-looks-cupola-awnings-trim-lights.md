# ADR-0018 — Looks: cupola and weathervane, awnings, trim styles, wainscot, door lights

**Date:** 2026-09-09 · **Status:** accepted · **Owner:** Lead with the Builder and 3D lanes

## Context

The owner sent a photo of the barn he wants: gable roof in standing seam, a louvered cupola with a weathervane on the ridge, bracketed shed awnings over the doors, board-and-batten over a stone wainscot, craftsman-style window trim and gooseneck lights. The model had colour choices and an unused `vents.cupola` flag and `materials.wainscot` block; nothing of this was drawn, counted or checked.

## Decision

### Model (`lib/model/schema.ts`, commands in `lib/model/looks.ts`)
- `roof.cupola { enabled, sizeIn (18–60), count (1–3), weathervane, style: louvered | windowed }`; `setCupola` also mirrors `vents.cupola`.
- `opening.awning? { kind: shed | gable, depthFt (1.5–6), brackets: timber | steel }`; `setAwning`, `awningsOverDoors` (3' over doors, 4' over doors 10' and wider; never windows).
- `materials.trimStyle: none | flat | wide | craftsman`; `materials.wainscot { enabled, kind: steel | stone | board, heightFt, color }`.
- Two exterior fixture kinds, `gooseneck` (15 W LED, 14" shade, mounts about a foot above the door head) and `lantern` (12 W, 6'6" beside an entry door). `lightsOverDoors` centres a gooseneck over each big door (two over 14'+ doors) and puts a lantern beside each entry door; it skips doors that already have a light. Both count as lights: switched, on lighting circuits, in the panel schedule.
- `applyLook("classic")` does all of it at once (cupola sized by the rule of thumb, craftsman trim, 3' stone wainscot, timber-bracket awnings, door lights, standing-seam roof, 18" eaves); `applyLook("plain")` takes the decoration off and leaves the lights.

### Derived
- `lib/geometry/details.ts`: cupola (saddle base astride the ridge, louvered or glazed body with corner posts, a small gable cap in the roof colour, rod, directionals and arrow), awnings (sloped roof plane at 4:12 with rafters, ledger, fascia, and a leg-and-strut bracket at each end in timber or steel), trim boards proud of the siding per style (craftsman: 1×4 legs, 1×6 head with a drip cap, sill and apron on windows; sliding doors get a header board only), wainscot band cut around the doors with a cap. Cupola on the `roofing` layer, the rest on `siding`. New materials `stone` and `wainscot` (the wainscot colour is the model's).
- `lib/geometry/electrical.ts`: shade-and-arm box for goosenecks, a glowing box for lanterns; plan symbols for both.
- Estimate (`trim` and `siding` categories): cupola by stock size (24–48"), saddle flashing, weathervane, awning roof per foot plus brackets, 1×4 / 1×6 / drip cap footage by style, wainscot square feet by kind; the two lights have SKUs. Build sequence gains "Cupola and weathervane" and "Awnings, trim and wainscot".
- Rules (`rules/design/looks.ts`): `design.roof.cupolaSize` (about 1¼" of cupola per foot of ridge; info with a fix) and `design.lighting.doorLights` (a light over every outside door; info with "Lights over every door").

### Editor
- Outside step gains a **Looks** section: "Classic barn look" / "Plain", cupola size (with the size that suits this roof marked), count, weathervane, louvered or windowed; trim style with a plain-English hint; wainscot kind and height (and its colour under Colours); "Awning over every door" and "Lights over every door". Each door's panel has its own Awning section (on/off, projection, brackets). The plan draws awnings as a dashed outline outside the wall.

## Consequences
- The 3D view finally shows what the owner is picturing; the estimate carries the extra cost lines so "how much does the cupola add" is a number.
- Trim and awning geometry is decorative: no framing members or cut-list entries yet (the awning rafters and brackets are counted per foot in the estimate). Elevation drawings in the pack still show framing only.
- Open: gable-end "eyebrow" dormers, a gable-form awning (the enum allows it; drawn as shed for now), lighting photometrics for exterior lights, a per-door cupola/awning colour.

## Addendum 2026-09-09 — PBR materials

The owner asked for "actual wood and metal PBR materials". Realistic mode now renders every box with albedo, normal and roughness maps generated procedurally on canvases once per session (`components/scene/textures.ts`): sawn softwood and pressure-treated wood with grain and knots, tongue-and-groove boards with a seam every 5½", painted trim and doors (luminance albedo so the model's colour applies), R-panel steel with a ¾" rib every 9" and two stiffening ribs between (luminance, tinted by the siding / roof colour, metalness 0.35–0.4), board-and-batten (12" boards, 2½" battens), stacked stone veneer with recessed joints, concrete, gravel, dirt, grass and rubber mats. No downloads, no licences, exact scale.

Instanced unit boxes cannot carry per-box texture scale, so `MergedBoxes` replaces `InstancedBoxes`: each material group is one merged geometry (24 vertices per box) with texture coordinates in feet oriented per material (`boxUv.ts`: wood grain along the member's long axis, steel ribs vertical on walls and down the slope on roof planes, everything else plain), vertex colours for the model colour and the selection tint, and picking by face index. Still one draw call per material, and it works identically on the WebGL and WebGPU backends because it is a plain `MeshStandardMaterial`. Gable-end polygons get vertical-rib UVs; the ground becomes grass with the survey grid drawn faintly over it. "Plain white" in the View menu turns all of it off.
