# Barn Designer — Claude Code Handoff Spec
> A construction-ready, fully interactive 3D barn/shed design tool. Design the inside (pens, stalls, aisles) or the outside (footprint, roof, doors, windows) — the other side updates live. Output is accurate enough to hand to a builder: framing layouts, truss spacing, materials list, plan sheets, and a shareable link.

**Owner:** Collin
**Stack target:** Next.js (App Router) · TypeScript · React Three Fiber · PostgreSQL · Prisma · Clerk · Railway
**Status:** Greenfield. This document is the source of truth for Phase 0–3.

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
