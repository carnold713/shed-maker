# Barn Designer — Claude Code Handoff Spec
> A construction-ready, fully interactive 3D barn/shed design tool. Design the inside (pens, stalls, aisles) or the outside (footprint, roof, doors, windows) — the other side updates live. Output is accurate enough to hand to a builder: framing layouts, truss spacing, materials list, plan sheets, and a shareable link.

**Owner:** Collin
**Stack target:** Next.js (App Router) · TypeScript · React Three Fiber · PostgreSQL · Prisma · Clerk · Railway
**Status:** Greenfield. This document is the source of truth for Phase 0–3.
**Version:** 2 — Part II (§16 onward) adds the reference build, competitive research, the interior-drives-exterior engine, real lumber dimensions, the full post-frame engine, right-click/interaction model, expanded species and layout libraries, and ~100 additional features. Where Part II conflicts with Part I, Part II wins.

---
## 0. How to read this document
- **§1–2** — what we're building and why, and the agent team that builds it.
- **§3–9** — the full feature surface, thought through exhaustively. Not everything ships in v1; each feature is tagged `[P0]` (must), `[P1]` (should), `[P2]` (nice), `[P3]` (someday).
- **§10–13** — data model, architecture, deployment, roadmap.
- **§14** — open questions Collin needs to answer before certain features are locked.

Claude Code: read §2 (agent protocol) and §13 (roadmap) first. Start at Milestone 0.

---
## 1. Vision, goals, non-goals
### 1.1 The problem
Designing an outbuilding today means either paying an architect for a shed, using a manufacturer's clunky configurator that only sells their kit, or sketching on graph paper and hoping the builder interprets it correctly. None of these let you design from the *inside out* (I need three 12×12 stalls and a tack room → what building do I need?) and none produce framing-accurate output.

### 1.2 Goals
1. **Bidirectional design.** Set the footprint and carve up the interior, *or* place pens/rooms and let the tool derive the envelope. Both directions stay in sync.
2. **Live 3D.** Every change renders immediately in a scene with exterior, interior, and cutaway views.
3. **Construction accuracy.** Studs at real OC spacing, headers sized to opening width, trusses at real spacing, plates, blocking, footings. The framing layer is not decorative — it is derived from rules a framer would recognize.
4. **Builder-ready output.** Dimensioned floor plan, elevations, sections, framing plans, door/window schedule, materials list, share link. The builder should be able to bid from it.
5. **Easy to start.** A first-time user should have a plausible barn in under 3 minutes via templates and smart defaults, then refine.
6. **Persisted and shareable.** Saved to Postgres, versioned, shareable read-only with a builder.

### 1.3 Non-goals (v1)
- Not a structural engineering stamp. The tool produces conventional light-frame / post-frame layouts per prescriptive code tables; anything outside prescriptive limits gets flagged "engineer required."
- Not a CAD replacement. No freeform geometry; everything is parametric.
- Not a permit filing system. It produces the drawings a permit *needs*, it does not file them.
- Not multi-story (v1). Loft/hayloft is `[P2]`.

### 1.4 Accuracy contract
Every number the tool emits must be traceable to one of: (a) a user input, (b) a named rule in `rules/` with a code/table citation, or (c) a clearly labeled estimate. The UI shows the provenance on hover. This is the single most important design constraint — see §7.

---
## 2. Agent team & protocol
Claude Code runs this as a multi-agent project. Each agent has a persona file in `/agents/<name>.md` defining scope, standards, deliverables, and hand-off format. The **Lead** orchestrates; specialists produce artifacts in their domain; nobody edits outside their lane without a hand-off note.

### 2.1 Roster
| Agent | Role | Owns | Primary deliverables |
|---|---|---|---|
| **Lead / PM** | Orchestrates, keeps this spec current, resolves conflicts, runs the roadmap | `/docs`, roadmap, ADRs | Milestone plans, decision records, integration reviews |
| **Architect** | Building design advisor. Layout logic, egress, ventilation, animal welfare dimensions, roof forms, site/foundation strategy | `/rules/design/*`, templates | Design rules, template library, layout validation rules, foundation recommendations |
| **Builder / Framer** | Construction method authority. Framing rules, material takeoff, sequencing, installation details (flashing, headers, hold-downs) | `/rules/framing/*`, `/rules/materials/*` | Framing generator rules, BOM logic, cut lists, install notes, "how to build this" sheet |
| **Structural reviewer** `[P1]` | Sanity-checks spans, headers, trusses, post embedment against prescriptive tables; flags engineer-required conditions | `/rules/structural/*` | Span tables, load presets (snow/wind by region), red-flag rules |
| **UI/UX Designer** | Owns the entire product experience: IA, flows, components, 3D interaction model, empty states, onboarding | `/app`, `/components`, design tokens | Wireframes (Figma if desired), component library, interaction spec, visual design |
| **3D Engineer** | Scene graph, geometry generation from the model, cutaway, performance, cameras, picking/drag | `/lib/geometry`, `/components/scene` | Parametric geometry generators, viewer, LOD, export to GLB |
| **Backend Engineer** | Data model, API, auth, persistence, versioning, sharing, Railway | `/prisma`, `/app/api`, infra | Schema, migrations, server actions, deploy config |
| **Drawing / Export Engineer** `[P1]` | 2D plan generation (SVG → PDF), schedules, DXF | `/lib/drawings` | Plan sheets, elevations, sections, schedules, PDF pipeline |
| **QA / Test** | Rule-engine tests, geometry snapshot tests, e2e | `/tests` | Golden-file tests for every rule; visual regression for the viewer |
| **Animal husbandry advisor** `[P1]` | Species-specific pen/stall sizes, flooring, ventilation, feed/water placement, safety | `/rules/animals/*` | Per-species presets and validation |
| **Electrical/Plumbing advisor** `[P2]` | Circuits, fixtures, frost-free hydrants, drainage | `/rules/mep/*` | MEP layer rules |

The Lead may spin up additional agents (e.g. **Cost Estimator**, **Site/Drainage**, **Accessibility**) when a milestone needs one. Record each hire in `/docs/agents.md`.

### 2.2 Working protocol
1. **Rules before UI.** The Architect and Builder write rules as pure TypeScript functions with unit tests *before* the UI or 3D depends on them. Rules live in `/rules`, are deterministic, and cite their source (IRC table, APA guide, NDS, manufacturer spec, or "industry convention").
2. **Single model.** There is one `BuildingModel` (§10). UI edits the model; geometry, framing, drawings, BOM are all *derived* from it. Nothing is derived from something else derived.
3. **Hand-off notes.** When an agent finishes a unit, it writes `/docs/handoffs/<date>-<from>-to-<to>.md`: what changed, what's assumed, what's untested, what the next agent needs to know.
4. **Decisions.** Anything non-obvious gets an ADR in `/docs/adr/NNNN-title.md` (context, options, decision, consequences).
5. **Disagreement.** Architect vs Builder conflicts (e.g. aesthetics vs framing simplicity) go to the Lead, who decides and records an ADR. Default tie-breaker: constructability.
6. **Definition of done** for any feature: rule tests pass, geometry snapshot test exists, UI has empty/error/loading states, feature is reflected in the BOM and drawings if applicable, docs updated.

---
## 3. Users & core workflows
### 3.1 Personas
- **Owner-designer (Collin).** Knows what animals and how many, has a rough site, wants to explore options fast and hand something credible to a builder.
- **Builder / contractor.** Receives a share link. Wants dimensions, framing, openings schedule, materials, and to leave comments. Doesn't want to learn a tool.
- **Future: DIY builder.** Wants the step-by-step build sheet and cut list.

### 3.2 The two design directions `[P0]`
**Outside-in:** Start from footprint (e.g. 24×36), pick roof, place doors/windows, then subdivide the interior with pens, walls, and aisles.

**Inside-out:** Start by dropping pens/rooms from a palette ("3× horse stall 12×12", "tack room 10×12", "12' center aisle"), arrange them, and the tool proposes the minimum envelope (snapped to rational framing dimensions — multiples of 2' or 4' — with exterior wall thickness accounted for). User accepts, then tweaks.

Both are edits to the same model. The "derive envelope" action is a command, not a mode; the user can run it any time the interior grows past the walls.

### 3.3 Golden path (first session)
1. Land on `/new` → choose a template (§4.9) or "blank".
2. Set site basics: location (zip → snow/wind/frost presets), approximate slope, orientation (north arrow).
3. Set construction method (post-frame default for barns; stick-frame option).
4. Design in the split view: 2D plan (left) + 3D (right), or full 3D.
5. Run **Check** → see warnings.
6. Open **Builder Pack** → review drawings + BOM.
7. **Share** → link to builder.

### 3.4 Key interactions
- Drag-to-place openings on walls; they snap to stud bays and respect min distance from corners.
- Drag pen edges; dimensions live-update; adjacent pens push/shrink per a chosen behavior (push neighbor vs. resize neighbor).
- Click any wall → contextual panel (height, sheathing, siding, openings list).
- Click any framing member in the framing layer → see its rule provenance ("Jack stud: required at rough openings > 3' per IRC R602.7.5").
- Undo/redo, keyboard nudge, snap toggle, imperial/metric toggle (imperial default, feet-inches display with fractional inches to 1/16).

---
## 4. Feature spec — building envelope
### 4.1 Footprint `[P0]`
- Rectangle primary; L-shape and T-shape `[P1]`; lean-to/shed additions on any side `[P1]`.
- Dimensions in whole feet default; inch precision allowed; snap to 2' / 4' module (sheet goods & truss economy) with an override.
- Wall height (eave height): 8'–16' typical; per-wall override for shed roofs.
- Orientation relative to north (affects sun, prevailing wind notes, and ridge vent advice).

### 4.2 Construction method `[P0]`
- **Post-frame (pole barn):** posts (4×6, 6×6, laminated 3-ply 2×6) at 8' or 10' or 12' OC, embedded or on concrete brackets, girts at 24" OC, trusses bearing on headers/truss carriers, purlins at 24" OC. This is the barn default and is cheaper for large clear spans.
- **Stick-frame (platform):** 2×4 or 2×6 studs at 16" or 24" OC on a slab or stem wall, double top plate, single bottom plate (PT on concrete), trusses at 24" OC.
- **Hybrid** `[P2]`: post-frame shell with stick-framed interior partitions (very common; interior walls are always stick-framed regardless).

Switching method regenerates the framing layer, foundation, and BOM.

### 4.3 Foundation & slab `[P0]` — Architect + Builder
- **Post-frame:** embedded posts in augered holes (diameter, depth ≥ frost depth + 6", concrete collar/cookie), or wet-set brackets on piers, or perma-column. Slab optional, poured after posts (typical) or before.
- **Stick-frame:** monolithic slab with thickened edge (turned-down footing), or stem wall on spread footing to frost depth.
- **Slab spec:** thickness (4" default, 5–6" for equipment bays), rebar/mesh, vapor barrier, compacted gravel base depth, control joint layout (auto at ≤ 2.5–3× thickness in feet, e.g. 12' max for 4"), pitch to drains for wash areas (1/8"–1/4" per foot).
- **Frost depth** from zip lookup (Cleveland-area ≈ 32–42" — the tool must say "verify with your local building department" and let the user override).
- **Animal-specific flooring** per pen: concrete, concrete + rubber mats, compacted gravel/screenings, dirt. Affects slab layout (slab can be partial — aisle and tack room only, stalls on gravel; this is very common and saves money).
- Slab vs. no-slab per zone shown in 3D and in the foundation plan.

### 4.4 Walls `[P0]`
- Exterior wall assembly: framing (per method) + sheathing (OSB/plywood or none for post-frame with steel directly on girts) + WRB + siding.
- Siding options: steel panel (vertical, 36" coverage), board & batten, lap siding, T1-11, cedar. Affects BOM and 3D material.
- Wainscot band `[P1]` (kick board / different lower panel color/material, 3'–4' high — very common on pole barns).
- Interior wall finish per wall: none (exposed framing), plywood/OSB kickwall to 4' (standard in stalls), full OSB, drywall (utility rooms only).
- Insulation per wall `[P1]`: none, batt, spray foam, board — affects thickness and BOM.
- Wall colors/trim colors in 3D.

### 4.5 Roof `[P0]`
Roof forms (all parametric):
- **Gable** (default). Pitch 3:12–8:12. Overhang (eave and gable) 0–24".
- **Shed / mono-slope.** One high wall, one low.
- **Gambrel** `[P1]` (classic barn look, enables loft).
- **Hip** `[P2]`.
- **Monitor / raised center** `[P2]` (center aisle taller with clerestory windows).
- **Lean-to / awning** on any side `[P1]`: attached shed roof, own pitch, posts at edge, open or enclosed. Multiple allowed. This is how you get an overhang for run-in shelter.
- **Porch / overhang** at gable end `[P2]`.

Roof structure:
- Trusses (engineered, 24" OC default; 4' OC on post-frame with 2×4 purlins on edge is common — Builder decides rule) with span, heel height, bearing, and a note "trusses are ordered from a truss manufacturer — this tool provides span, pitch, heel, and spacing for the quote."
- Rafter-framed option `[P1]` for small spans (≤ 16'), with ridge board/beam, collar ties, rafter sizing from IRC span tables.
- Purlins / roof sheathing per method.
- Roofing: steel panel (default for barns), asphalt shingle, standing seam `[P2]`.
- Ridge vent, gable vents, soffit vents, cupola `[P1]` (cupolas are functional for barn ventilation, not just decorative).
- Gutters/downspouts `[P1]` with downspout locations feeding drainage plan.
- Snow load preset from location; flag "engineer required" if span × load exceeds prescriptive tables.

### 4.6 Doors `[P0]`
Door types (each with real rough-opening rules, header sizing, and hardware):
- **Man door** (36×80 default; 32/34/36 widths; in/out swing; with/without half-light; steel or wood).
- **Double / dual door** (hinged, 5'–8' wide; center-latch; astragal).
- **Dutch door** `[P1]` (stall exterior doors — top half opens separately).
- **Sliding barn door** (single or bi-parting; track above opening; door leaf is opening + 4–6" each side; exterior-hung; needs a header and blocking for the track; very common on barns and cheaper than overhead doors).
- **Overhead / roll-up door** (sectional overhead: 8×7, 9×8, 10×10, 12×12, 16×8 etc.; roll-up coil door: needs headroom above the opening — tool shows the headroom envelope in 3D and warns if truss bottom chord conflicts).
- **Stall door / gate** (interior: 4' sliding stall door, 4' swing gate, mesh or bars on top half).
- **Interior door** (32/36 hinged for tack/feed rooms).

For every door: position along the wall (from a corner, snapped to stud bays), sill detail (concrete threshold, no sill for gravel), swing direction, header size (auto from width, method, and load: e.g. stick-frame 2-ply 2×10 for ≤ 8' in a bearing wall — from IRC R602.7 tables; post-frame headers/truss carriers differ), jack/king stud layout, and hardware in BOM.

### 4.7 Windows `[P0]`
- Sizes: preset catalog (2×3, 3×3, 3×4, 4×4, 4×6, 6×4, etc.) plus custom.
- Types: single hung, slider, fixed, awning, hopper (barns typically use sliders or fixed with protective grille), transom/clerestory strips `[P1]`.
- Sill height (auto 4' in stalls — above kick-wall — with override), header height aligned to door heads by default.
- Grilles/guards on animal side `[P1]`.
- Rough opening = unit + 1/2" each side (rule), header sizing as with doors, flashing sequence in the install notes (sill pan → side flashing → head flashing, WRB lapping).
- Egress check `[P1]` for any "habitable" room (office).

### 4.8 Exterior extras
- Hay door / loft door `[P2]`.
- Exterior lighting, hose bibs, electrical panel location `[P2]` (see §6).
- Ramps, aprons (concrete apron outside overhead doors), gravel pads `[P1]`.
- Run-in area (three-sided shelter as a lean-to) `[P1]`.

### 4.9 Templates `[P0]`
Ship with 8–12 starting points, each a full valid model:
- 12×20 run-in shed (shed roof, open front)
- 24×24 two-stall + tack
- 24×36 center-aisle, 4 stalls
- 30×40 center-aisle, 6 stalls, hay storage
- 36×48 with lean-to
- 20×30 goat/sheep barn with kidding pens
- 12×16 chicken coop/run building
- 24×32 equipment + 2 pens
- 40×60 pole barn shell (blank interior)

---
## 5. Feature spec — interior
### 5.1 Zones / rooms `[P0]`
The interior is a set of **zones** on the plan. Zone types carry defaults, validation rules, and BOM implications:
- **Pen / stall** (species-typed, see §5.2)
- **Aisle** (center or side; min 10' for horses to be safe with a tractor/cart; 12' typical)
- **Tack room** (finished, usually the only insulated/conditioned room)
- **Feed room** (rodent-resistant, near delivery door)
- **Hay / bedding storage** (large door access, fire separation note)
- **Wash / grooming bay** (slab pitched to drain, hot/cold water, non-slip)
- **Equipment / tractor bay**
- **Office / lounge** `[P1]`
- **Kidding / lambing / farrowing / brooder pen** (species presets)
- **Milking area** `[P2]`
- **Utility / mechanical** (panel, water heater, well pressure tank)
- **Restroom** `[P2]`
- **Open / undefined**

### 5.2 Species presets `[P0 for horse/goat/chicken, P1 others]` — Animal advisor
Each species carries: min/recommended pen size per head, group housing rules, ceiling height, door width, flooring, wall height and construction (kick-wall thickness, gap tolerance to prevent hoof entrapment), ventilation rate, feeder/waterer placement, and fencing/gate specs.
- Horse (12×12 std; 12×16 foaling; 14×14 draft; 8' min ceiling, 10–12' preferred; 4' doors; kick-wall 4' of 2× material or ¾" plywood on interior; no gaps 3–6")
- Pony / mini
- Goat / sheep (15–20 sq ft/head; kidding pens 4×5 to 5×6; 4' walls fine; goats climb — note it)
- Cattle (per head by class; headgate/chute location `[P2]`)
- Pig (farrowing crate dims, creep area)
- Chicken (3–4 sq ft/bird inside, roost/nest box counts, run access pop doors)
- Alpaca/llama, rabbit, dog kennel `[P2]`
- Generic / storage

Validation: "Stall 3 is 10×10 — below the 12×12 recommended for a full-size horse."

### 5.3 Interior walls & partitions `[P0]`
- Stick-framed 2×4 or 2×6 partitions; full-height or partial (4'–5' with grille/mesh above for pens).
- Stall fronts: solid lower + bars/grille upper; sliding or swing door integrated.
- Kick-wall material and height per wall.
- Load-bearing flag: in stick-frame barns interior partitions may carry a beam for the loft `[P2]`; in post-frame, interior walls are almost never bearing (trusses clear-span). Tool defaults accordingly.

### 5.4 Fixtures & equipment `[P1]`
Placed objects with footprint + clearance rules, shown in 3D and listed in BOM:
- Feeders (corner, wall, hay rack), waterers (automatic, bucket holder), salt block holder
- Frost-free hydrant locations, hose reels
- Tack hooks, saddle racks, blanket bars
- Cross-tie rings, wash rack fixtures
- Nest boxes, roosts, brooder plates
- Fans (stall fans, HVLS `[P2]`), heaters
- Storage shelving, grain bins
- Cameras `[P2]`

### 5.5 Circulation & safety checks `[P1]` — Architect
- Every pen has a door to an aisle or exterior.
- Aisle width ≥ preset per species/equipment.
- Two exits for buildings above a certain size (fire safety for barns — hay).
- Hay storage separated from stalls (recommendation, not code in most places).
- Door swing conflicts (two doors that collide).
- Headroom under trusses/bottom chord vs. overhead door track.

---
## 6. Feature spec — utilities & site
### 6.1 Electrical `[P2]`
- Panel location, feeder from house (distance → wire gauge note), circuits by zone, receptacle/switch/light placement with symbols, exterior lights, GFCI/wet-location rules, conduit runs shown in plan. Output an electrical plan sheet. Advisor agent writes the rules.

### 6.2 Water & drainage `[P2]`
- Supply line entry, frost-free hydrants, wash bay drain, floor drains, trench drain at overhead door, exterior grading (slab 4–6" above grade, 6" fall in first 10'), downspout discharge, French drain option.

### 6.3 Ventilation `[P1]`
- Natural: eave/ridge, gable vents, cupola, Dutch doors, stall windows; cross-ventilation check from opening placement vs. prevailing wind.
- Mechanical: exhaust fans sized by air changes/hour per species.

### 6.4 Site `[P1]`
- Property boundary + setbacks entry (user supplies), building placed on site plan, driveway/approach to overhead door, manure storage location, paddock gates aligned with pen exterior doors, sun path overlay `[P2]`, existing structures as blocks.

---
## 7. Construction engine (the accuracy core)
This is what makes the tool builder-ready. All of it lives in `/rules` and `/lib/geometry` and is generated from the model.

### 7.1 Framing generator — stick-frame `[P0]` — Builder
For each wall, generate members:
- Bottom plate (PT on concrete), single; double top plate with lap joints at corners and splices ≥ 24" from stud below.
- Studs at 16" OC (default) or 24" OC (2×6 only), laid out from the same corner the sheet goods start (so a 4×8 sheet lands on a stud), with a stud at every wall end and corner (3-stud or California corner option), partition backing where interior walls meet.
- Openings: king studs, jack (trimmer) studs — 1 jack for ≤ 6', 2 jacks > 6'; header per span table keyed to width, species (SPF #2 default), and whether the wall is bearing; cripples above/below to maintain layout; rough sill for windows.
- Blocking: fire blocking at 10' walls, mid-height blocking for siding nailing where required, blocking for sliding door track, blocking for fixtures.
- Let-in bracing or sheathing shear panels note (sheathed walls = braced walls; unsheathed needs diagonal bracing).
- Anchor bolts: ½" at ≤ 6' OC, within 12" of plate ends, min 2 per plate segment.

### 7.2 Framing generator — post-frame `[P0]` — Builder
- Posts at bay spacing (8'/10'/12'), plus at every corner and each side of large openings; embedment depth = frost + margin, min 4'; uplift cleats/rebar; concrete collar.
- Splash board (PT skirt board) at grade; girts at 24" OC (or bookshelf girts option); top girt/eave girt; truss carrier / header (e.g. 2-ply 2×12 notched into posts) sized by bay spacing and truss reaction.
- Trusses at 4' OC (on post-frame) with 2×4 purlins on edge at 24" OC, or 2' OC trusses with sheathing (user choice, Builder sets defaults).
- Knee braces at post/truss.
- Headers over doors framed between posts; overhead door openings get a post each side.
- Lean-to: outer posts, ledger/header on main posts, rafters or trusses at spacing.

### 7.3 Roof structure `[P0]`
- Truss geometry from span, pitch, heel height, overhang, type (common, scissor `[P1]`, gambrel `[P1]`, mono).
- Truss count and layout (gable-end truss + drop or ladder framing for gable overhang).
- Rafter option with size/span check from IRC R802 tables.
- Purlin/sheathing layout, ridge cap, drip edge, closure strips for steel.
- Hurricane ties / truss anchors at each bearing.

### 7.4 Openings detail `[P0]`
Per opening the tool outputs: rough opening size, header size and ply count, jack/king count, sill/threshold detail, flashing sequence, hardware list, and a callout on the elevation. Roll-up and overhead doors get headroom and side-room checks and a track/spring note ("verify with door supplier").

### 7.5 Foundation detail `[P0]`
Slab thickness, base, vapor barrier, reinforcement, control joints, thickened edges, post hole schedule (count, diameter, depth, concrete volume), pier/bracket schedule, anchor bolt layout.

### 7.6 Loads & regional presets `[P0 basic, P1 full]` — Structural reviewer
Zip → ground snow load, wind speed, frost depth, seismic category (from ASCE 7 approximations / a lookup table; label as estimates). Feed into truss note, header tables, post embedment. Any condition outside prescriptive (spans > table, unusual loads, lofts) raises a red **"Engineer stamp required"** banner in the Builder Pack.

### 7.7 Validation engine `[P0]`
A rules runner that returns `{ severity: 'error' | 'warn' | 'info', rule, message, entityIds, fix? }`. Errors block "construction-ready" status but not saving. Every rule has a test. Examples:
- Opening within 12" of a corner post/stud (error in post-frame, warn in stick).
- Overhead door headroom conflict with truss bottom chord.
- Stall below species minimum.
- Ceiling height below species minimum.
- Wall length not on 2' module (info: "adds sheet-goods waste").
- Slab pitch missing in wash bay.
- No second exit in building > X sq ft with hay storage.
- Frost depth not set / not verified.

### 7.8 Materials & cost `[P0 BOM, P1 cost]`
- Bill of materials grouped by phase: site/foundation, posts/framing, roof, doors/windows, siding/trim, interior, hardware/fasteners, MEP. Quantities with waste factors (10% lumber, 5% steel panels, 15% siding on complex forms), lengths rounded to stock (8/10/12/14/16').
- Cut list `[P1]` for studs, girts, purlins, blocking.
- Unit-cost table the user can edit; estimate total with low/high band. Costs are user-supplied or clearly-labeled placeholders — never presented as quotes.
- Export CSV/XLSX.

### 7.9 Build sequence sheet `[P1]` — Builder
An ordered "how this gets built" narrative generated from the model: site prep → layout & batter boards → post holes → posts & bracing → truss carriers → trusses & purlins → roof steel → girts → door/window framing → siding → slab → interior partitions → doors/windows → fixtures. With key checks (square via diagonals, plumb, string lines) and the install details for each opening.

---
## 8. 3D viewer
### 8.1 Views `[P0]`
- **Exterior orbit** (default), **Interior walk / orbit**, **Top-down plan** (orthographic), **Elevations** (N/S/E/W ortho), **Cutaway** (see below), **Framing-only** (skin off).
- Camera presets + free orbit; smooth transitions; saved camera bookmarks `[P1]`.
- First-person walk mode `[P1]` (WASD, eye height 5'8", collision with walls).

### 8.2 Cutaway `[P0]`
- Section plane (horizontal at any height; vertical along any axis) with a draggable gizmo. Clipped geometry gets a solid cap color.
- "Dollhouse" preset: roof lifted off, and/or walls cut at 4'.
- Per-layer visibility: roof, roofing, roof structure, exterior skin, sheathing, framing, interior walls, fixtures, foundation, slab, site, dimensions, MEP.

### 8.3 Interaction `[P0]`
- Click to select any entity → inspector panel. Hover highlight. Multi-select `[P1]`.
- Drag openings along walls, drag pens in plan, drag wall lines. Gizmos for height.
- Live dimension labels on selected entities; global dimension overlay toggle.
- Measure tool (point-to-point) `[P1]`.
- Materials/colors: realistic (steel panels with rib profile, wood, concrete) and a clean "white model" mode.

### 8.4 Rendering `[P0]`
- React Three Fiber + drei; instanced meshes for studs/girts/purlins (thousands of members must stay 60 fps); merged geometry for skins; shadows with a sun light driven by orientation; environment map; SSAO `[P2]`.
- Geometry is generated from the model in a worker where heavy `[P1]`.
- Screenshot/render export (PNG) `[P0]`; GLB export `[P1]`; turntable video `[P3]`.
- Mobile/tablet: view-only is fine `[P1]`; editing on desktop.

---
## 9. Outputs — the Builder Pack
### 9.1 Drawings `[P1]` — Drawing engineer
Generated as SVG from the model, composed into a PDF set (ANSI B / 11×17 landscape, title block, scale, north arrow, sheet index):
- A0 Cover + summary (sq ft, method, loads, revision)
- A1 Site plan
- A2 Foundation / slab / post plan (hole schedule, anchor bolts, control joints)
- A3 Floor plan (dimensioned, zone labels, door/window tags, fixtures)
- A4 Roof plan
- A5 Elevations ×4 (openings, siding, grade line, heights)
- A6 Building sections (1–2, through aisle and through a stall)
- A7 Wall framing elevations (each wall unfolded, every member labeled)
- A8 Roof framing / truss layout
- A9 Details (typical opening, post base, eave, ridge, slab edge, stall wall)
- S1 Door & window schedule; S2 Room/pen schedule; S3 Materials list
- E1/P1 Electrical & plumbing `[P2]`
- Build sequence sheet `[P1]`

### 9.2 Exports
- PDF set `[P1]`, PNG renders `[P0]`, BOM CSV/XLSX `[P0]`, DXF of floor plan `[P2]`, GLB `[P1]`, JSON model `[P0]`.

### 9.3 Sharing & collaboration `[P0 share, P1 comments]`
- Read-only share link (token) for the builder; optional password; expiring.
- Builder can pin comments to entities or locations in 3D/plan (no account required, name + email) `[P1]`.
- Version history with named snapshots ("v3 – sent to Mike") and diff summary ("added window on north wall, changed roof pitch 4:12 → 5:12") `[P1]`.

---
## 10. Data model
### 10.1 Principle
The **model is a single JSON document** (`BuildingModel`, versioned schema with `schemaVersion`) stored in a `jsonb` column. Relational tables handle identity, ownership, sharing, versions, and comments. This keeps geometry/rules purely in TypeScript and avoids a 40-table schema for a document-shaped thing. Use Zod for the schema; migrations of the JSON are code (`migrateModel(v1 → v2)`).

### 10.2 `BuildingModel` (TypeScript sketch)
```ts
type Id = string; // nanoid
interface BuildingModel {
  schemaVersion: number;
  units: 'imperial' | 'metric';
  site: { zip?: string; lat?: number; lng?: number; orientationDeg: number;
          frostDepthIn?: number; groundSnowPsf?: number; windMph?: number;
          verified: { frost: boolean; snow: boolean; wind: boolean };
          boundary?: Pt[]; setbacksFt?: {n:number;s:number;e:number;w:number}; };
  method: 'postFrame' | 'stickFrame';
  footprint: { kind: 'rect'; wFt: number; dFt: number } | { kind: 'poly'; pts: Pt[] };
  walls: Wall[];               // exterior + interior; each with start/end (plan coords), height, assembly
  openings: Opening[];         // ref wallId, type, size, offset, sill, swing, hardware
  roof: Roof;                  // form, pitch, overhangs, structure, covering, vents
  leanTos: LeanTo[];
  foundation: Foundation;      // slab zones, posts, footings, anchors
  zones: Zone[];               // polygons with type, species, flooring, name
  fixtures: Fixture[];
  mep?: { electrical?: ...; plumbing?: ... };
  materials: MaterialChoices;  // siding, roofing, colors, trim
  overrides: Override[];       // user overrides of generated members (with reason)
  meta: { name: string; notes?: string; createdAt: string; updatedAt: string };
}
```
Derived (never stored, always recomputed; cache in memory): `FramingSet`, `Geometry`, `BOM`, `Drawings`, `ValidationReport`.

### 10.3 Postgres (Prisma)
```prisma
model User        { id String @id; clerkId String @unique; email String; name String?; createdAt DateTime @default(now())
                    projects Project[] }
model Project     { id String @id @default(cuid()); ownerId String; owner User @relation(...)
                    name String; description String?; thumbnailUrl String?
                    currentVersionId String?; archived Boolean @default(false)
                    createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
                    versions ProjectVersion[]; shares ShareLink[]; comments Comment[]
                    @@index([ownerId]) }
model ProjectVersion { id String @id @default(cuid()); projectId String; project Project @relation(...)
                    number Int; label String?; model Json; schemaVersion Int
                    summary String?           // auto diff summary
                    createdById String; createdAt DateTime @default(now())
                    @@unique([projectId, number]) }
model ShareLink   { id String @id @default(cuid()); projectId String; token String @unique
                    role String @default("viewer")  // viewer | commenter
                    passwordHash String?; expiresAt DateTime?; createdAt DateTime @default(now()) }
model Comment     { id String @id @default(cuid()); projectId String; versionId String?
                    authorName String; authorEmail String?; authorUserId String?
                    body String; anchor Json?   // { entityId?, point3d?, plan2d? }
                    resolved Boolean @default(false); createdAt DateTime @default(now()) }
model Template    { id String @id; name String; description String; category String; model Json; thumbnailUrl String?; sortOrder Int }
model MaterialPrice { id String @id; userId String?; sku String; description String; unit String; unitCost Decimal; source String?; updatedAt DateTime }
```
- Autosave: debounce 2s → `PATCH` current working copy (stored on `Project.draftModel Json` `[P0]`), explicit "Save version" creates a `ProjectVersion`.
- Thumbnails: client renders PNG on save → upload to Railway volume or S3-compatible bucket `[P1]`.

---
## 11. Architecture & stack
- **Next.js 15 (App Router), TypeScript strict, Tailwind, shadcn/ui** for panels/inspector.
- **3D:** `three` + `@react-three/fiber` + `@react-three/drei`; `three-bvh-csg` or manual clipping planes for cutaway (prefer clipping planes + cap rendering; CSG only if needed).
- **2D plan:** SVG (React) sharing the same model; also the source for drawings.
- **State:** Zustand store holding `BuildingModel` + undo/redo (zundo or command pattern with inverse ops). Derived data via memoized selectors; heavy derivations in a Web Worker (`comlink`).
- **Rules:** `/rules/**` pure functions, `vitest`, golden JSON fixtures, citations in JSDoc.
- **Geometry:** `/lib/geometry/**` returns typed member lists (`{ id, kind, profile, start, end, rotation, ruleRef }`) → instanced rendering + drawing generation from the same list.
- **PDF:** `@react-pdf/renderer` or server-side `puppeteer` on SVG pages (Railway can run Chromium; decide in ADR).
- **Auth:** Clerk. **DB:** Postgres via Prisma. **Validation:** Zod at API boundary.
- **Testing:** vitest (rules/geometry), Playwright (e2e golden path), visual regression on canvas snapshots for the viewer.
- **Repo layout**
```
/app            routes: /, /new, /p/[id], /p/[id]/pack, /s/[token]
/components     ui/, scene/, plan/, inspector/, pack/
/lib            geometry/, drawings/, bom/, model/ (schema, migrations, commands)
/rules          design/, framing/, structural/, animals/, materials/, mep/
/agents         persona files
/docs           adr/, handoffs/, agents.md, RULES_INDEX.md
/prisma
/tests
```

---
## 12. Railway deployment
- Services: `web` (Next.js, Node 20, `next build && next start`), `postgres` (Railway plugin), optional `worker` `[P1]` for PDF generation and thumbnails if Chromium is used, optional volume for uploads.
- Env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `APP_URL`, `SHARE_TOKEN_SECRET`.
- `prisma migrate deploy` as a pre-deploy command; healthcheck `/api/health`.
- Preview environments per PR `[P1]`. Nightly `pg_dump` to a bucket `[P1]`.
- Keep the 3D bundle out of the initial route: lazy-load the scene, code-split three.

---
## 13. Roadmap
| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0 — Skeleton** (week 1) | Repo, Next+Clerk+Prisma on Railway, `BuildingModel` schema + Zod, Zustand store, undo/redo, a rect footprint rendered in 3D and 2D, autosave | Deployed; create/save/reload a rectangle |
| **M1 — Envelope** | Walls, gable/shed roof, man/double/sliding/overhead doors, windows, siding/roofing materials, orbit/interior/cutaway views, layer toggles | A user can build a believable 24×36 shell in 3D |
| **M2 — Framing engine** | Stick-frame + post-frame generators, opening framing, truss/purlin layout, foundation/post schedule, provenance on members, rule tests | Framing layer matches what a framer would lay out; QA golden tests green |
| **M3 — Interior** | Zones, species presets (horse/goat/chicken), partitions, stall fronts, aisle, inside-out "derive envelope", validation engine + Check panel | Inside-out and outside-in both work; warnings surface |
| **M4 — Builder Pack v1** | BOM with waste, CSV/XLSX, PNG renders, share links, templates | Collin can send a link + BOM to a builder |
| **M5 — Drawings** | SVG plan/elevations/sections/framing sheets → PDF, schedules, build sequence sheet, versions + diff summaries, comments | A PDF set a builder can bid from |
| **M6 — Depth** | Lean-tos, gambrel, Dutch doors, wainscot, insulation, fixtures, ventilation checks, cost estimate, cut list, more species | Feature-complete v1 |
| **M7+** | MEP, site plan, loft, DXF, first-person, hip/monitor roofs, mobile | — |

Each milestone ends with a Lead integration review and updated handoff docs.

---
## 14. Open questions for Collin
1. **Which animals first?** Assume horses + goats + chickens for presets unless told otherwise.
2. **Post-frame or stick-frame default?** Spec says post-frame for barns. Confirm this is what your builder does.
3. **Jurisdiction:** Cuyahoga County / which municipality? Determines frost depth, snow load, and whether ag buildings are exempt from some permit requirements (many Ohio townships exempt agricultural buildings — worth confirming; the tool should still generate compliant framing).
4. **Loft/hayloft** needed in v1 or later?
5. **PDF fidelity:** are hand-off drawings a must for the first builder conversation, or is 3D + BOM enough to get a bid started?
6. **Cost data:** do you want to enter local prices or is a rough national placeholder OK?
7. **Metric support** at all, or imperial only?

---
## 15. Accuracy & liability statement (show in-app)
> This tool generates conventional light-frame and post-frame layouts using prescriptive rules and common industry practice. It is a planning and communication aid, not a substitute for a licensed engineer, architect, or your local building department. Verify frost depth, snow and wind loads, setbacks, and permit requirements with your jurisdiction. Trusses, overhead doors, and any span or load outside prescriptive tables must be confirmed by the manufacturer or an engineer.

---
## Appendix A — Rule citation conventions
Each rule exports `{ id, title, source, applies, evaluate }`. `source` is one of: `IRC:R602.7`, `IRC:R802`, `IRC:R403`, `NDS`, `APA:...`, `NFBA:...` (National Frame Building Association post-frame guidance), `Industry`, `Species:<org>` (e.g. university extension guidelines for stall sizes), or `User`. `/docs/RULES_INDEX.md` is auto-generated from these.

## Appendix B — Default values (Builder/Architect to confirm)
Stud 16" OC · girt 24" OC · purlin 24" OC · post bay 8' · truss 4' OC (post-frame) / 2' OC (stick) · eave height 10' · pitch 4:12 · overhang 12" · slab 4" · gravel base 4" · frost 36" (Cleveland, verify) · horse stall 12×12 · aisle 12' · man door 36×80 · sliding door 8×8 · overhead 10×10 · stall window 3×4 @ 4' sill · wainscot 3'.

---
---
# PART II — v2 Expansion
## 16. Reference build & what v2 changes
### 16.1 The reference build
Collin supplied two reference images. Both are **post-frame (pole barn)** construction and this is the construction method the tool must model natively and best:
- **Photo (built):** ~30×40 gable, 6×6 posts on ~8'–10' bays, 2× girts on the face of the posts at ~24" OC, a doubled 2× truss carrier (header) notched/bolted at the eave, engineered trusses on ~4' centers with 2×4 purlins on edge, gable-end truss with lookout/ladder overhang framing, monolithic concrete slab poured inside the post line with posts sitting outside the slab edge, open bays (no girts yet) where the large doors go.
- **Render (model):** same system on **concrete piers** (surface-mounted posts on cylindrical piers, no embedded wood) — the alternative foundation the tool must also support — with a full-height end-wall post grid, a doorway framed between posts, and slab-on-grade.
The 3D framing view of this tool, in "framing only" mode, should look like the render. That is the acceptance bar for M2: a builder looks at it and recognizes their own building.
### 16.2 What v2 changes
1. Post-frame is not just the default — it is the **primary engine**, with stick-frame as the interior-partition system and a secondary shell option (§20).
2. **Interior drives exterior** is a real constraint engine, not a "derive envelope" button (§18).
3. Every geometry is generated from **actual lumber dimensions**; every BOM line uses **nominal** names (§19).
4. A full **interaction model**: right-click menus everywhere, keyboard, marquee, arrays, mirror, command palette (§21).
5. Research-backed species, layout-pattern, and stall-system libraries (§22–24).
6. ~100 new features across workflow analysis, site, pasture/fencing, costs, expansion, and output (§25–30).
---
## 17. Competitive research — what exists, what's missing
### 17.1 What the market offers today
The post-frame industry has settled on a genre: free 3D "design your building" configurators that funnel into a quote. Representative examples reviewed:
- **Morton Buildings 3D Studio** — design a pole barn, customize features, request a sales consultation.
- **Lester Buildings — MyLester Design®** — custom 3D program; save to revisit, submit for quote; notes that truss design varies by region.
- **Wick Buildings — DESIGN 3D™** — start from a "standard" ag/equestrian design, customize size, pick pre-designed wall options for doors and windows; emphasizes realistic renderings over "cartoonish" ones.
- **FBi Buildings** — has an 'Interior' step and lets you place scaled items in the building to check it's big enough, then submit for quote.
- **Buildings by Timberline** — building style, size, colors, doors/windows, roof pitch; rotate and preview; submit for expert review.
- **Sherman Pole Buildings** — team reviews the design and adjusts roof pitch, door sizes, wall height, post spacing before quoting; explicitly a starting point, not a plan set.
- **Pioneer Pole Buildings (On The Z configurator)** — click/touch doors and windows for options.
- **WebShed** — a white-label B2B shed/pole-barn configurator sold to builders.
- **DIY Pole Barns, I Love Pole Buildings** — similar free configurators with quote submission.
### 17.2 Gaps — and our differentiators
| Every configurator | Barn Designer |
|---|---|
| Exterior-only: size, color, doors, windows, pitch | **Interior-first** — pens, stalls, aisles, rooms drive the envelope |
| Interior at best "drop a scaled tractor to see if it fits" | Species-aware pens with validation, stall fronts, gates, fixtures, workflow routes |
| No framing shown; truss/post spacing decided later by the builder | **Full framing model** — posts, girts, carriers, trusses, purlins, headers, with provenance |
| Output = a render + a lead form | Output = **plan set, framing elevations, schedules, BOM, cut list, build sequence** |
| One vendor's catalog | Vendor-neutral catalog; user-editable prices; export to any builder or lumber yard |
| No versioning, no comments | Versions, diffs, builder comments on the model |
| Rectangle only, one roof | Rect/L/T, lean-tos, gable/shed/gambrel/monitor, attached runs |
The lesson from the market is also a **UX** lesson: the good ones start you from a template and let you click directly on the building. We keep that on-ramp and add depth behind it.
---
## 18. Interior-drives-exterior engine `[P0]`
This is the heart of the product. It replaces §3.2's "derive envelope" command with a live constraint system.
### 18.1 The post-bay grid is the design grid
In post-frame, everything rational happens on the **bay** (8', 10', or 12' between posts) and the **truss span** (building width). Interior design snaps to this grid by default:
- Stall rows sit between post lines: a 12×12 stall on 12' bays = one stall per bay; 10' bays → 10×12 stalls or a 20' double pen per two bays.
- The user picks bay spacing first (or the tool proposes it from the pens they want).
- "Off-grid" placement is allowed but flagged: "Wall at 14'-6" does not land on a post; a stick-framed partition will be used."
### 18.2 Interior objects and their exterior consequences
Every interior object declares what it needs from the envelope. When placed or edited, the envelope reacts:
| Interior change | Exterior reaction (auto, with undo) |
|---|---|
| Add a stall against an exterior wall | Offers a **Dutch door** and a **stall window** on that wall segment (per species preset); adds exterior door if "outside access" is on |
| Add stalls beyond the current length | **Adds a bay** — the wall extends by one bay spacing, posts/girts/trusses regenerate, roof extends |
| Add stalls beyond width | Proposes wider truss span (e.g. 30 → 36) with a warning if the span exceeds the truss preset; or proposes a **lean-to** to absorb the row |
| Center aisle set to 14' | Recomputes width: stalls + aisle + wall thicknesses → nearest 2' module |
| Add a wash bay | Flags slab zone + drain; proposes a hose bib and hot water location; suggests exterior wall placement for drainage |
| Add hay storage | Proposes an overhead/sliding door ≥ 10' on the nearest exterior wall facing the driveway; raises eave height suggestion if stacking |
| Add tack room | Proposes insulation and a man door; marks that room "conditioned" |
| Mark a pen "outside access" | Cuts an exterior opening centered on the pen; adds an outdoor **run** stub on the site plan |
| Equipment bay with tractor | Checks door width/height vs. equipment preset; raises eave height if needed |
All reactions are **proposals**: they appear as ghosted geometry with an Accept / Dismiss chip, so the user stays in control. A "Just do it" preference turns proposals into direct edits.
### 18.3 Envelope solver
Given the set of interior zones and their adjacency/wall preferences, propose 1–3 envelopes:
1. **Tightest** — minimum footprint on the bay module.
2. **Balanced** — adds circulation slack, symmetric bays, aisles centered on the ridge.
3. **Expandable** — same as balanced plus one empty bay at one end and a lean-to reserved.
Each proposal shows footprint, sq ft, post count, truss span, rough cost delta. Picking one becomes an undoable model edit. Solver respects: wall thickness (girts on face add 1.5" + siding; bookshelf girts add 0), post footprint inside the line, aisle minimums, door clearances, species minimums.
### 18.4 Bidirectional edge cases
- Shrinking the envelope with pens inside: pens that no longer fit turn red; a "Fit pens" action shrinks them proportionally down to their species minimum, then refuses.
- Moving an exterior wall that has openings: openings stay attached at their offset-from-corner; if an opening would fall off the wall, it's parked in a tray.
- Changing bay spacing: interior walls that were "on grid" re-snap to the new grid and the user is shown a diff.
### 18.5 Layout modes (§23 patterns) as generators
Choose a pattern (center-aisle, shed-row, double shed-row, etc.), give stall count and species, and the tool generates a complete, valid model — then edit freely.
---
## 19. Dimensional reality: lumber, panels, sheets `[P0]`
Every member in the geometry uses **actual** dimensions; every BOM line uses **nominal** names and stock lengths. The framing generator must never place a "2×6" as a 2"×6" box.
### 19.1 Dimensional lumber (S4S softwood, dry)
| Nominal | Actual | Common uses here |
|---|---|---|
| 1×4 / 1×6 / 1×8 | ¾ × 3½ / 5½ / 7¼ | trim, battens |
| 2×4 | 1½ × 3½ | purlins, girts, interior studs, blocking, knee braces |
| 2×6 | 1½ × 5½ | girts, skirt board, stall kick-wall, exterior studs, 3-ply post plies |
| 2×8 | 1½ × 7¼ | headers, skirt board, truss carriers (light) |
| 2×10 | 1½ × 9¼ | headers, carriers |
| 2×12 | 1½ × 11¼ | truss carriers, large headers, sub-fascia |
| 4×4 | 3½ × 3½ | light posts (run-in, fencing) |
| 4×6 | 3½ × 5½ | posts (small buildings, lean-to) |
| 6×6 | 5½ × 5½ | main posts (default) |
| 6×8 | 5½ × 7¼ | posts for large doors / tall walls |
| 3-ply 2×6 laminated column | 4½ × 5½ | engineered post (glulam/nail-lam) |
| 3-ply 2×8 laminated column | 4½ × 7¼ | tall/large spans |
| 2×6 T&G (center-match) | 1½ × 5⅛ face coverage | stall kick-walls, skirt boards |
Stock lengths: 8, 10, 12, 14, 16, 20 (24 for some species; posts 12/14/16/18/20). Girts and purlins are cut to bay spacing (an 8' bay uses a 16' spanning two bays, staggered — the BOM logic must model **stagger and lap** for continuous girts/purlins over posts).
Treatment: ground-contact PT (UC4B) for embedded posts and skirt boards; above-ground PT (UC3B) for anything touching concrete; SPF/SYP #2 for the rest. Species affects span tables (SYP is stronger than SPF); make species a project setting.
### 19.2 Sheet goods & panels
- Plywood/OSB: 4×8 (actual 48×96), 7/16" OSB sheathing, ½" / ¾" plywood for kick-walls; 5/8" T1-11 siding 4×8 and 4×9.
- **Steel siding/roofing panels:** 36" net coverage (some profiles 32"/38"), cut to length on 1"–increments by the supplier, ribs 9" OC on the standard ag panel, 29 ga default / 26 ga upgrade. Wall panel length = eave height + skirt overlap; roof panel length = rafter/truss slope length + eave overhang + ridge gap. The BOM must output **panel schedules** (count × length per wall and roof plane) — this is exactly what a metal supplier quotes from.
- Trim catalog: ridge cap, rake trim, eave/drip trim, corner trim, J-channel, base/rat guard, door/window trim, closure strips (inside/outside foam), wainscot Z-trim.
- Fasteners: screws per panel (computed from purlin/girt rows × panels), lag/structural screws per carrier connection, nails by pound.
### 19.3 Thickness-aware modeling
- Exterior wall depth = post depth (5½) or girt-on-face (post + 1½) + siding (steel ~¾ rib). Interior clear width is computed from **inside face of interior finish**, not post centerline. The plan shows both post-centerline dimensions (what the builder lays out) and clear interior dimensions (what the horse lives in).
- Concrete: slab thickness, thickened edge width/depth, pier diameter (10/12/16/18/24"), footing pad diameter/thickness, all in the geometry.
- Doors: real leaf thickness, jamb widths, track projection (sliding doors hang ~3" off the wall — must be shown so it doesn't collide with a light or trim).
### 19.4 "Prepare for board width" — the design-time affordances
- Right-click any member → **Change size** (2×4 → 2×6) with downstream effects shown (wall thickness, clear dims, BOM).
- Global lumber defaults panel: post size, girt size, purlin size, carrier plies, kick-wall material.
- Inspector shows *nominal*, *actual*, *length*, *stock length used*, *waste*, *rule* for every member.
- A **Lumber Yard Order Sheet** export groups by nominal size × length × treatment × count, the way a yard wants it.
---
## 20. Post-frame engine v2 `[P0]` — Builder + Structural
Built from NFBA's Post-Frame Building Design Manual terminology and common trade practice; every rule cites its source.
### 20.1 Posts & foundation
- Sizes: 4×6 (≤ 10' eave, small), 6×6 (default), 6×8 / 3-ply laminated (≥ 14' eave, wide bays, next to large doors).
- Bay spacing 8' (default for barns with 12' stalls — see §18.1 for 12' bays), 10', 12'. Extra posts at both sides of every opening ≥ 8' and at all corners; end-wall posts at truss-bearing points and at ≤ 8' for girt support.
- **Embedded posts:** hole diameter ≥ post + 2× concrete collar (typ. 18"–24"), depth = max(frost + 6", 4', ¼ of post length); a pre-cast or poured footing pad 18–24" diameter at the bottom, pad thickness ≈ ½ its diameter; uplift resistance via PT cleats, rebar through the post, or a concrete collar. Backfill spec.
- **Pier / bracket option (render image):** poured piers (Sonotube 12–18") on footings to frost depth, wet-set or drill-set post brackets; posts are then non-treated allowed; slab may be monolithic with the piers.
- **Perma-column / precast pier** option.
- Slab relation options: posts outside slab edge (photo), slab poured to post faces with expansion joint, or slab under posts (bracket method).
- Post schedule output: count, size, length, treatment, hole depth/diameter, concrete per hole (cubic ft) and total bags/yards.
### 20.2 Wall framing
- **Skirt (splash/grade) board:** PT 2×6 or 2×8, one or two rows, with a non-metal barrier between steel and treated wood.
- **Girts:** 2×4 or 2×6, ≤ 24" OC; **face-mounted** (default, fastest) or **bookshelf** (between posts, flat — gives a flush interior for finishing/insulation and more clear width). Top girt/eave girt at the truss bearing line; door/window girts interrupted with framed rough openings.
- **Truss carrier / header:** 2-ply 2×10 or 2×12 (rule keyed to bay spacing, span, and snow load), notched into posts or bolted with structural screws/½" bolts; sized from a lookup table with "engineer required" above limits.
- **Corner and end-wall framing:** corner posts, end-wall girts, **end-wall diagonal bracing** to transfer diaphragm loads, gable-end truss on end posts.
- Knee braces (2×4/2×6 at 45°) post-to-truss when required by span/height.
- Interior partitions: always stick-framed 2×4/2×6 at 16"/24" OC on a PT plate, or **stall panel systems** dropped between posts (§24).
### 20.3 Roof framing
- Trusses on the carriers at 4' OC (default), 2' OC option when sheathing with plywood/shingles, up to 8'–10' OC in some engineered systems (flag as "verify with truss supplier"). Trusses may sit directly on posts when bay = truss spacing.
- Purlins: 2×4 on edge at 24" OC (flat on top / inset "dropped" purlins between trusses is an option — NFBA "purlin types"), lapped and staggered over trusses, blocked at the eave.
- Continuous lateral restraint for web members on long-span trusses (note only; supplier designs).
- Overhangs: rafter extensions / lookouts, sub-fascia, soffit framing; gable overhang ladder.
- Roof steel schedule, ridge vent (with vented closure), gable vents, cupola framing (curb in trusses).
- Load presets by zip (snow/wind) feed the truss spec sheet the supplier needs: span, pitch, heel height, overhang, spacing, top/bottom chord loads, bearing width.
### 20.4 Tolerances & install notes (Build Sequence sheet)
Pull from NFBA Accepted Practices: post plumb, girt alignment and spacing tolerances, truss bearing height and plumbness, carrier bearing alignment (≈ 1/200 of bearing spacing). These become checklist lines in the build sequence sheet.
### 20.5 Stick-frame shell option
Retained from Part I §7.1. Also supports a **hybrid**: post-frame on three sides + stick-framed front wall for lots of windows/doors.
---
## 21. Interaction model `[P0]` — UI/UX Designer
### 21.1 Right-click context menus (everything is right-clickable)
Context menus are the fast path. They are contextual to what's under the cursor, in both 3D and 2D plan:
**Empty floor / plan space**
Add pen ▸ (species list) · Add room ▸ (tack, feed, hay, wash, equipment, office, utility) · Add aisle · Add fixture ▸ · Paste · Set origin here · Measure from here · Zoom to fit
**Exterior wall**
Add door ▸ (man, double, Dutch, sliding, bi-parting, overhead, roll-up) · Add window ▸ (catalog) · Add lean-to on this side · Add wainscot · Change siding · Change wall height · Insulate · Flip which side is "inside" · Split wall at cursor · Framing ▸ (girts face/bookshelf, girt size, add post here) · Properties
**Interior wall / stall front**
Change type (solid / half-wall+grille / stall front system) · Add stall door (sliding/swing) · Add gate · Set kick-wall material/height · Make load-bearing (stick) · Delete wall (merge pens) · Properties
**Pen / stall / zone**
Rename · Species ▸ · Resize to preset ▸ (12×12, 12×16, 14×14…) · Outside access on/off · Add window · Add feeder/waterer/hay rack/salt · Flooring ▸ · Duplicate · Array ▸ (N copies along wall) · Mirror across aisle · Merge with neighbor · Split ▸ (halves, thirds, custom) · Lock · Properties
**Door / window**
Change type ▸ · Change size ▸ · Flip swing / slide direction · Center on wall / on bay / on pen · Nudge ▸ · Copy to opposite wall · Convert (window → Dutch door) · Hardware ▸ · Header ▸ (auto / manual size) · Delete
**Post / girt / truss / purlin (framing layer)**
Show rule · Change size · Add post here / remove (with validation) · Pin (prevent regeneration) · Override with reason (records in `overrides[]`) · Isolate in view
**Roof**
Change form ▸ · Pitch ▸ · Overhang ▸ · Add cupola / ridge vent / gable vent · Add dormer `[P2]` · Roofing ▸ · Lift roof (dollhouse)
**Fixture**
Move · Rotate 90° · Snap to wall · Duplicate · Change model · Add clearance zone · Delete
**Site plan**
Add paddock/run · Add gate · Add driveway · Add existing structure · Set north · Set grade point · Add tree/obstruction
**Selection (multi)**
Align ▸ (left/right/top/bottom/center) · Distribute ▸ · Group / Ungroup · Match sizes · Delete
**Viewport**
View presets ▸ · Cutaway at cursor height · Layers ▸ · Screenshot · Reset camera · Toggle grid / dims / labels · Realistic / white model / framing
### 21.2 Keyboard & mouse
- Standard: Cmd/Ctrl+Z/Y, C/V/D (duplicate), Del, Esc, Space (pan), Shift (constrain), Alt (fine nudge ¼"), arrow nudge (1" / 1' with Shift).
- Hotkeys: P pen, W wall, D door, N window, A aisle, R room, F fixture, M measure, X cutaway, T top view, 1–6 elevations/iso, H hide selection, Shift+H unhide all, L layers, G toggle grid, ` framing view.
- **Cmd+K command palette** (search any action, jump to any entity by name: "stall 4").
- **Marquee select** in plan and 3D; **click-through** cycling for stacked entities; **double-click** enters a sub-mode (double-click a wall → opening placement mode; double-click a pen → edit boundary).
- Drag handles with live dimension entry: start dragging, type "12'6", Enter.
- Right-drag to orbit in 3D; middle-drag pan; scroll zoom to cursor.
- Touch: long-press = right-click; two-finger orbit; pinch zoom `[P1]`.
### 21.3 Snapping & guides
Snap targets (toggleable): post grid, bay lines, 1'/6"/1" grid, wall faces/centerlines, openings, pen edges, the ridge line, existing objects' edges (smart guides), equal-spacing guides (Figma-style pink lines). Snap tolerance in screen pixels. A **snap HUD** shows the current target.
### 21.4 Inspector & panels
Left rail: Layers · Library (pens, rooms, openings, fixtures, materials) · Checks · Versions · Comments. Right inspector: tabs for Geometry, Framing, Materials, Rules, Notes. Bottom: **Builder Pack** drawer (BOM, drawings, schedules) with live totals — sq ft, post count, lumber board-feet, steel sq ft, concrete yards, est. cost.
### 21.5 Quality-of-life
- Onboarding tour, contextual hints, empty states with "try a template".
- **Presets everywhere:** anything with a size has a preset menu with the common sizes first and a "custom…" last.
- Hover shows dimensions and rule badges; long-hover shows a mini spec sheet.
- **Explain this** on any warning → a paragraph in plain language + the fix button.
- Autosave indicator, offline-tolerant editing with sync on reconnect `[P1]`.
- Undo history panel with thumbnails `[P2]`.
---
## 22. Species & animal library v2 — Animal advisor
Numbers below are starting defaults gathered from extension and industry guidance during research; each becomes a rule with its source in Appendix C. All are editable per project.
| Species / class | Individual pen | Group housing | Notes that become rules |
|---|---|---|---|
| Horse (riding) | 12×12 minimum; 14×14 preferred | — | Foaling 14×16+; draft 14×14+; 8' min ceiling (10–12' preferred); 4' sliding stall doors; kick-wall 4'+ solid, no 3–6" gaps; window sill above kick-wall; dedicated circuit per stall for heated buckets/fans |
| Pony / mini | 10×10 | — | lower kick-wall OK |
| Goat (does) | 4×5 individual | 15–20 sq ft/head bedded; 25–30+ with kids or long confinement; +25 sq ft exercise | kidding pens 4×5 min (≈16 sq ft), solid walls; feeder 16–20"/head; goats climb — 4'–5' walls, no horizontal ledges, wire above panels; hay racks off the floor |
| Sheep (ewes) | lambing jug 4×4 to 5×5 | 12–16 sq ft/ewe; 15–20 with lambs; rams 20–30 | feeder 9–20"/head; sheep move dark → light, prefer flat, consistent direction — affects chute/handling layout |
| Cattle | — | 14–20 sq ft/head; ~3× if housed overnight; more by class | headgate/chute/alley `[P2]`; heavy gates; concrete or packed base; manure volume high |
| Pig | farrowing 5×7 crate + creep | 8–12 sq ft/finishing | strong low walls, rooting, drainage |
| Chicken | — | 3–4 sq ft/bird inside (+10 outside) | nest box 1 per 4–5 hens (12×12×12), roost 8–10"/bird, pop door 12×14, predator-proof hardware cloth |
| Alpaca / llama | — | 30–40 sq ft/head | 3-sided shelter fine |
| Rabbit / dog kennel `[P2]` | per breed presets | — | |
| Generic / storage | — | — | no validation |
Support-space defaults (research consensus): **aisle 12' minimum, 14' recommended** for horses; **wash bay ~12×12** with drainage and hot water; **tack room 10×10–12×12** (often "the fifth stall" for symmetry); feed room near center/delivery; hay/bedding separated for fire safety with delivery access; sliding doors preferred over swing in aisles because they don't obstruct the passage.
Per-species also carries: bedding type, manure volume/day (drives manure area sizing), water demand, ventilation ACH, lighting lux, fencing type for attached runs, gate widths, and "danger" rules (goats + horses sharing a wall, etc.).
Group tools: **Headcount planner** — enter animals by class, tool proposes pen count/sizes and total sq ft; **Seasonal reconfiguration** — save two interior layouts for the same shell (e.g. winter group pens vs. spring kidding jugs) using divider panels; both are versions of one project.
---
## 23. Layout pattern library `[P0]` — Architect
Generators that produce a complete model from (species, headcount, pattern, options):
1. **Center-aisle** — stalls both sides of a 12–14' aisle, doors at both ends for cross-ventilation; most functional for 4+ horses; larger envelope and more finishes. Options: tack/feed/wash in end bays, hay in a dedicated bay or lean-to.
2. **Shed-row (single-loaded)** — one row of stalls opening outside under an overhang; cheap, great ventilation, long narrow footprint; best for 2–4 horses or mild climates.
3. **Double shed-row / back-to-back** — two rows back to back, each opening outward; runs attach directly.
4. **Side-aisle** — stalls one side, aisle along the other exterior wall with windows/doors — good for narrow sites.
5. **Open loafing / free-stall** — one big bedded area with movable divider panels, feed alley, water between pens (goats/sheep/cattle).
6. **Run-in / three-sided** — open front facing away from prevailing wind; optional dividers; slab apron.
7. **U- or L-shape courtyard** `[P1]` — two wings around a paddock.
8. **Monitor barn** `[P2]` — raised center aisle with clerestory.
9. **Combo** — equipment bays + pens (very common on small farms): equipment half with overhead door, animal half with pens; fire/dust separation wall.
10. **Chicken coop + run** — elevated or slab, nest-box exterior access door, run attached.
Each pattern encodes: adjacency preferences, door placement rules, ventilation orientation rule (center aisle aligned to prevailing wind; otherwise open side to N/E), and expansion direction.
---
## 24. Stall systems, gates & panels catalog `[P0]`
Interior components are real products with real dimensions; the user can pick "site-built" or "system":
- **Site-built stall walls:** 2×6 T&G kick-wall between posts (in grooves of U-channel or nailed to a 2×4 ladder), plywood over studs, with welded-wire or pipe grille above.
- **Stall front systems (prefab):** modular fronts with sliding door, grille top, feed door, in standard 10'/12'/14' widths; corner/rear panels; partition kits. Model as parametric assemblies with vendor-neutral names; store dims and cost.
- **Gates:** tube gates 4/6/8/10/12/14/16', bow gates, walk-through gates, alley gates, panel gates; hinge/latch side; swing arc rendered for collision checks.
- **Livestock panels:** cattle panels (16'×50"), hog panels, sheep/goat panels (4"×4" mesh), combo panels — as pen dividers with a post/T-post schedule.
- **Portable / divider panels:** 8'–12' freestanding panels for seasonal pens (§22 seasonal reconfiguration).
- **Headgate / chute / alley** `[P2]` for cattle.
- **Chicken:** nest boxes, roosts, pop doors, brooder pens.
- **Feeding/water:** corner feeders, wall hay racks, fence-line bunk feeders, automatic waterers (frost-free with heat trace), trough between pens, hydrants.
Each item: footprint, wall-mount vs floor, clearance zone, power/water needs, species compatibility, cost, install note. Placement validation: waterer not in a corner a horse can be trapped in; feeder not under a window; no fixture in the door swing.
---
## 25. Workflow & route analysis `[P1]` — Architect
Barn layout is about the work between stalls. Add a **Routes** layer:
- Define daily routes: feed room → each stall; hay storage → stalls; stalls → manure area / exterior; wash bay ↔ stalls; tack ↔ grooming/cross-ties; delivery truck → hay/feed door; equipment → equipment bay.
- Compute path length, door crossings, and conflicts (wet zone crossing clean zone; wheelbarrow through a 3' door; delivery path crossing horse traffic).
- **Heatmap** of traffic; a "steps per day" score; suggestions ("move feed room one bay closer: saves ~400 ft/day").
- Sightlines: from the tack room/office door can you see every stall?
- Clearances: wheelbarrow (30"), muck cart, ATV, small tractor (set widths), turning radius at aisle ends.
---
## 26. Outside the walls: runs, paddocks, fencing, site `[P1]`
- **Attached runs** per pen (e.g. 12×24 off each stall's Dutch door), with gate to a shared lane; fence type per species (no-climb, board, electric, panels); post spacing per fence type; gate schedule.
- Paddocks/dry lots, lanes to pasture, sacrifice areas, shade/shelter placement.
- Manure storage location with setback rules from wells/water/house; access for spreader/pickup.
- Driveway/turnaround for hay delivery (truck + trailer template), apron at overhead doors.
- Grading: pad 6–12" above surrounding grade, slope away, swale locations, downspout discharge; a simple **cut/fill estimate** from user-entered spot elevations.
- Sun/shadow study by date/time (orientation guidance: open sides/windows for winter sun, overhangs for summer shade); prevailing wind rose from location for ventilation orientation.
- Setbacks and well/septic distance checks (user enters the numbers; tool checks).
- Fence BOM (posts, rails/wire, gates, hardware).
---
## 27. Utilities v2 `[P1]`
- **Electrical:** subpanel size from load calc (stalls × heated buckets/fans + lights + wash bay water heater + overhead doors + welder/compressor in equipment bay); circuits list; dedicated circuit per stall; GFCI in wet areas; lighting layout with fixture spacing for target lux (LED strip/high-bay), exterior lights at doors; conduit runs on plan; underground feed from house with trench length and wire size note; camera and Wi-Fi points.
- **Water:** service line entry, frost-free hydrants (bury depth = frost), auto-waterer supply with heat tape, wash bay hot/cold, hose bibs, water heater location, drain/dry well or trench drain, floor slope zones.
- **Ventilation calc:** natural — eave intake + ridge exhaust area vs. floor area; stall windows/Dutch doors as cross-flow; cupola sizing rule-of-thumb; mechanical — fan CFM from ACH per species and volume.
- **Fire:** hay/bedding separation, extinguisher locations, second exit, lighting guarded in stalls, no exposed wiring in animal reach.
---
## 28. Cost & procurement engine v2 `[P1]`
- Unit-cost table by region preset (editable), with labor vs. material split and a builder-quoted override column.
- Phase packages: (1) Shell (posts, framing, roof, siding, big doors) — what a pole-barn company quotes; (2) Concrete; (3) Interior (stalls, partitions, rooms); (4) MEP; (5) Site/fencing. Each exportable separately — matches how the work is actually bid.
- **Truss quote request form** (auto-filled): span, pitch, heel, overhang, spacing, loads, count, gable trusses, bearing.
- **Metal panel order sheet:** per-plane panel lengths/counts, trim lengths, screws, color.
- **Lumber yard order sheet** (§19.4).
- **Concrete order:** yards by pour (slab, piers/collars), mix/PSI, fiber/rebar, control joint plan.
- Cost sensitivity: sliders for eave height, bay spacing, steel gauge, slab coverage — live cost delta.
- Compare mode: two versions side by side with cost and sq ft deltas.
---
## 29. Expansion, phasing & future-proofing `[P1]`
- "Reserve a bay": empty end bay framed but unfinished; the end wall is designed to be removable (girts, not a braced wall).
- Add bays later: the tool can extend an existing saved building and produce a delta BOM (only new material).
- Phase plan: build shell now, interior later; drawings marked "Phase 1 / Phase 2".
- Loft/hayloft `[P2]`: attic trusses vs. floor system on interior posts; hay drop; stair.
- Future-use flags: "may become barndominium/workshop" → suggests bookshelf girts, taller eave, conduit sleeves.
---
## 30. Feature grab-bag (everything else considered)
**Design & 3D**
- Photo-real render mode (env lighting, PBR steel with rib profile, wood grain, concrete), plus fast "clay" and "framing" modes.
- Sun study slider; night mode with lighting fixtures on.
- Walk mode at eye height + "horse-eye" height (5'); mount a camera in a stall.
- Cut planes saved as named views; "show only this bay".
- Exploded view by layer (roof lifts, siding peels, framing stays).
- Section box (drag a box, everything outside hides).
- X-ray a wall to see framing behind siding.
- Snow load visualization (uniform + drift at lean-to/valley `[P2]`).
- Compare A/B in split viewports synced cameras.
- Photo overlay/backdrop: upload a site photo and rough-align the model `[P3]`.
- AR "view on site" via GLB/USDZ export `[P2]`.
**Plan / drafting**
- Dimension chains auto-generated (overall, post lines, openings), editable; ordinate dims option.
- Door/window tags (D1, W3), pen labels with area, north arrow, scale bar, grid bubbles on post lines (A–F / 1–7 like real plans).
- Print at scale (¼"=1' on 11×17) directly from the browser; PDF plan set with title block and revision cloud on changes since last version.
- Framing elevations per wall with every girt/post labeled and dimensioned; post-hole plan; truss layout plan; purlin layout.
- Detail library: post base (embedded / bracket), skirt board & rat guard, eave, ridge, gable rake, overhead door jamb, sliding door track & header, window in girt wall, stall wall to post, slab edge, control joint.
- DXF/DWG export of plan and elevations for an architect or engineer `[P2]`; IFC `[P3]`.
**Collaboration**
- Share link roles: view / comment / edit-copy ("fork").
- Builder markup: pin comments, draw on plan, propose a change → owner accepts as a new version.
- Version diff viewer (3D highlight of what changed).
- Export a "bid package" zip: PDF set + BOM CSV + renders + JSON.
- QR code on the printed plans linking to the live 3D.
- Email a version to the builder from the app (Gmail connector available).
- Project checklist / permit checklist by jurisdiction (user-maintained template) `[P2]`.
**Validation & advice**
- Explain-my-warnings summary in plain English, grouped by severity.
- Design score (function, ventilation, safety, cost efficiency, expandability) with reasons.
- "What a builder will ask you" pre-flight list generated from gaps in the model.
- Code references panel: which prescriptive tables were used; where "engineer required" fires.
- Material efficiency report: % waste, sheet/panel cuts, suggestions to hit modules.
**Data & platform**
- Templates marketplace (user-published layouts) `[P3]`.
- Import: sketch photo → rough plan `[P3]`; CSV of animals; a competitor's configurator screenshot as reference image.
- Units toggle; feet-inches parsing everywhere ("12'6", "150in", "3.8m").
- Project duplication, archive, tags; thumbnail auto-render.
- Audit log per project.
---
## 31. Data model & rules deltas (v2)
Add to `BuildingModel`:
```ts
frame: {
  system: 'postFrame' | 'stickFrame' | 'hybrid';
  bayFt: 8 | 10 | 12 | number;
  post: { size: '4x6'|'6x6'|'6x8'|'3ply2x6'|'3ply2x8'; foundation: 'embedded'|'bracketPier'|'permaColumn'; embedIn?: number; holeDiaIn?: number; padDiaIn?: number };
  girts: { size: '2x4'|'2x6'; spacingIn: number; mount: 'face'|'bookshelf' };
  skirt: { size: '2x6'|'2x8'; rows: 1|2 };
  carrier: { plies: number; size: '2x8'|'2x10'|'2x12' };
  trusses: { spacingIn: 24|48|96|120; heelIn: number; type: 'common'|'scissor'|'gambrel'|'mono'|'attic' };
  purlins: { size: '2x4'|'2x6'; spacingIn: number; orientation: 'edge'|'flat'|'inset' };
  species: 'SPF'|'SYP'|'DF'; treatment: {...};
}
lumberDefaults: { ... };              // §19.4
runs: Run[]; fences: Fence[]; paddocks: Paddock[]; siteFeatures: SiteFeature[];   // §26
routes: Route[];                       // §25
phases: Phase[];                       // §29
layoutPattern?: { id: string; params: Record<string, unknown> };   // §23 provenance
stallSystems: StallSystem[];           // §24
```
Derived: `PostSchedule`, `GirtLayout`, `PanelSchedule`, `TrussSpec`, `RouteReport`, `LoadCalc`, `VentilationReport`.
New rule folders: `/rules/framing/postFrame/*`, `/rules/materials/lumber.ts` (nominal↔actual table, stock lengths, treatment), `/rules/materials/steelPanels.ts`, `/rules/animals/<species>.ts`, `/rules/layout/patterns/*`, `/rules/site/*`, `/rules/mep/*`, `/rules/routes/*`.
Prisma additions: `Project.siteJson`, `ProjectVersion.model` already covers it; add `PriceBook` (per user/region) and `Catalog` (stall systems, gates, panels — seedable JSON).
---
## 32. Roadmap deltas (v2)
- **M1** now includes post-frame posts/girts/skirt/carrier as visible geometry (not just skins) and the right-click menu framework.
- **M2** (framing engine) acceptance = the reference render (§16.1) reproduced from parameters; post schedule + panel schedule exported.
- **M3** (interior) now includes the interior-drives-exterior proposal engine (§18), layout pattern generators (§23), horse/goat/sheep/chicken presets (§22), site-built stall walls and gates (§24).
- **M4** adds lumber yard / metal / truss / concrete order sheets (§28).
- **New M5.5 — Farm layer:** runs, paddocks, fencing, routes heatmap, seasonal reconfiguration.
- **M6** absorbs utilities v2 and cost engine v2.
---
## 33. Open questions added in v2
8. Bay spacing your builder prefers (8' vs 10' vs 12')? Determines whether 12×12 stalls map 1:1 to bays.
9. Embedded posts or brackets on piers (the render) — which does your builder do?
10. Which animals and headcount now, and what might change in 2–3 years (drives the seasonal/expansion features)?
11. Are you planning attached runs/paddocks off the barn?
12. Steel or wood siding? (Steel is assumed.)
---
## Appendix C — Research sources (v2)
Configurators reviewed: Morton Buildings 3D Studio; Lester MyLester Design®; Wick DESIGN 3D™; FBi Buildings Design-Your-Own; Buildings by Timberline; Sherman Pole Buildings; Pioneer Pole Buildings (On The Z); WebShed; DIY Pole Barns; I Love Pole Buildings.
Post-frame construction: NFBA Post-Frame Building Design Manual (terminology, girt/purlin types, bracing, foundations); NFBA Accepted Practices — Framing Tolerances; Sutherlands Post Frame Building Basics (embedment ≥ ¼ length / 4' min, 18–24" footing pads, skirt board, girts ≤ 2' OC, truss carriers, truss spacing 4–10').
Horse barn layout: Lester Buildings, Wick Buildings, Fisher Barns, Armour Horse Stalls, Sterling Equine, Steel Structures America, Locke Buildings, Haynet, DB Stable (stall 12×12 min / 14×14 preferred, foaling 14×16, aisle 12' min / 14' rec., wash 12×12, tack 10×10–12×12, sliding doors in aisles, ridge/eave ventilation, hay separation).
Small ruminants & others: NMSU Housing for Dairy Goats (10–15 sq ft bedded + 25 exercise; kidding 4×5); OSU Sheep Team (12–16 sq ft/ewe, 15–20 with lambs); UMass Sheep Housing (rams 20–30 sq ft; feeder 9–20"); UKY AEN-148 goat spacing research; Outbuilders goat barn guide (kidding 16 sq ft, feeder 16–20"); Grazing with Leslie (15–20 sq ft does, 25+ with kids); VersaTube (cattle 14–20 sq ft, ×3 overnight; goats 20–30 sq ft).
All numbers are defaults to be confirmed by the Animal advisor agent against primary extension sources and cited in each rule.
