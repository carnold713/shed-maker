# Runs, paddocks and fencing off a small livestock barn — research and implementation notes

**Agent:** Site & fencing (`agents/site.md`) · **For:** SPEC §6.4, §26, §31 (`runs`, `fences`, `paddocks`), the A1 site plan · **Milestone:** M5.5 "Farm layer" · **Date:** 2026-09-08
**Scope:** outdoor runs and dry lots attached to (or next to) the barn, the fence around them, the posts, gates and the takeoff. Pasture, rotational grazing, manure storage and grading are named only where a number is needed for a rule. Species keys follow `Species` in `lib/model/schema.ts` (`horse`, `pony`, `goat`, `sheep`, `cattle`, `pig`, `chicken`, `alpaca`, `dog`, `generic`; `rabbit` is out of scope — hutch animals do not get a run).

> **Everything here is advisory.** Fencing is not permitted or inspected in most Ohio townships, but it is the single biggest cause of livestock injury and escape. Every finding and sheet note carries: *"Advisory only — verify against the extension guidance for your species and your local fence law (Ohio ORC 971 partition fences)."*

## 0. How this was researched, and what was not verified

- `WebSearch` worked. `WebFetch` was egress-blocked for extension.iastate.edu, horses.extension.org, extension.psu.edu, extension.umn.edu and the MWPS store, so every extension figure below was confirmed from search summaries of those pages rather than the primary text. MWPS-60 *Horse Facilities Handbook* and NRCS Conservation Practice Standard 382 (Fence) were not opened at all.
- Anything marked **(from knowledge — verify)** was not confirmed online this session and must be checked against the cited publication before the number ships in a rule or a preset.
- Prices in §9 are placeholders in the Builder's price-book format; the Iowa State *Estimated Costs for Livestock Fencing* (FM 1855, revised Dec 2024) is the reference to reconcile them against when it can be opened.

## 1. Space per head

Three different numbers, never to be confused on the sheet: the **attached run** (a paved or stoned pen straight off the stall's outside door), the **dry lot / sacrifice area** (a larger stoned or dirt lot, no grass expected) and **pasture** (grass, acres). The tool sizes runs and dry lots; pasture acreage is a note only.

| Species | Attached run off a pen (min → recommended) | Dry lot per head (min → recommended) | Pasture per head (note only) | Source |
|---|---|---|---|---|
| `horse` | 12 × 24 ft (288 sq ft) minimum, 12 × 36 recommended; width = stall width | 400–500 sq ft min, 600–1,000 sq ft recommended; grows proportionally with head count | 1½–2 acres for the first horse, +1 acre each additional on managed pasture | Extension Horses *Drylots for Horses*; UMN *Horse dry lots and shelters*; Penn State *All-Weather Paddocks*; Extension Horses *How much land* |
| `pony` (pony / mini) | 10 × 20 ft min, 12 × 24 recommended | 300 sq ft min, 400–600 recommended **(from knowledge — verify;** scaled ⅔ of horse) | 1 acre + 1 per additional pony | Vet Help Direct summary; horse figures scaled |
| `goat` | 8 × 12 ft per 2–3 head min (≥ 25 sq ft/head outside), 12 × 16 recommended | 25 sq ft/head min (dairy goats), 50 sq ft/head recommended; 200–250 sq ft/head where the lot is the only exercise | 4–6 goats per acre; ½ acre per goat where grazed | NMSU D-703 *Housing and Working Facilities for Dairy Goats*; UMass CAFE goat housing; OSU meat-goat ch. 12 |
| `sheep` | 8 × 12 ft per 2–3 head min, 12 × 16 recommended | 25–40 sq ft/ewe or ram, 30–50 sq ft/ewe with lambs | 2–3 (poor) to 6 (good) sheep per acre | OSU Small Ruminant *Sheep Housing and Facilities Requirements*; sheep101 |
| `cattle` | 12 × 24 ft per head min (unpaved), 12 × 36 recommended | 250–350 sq ft/finishing head (K-State), 300–400 general, 500–800 sq ft/cow-calf pair | 1 acre per cow, 1½–2 acres per cow-calf pair | Penn State *Beef Cattle Spacing Requirements*; K-State MF3392; Beef Magazine dry-lot summary (UNL) |
| `pig` | 8 × 12 ft per 2 head min (≥ 25 sq ft/head paved) **(from knowledge — verify)**, 12 × 16 recommended | 100 sq ft/pig on sandy ground, 200–250 on clay (UF); 400 sq ft/pig pasture minimum (UArk); 450–875 sq ft/feeder in small lots | 10–30 feeders or 2–8 sows/acre by forage; 3,000–6,000 lb of pig per acre | Penn State *Raising Small Groups of Pigs*; SARE *Raising Pigs on Pasture* |
| `chicken` | 10 sq ft/bird min (8 × 12 for 10 birds), 15 sq ft/bird recommended; covered | same as run — birds do not get a separate lot | 50–100 birds/acre rotational **(from knowledge — verify)** | multiple backyard-poultry guides; extension figure of 8–10 sq ft/bird is consistent |
| `alpaca` | 12 × 24 ft per 2–3 head min (herd animals — never one), 16 × 24 recommended | 100 sq ft/head min, 200 recommended **(from knowledge — verify)** | 4–7 alpacas per acre on managed pasture | Alpaca Owners Association Academy *Pasture Planning*; UMass *Alpaca Housing*; Alpacas of Montana |
| `dog` | 4 × 8 ft small/medium, 5 × 10 large, 6 × 12 XL per dog | — | — | kennel suppliers (SimpleWag, SWi); USDA AWR 3.6 formula (length + 6″)² per dog **(from knowledge — verify)** |
| `generic` | 12 × 24 ft | 400 sq ft/head | 1 acre/head | horse figures reused |

Rules use the **minimum** column (`warn` below it) and the **recommended** column (`info` below it). Multi-head pens multiply the per-head figure, except horses, where the attached run is per stall regardless of head count (two horses in one run gets the dry-lot number instead).

## 2. Fence type, height and hazards per species

| Species | Preferred fence kinds | Height | Rails / strands / mesh | Do **not** use | Notes | Source |
|---|---|---|---|---|---|---|
| `horse` | `noClimb` 2×4 woven wire with top board; `board` 3–4 rail; `hiTensile` electric 4–5 strand with a visible top rail/tape; `pipe` | 54–60″; 60″ perimeter, 54″ dividing (UMN) | 4 boards on 16′ (1×6 or 2×6); 2″ × 4″ mesh; 3 wires at 20/30/40″ (mature), 4 at 16/26/36/46″ (young), 5 to 52″ perimeter | `barbed`, `hogPanel`/`cattlePanel` (6″ × 8″ openings trap hooves), field fence 6″ × 12″, `chainLink` (hoof catch), uncapped T-posts | Wire needs a top board for visibility and to stop sag; bottom wire ≤ 8″ off grade or ≥ 12″; no sharp edges | UMN *Horse fencing considerations*; Bekaert equine; Kencove no-climb; Extension Horses |
| `pony` | as horse; mesh preferred over rail (minis go under rails) | 48–54″; ≥ 42″ never | bottom rail/wire ≤ 6″ | as horse | Minis fit through 12″ rail gaps **(from knowledge — verify)** | UMN scaled |
| `goat` | `wovenWire` 4×4 sheep-and-goat mesh; `goatPanel` 4″ × 4″ 48″ × 16′; `hiTensile` electric 5–6 strand; `noClimb` 2×4 | 48″; 60″ for bucks / climbers | 4″ × 4″ mesh (heads and horns stay out); 5 wires 6″ → 40″ or 6 wires 6″ → 42″; electric offset wire at 8–10″ inside woven wire | 6″ × 6″ or 6″ × 12″ field fence (horns trap), `board` alone (they climb), `chainLink` without offset wire | Goats stand on fence — offset hot wire at 10″ and knee height; they open gravity latches | Bomann / Red Brand sheep-goat spec (48″, 4×4); OSU meat-goat ch. 12; Zareba/FenceFast strand chart |
| `sheep` | `wovenWire` 4×4 or 6″ × 6″; `hiTensile` 4–5 strand electric; electric netting temporary | 42–48″ | 4 wires at 8/16/24/32″; 12–16′ post spacing on woven wire | `barbed` (wool catches), wide-mesh with horned breeds | Predator side matters more than containment — coyote-proof bottom (mesh to grade, hot wire at 6″) | OSU Small Ruminant; Zareba chart; Premier 1 |
| `cattle` | `hiTensile` 5 strand (2–3 hot); `wovenWire` 47″ field fence + 1 barbed/hot top; `cattlePanel` 50″ × 16′; `pipe` in working areas | 48–54″ (top at shoulder); 60″ for bulls | 5 wires 12.5 ga; 3 wires at 20/30/40″ for mature; 4 at 16/26/36/46″ young | `barbed` only where no horses share the line; `chainLink` | Corner posts 6–7″ dia.; 12′–20′ line spacing high tensile, 8′–12′ woven | Iowa State FM 1855; Kencove high-tensile; American Family / cattlefencewire summaries; USDA-NRCS ME high-tensile manual |
| `pig` | `hogPanel` 34″ × 16′ (4 ga) or 50″ cattle panel on 4×4 posts; `wovenWire` with a hot wire at 6–8″ inside; `hiTensile` 3 strand electric | 34″ panel min (feeders), 40–48″ sows/boars | 3 wires at 6/14/24″ (Zareba) or 6/14/22″; post every 4–6′ on panels in soft ground, 8′ typical | `board` alone (rooting), `chainLink`, netting | Pigs root under — bury the bottom 6″ or run a hot wire at snout height; panels clipped with 3–4 ties per lap | Tractor Supply / The Mill panel specs; Premier 1 hogs; livestockfencinghub |
| `chicken` | `hardwareCloth` ½″ (bottom 24–36″) over `weldedWire` 1″ × 1″ or 2″ × 4″; `chainLink` with ½″ liner; electric `poultryNet` 42–48″ temporary | 72″ walk-in preferred (covered run); 48″ min uncovered → birds fly it | ½″ mesh bottom 3′; 18–24″ buried or laid **apron** of hardware cloth; overhead netting or roof | `chickenWire` (poultry netting) as the only barrier — raccoons pull it apart; anything with ≥ 1″ gaps at the base | Predator proofing is the whole spec: apron, ½″ mesh, latched two-step gate, covered top | Hobby Farms *Run Defense*; Tractor Supply coop fencing; Garden Betty; Fresh Eggs Daily |
| `alpaca` (and llama) | `noClimb` 2×4 woven wire 60″; `hiTensile` 5–7 strand (non-electric, closer at bottom); `board` with mesh | 60″ (llama 60″, alpaca 48–60″) | 2″ × 4″ mesh; bottom wire/board ≤ 4″ off grade; hot wire or apron for dogs/coyotes | `barbed`, `hogPanel`, electric as sole containment (fleece insulates them) | Fence is to keep predators **out**; herd of ≥ 2; keep intact males on a separate line with a 5′ buffer or double fence | Alpaca Owners Association Academy *Fencing*; Kentucky Alpaca Assoc.; Zareba llamas/alpacas |
| `dog` | `chainLink` 11 ga (9 ga > 80 lb dogs) on 1⅜″/1⅝″ frame; welded-wire kennel panels | 72″; 96″ or roofed for climbers | 2″ chain-link mesh; dig guard 12–18″ apron or concrete/paver floor | `hogPanel`, `wovenWire` (chewers), electric | Roof or wire top for climbers; pad sloped 1–2% to a drain | SimpleWag; SWi Fence; Backyard Pet Supplies; USDA AWR 3.6 |
| `generic` | `wovenWire` 47–48″ + top wire | 48″ | — | `barbed` | — | Iowa State FM 1855 |

**Hazards checked by rules (§8):** barbed wire with horses, ponies, alpacas or sheep; hog/cattle panels or 6″ × 12″ field fence with horses; chain link with horses or pigs; chicken wire as the only chicken barrier; electric-only for alpacas; uncapped steel T-posts anywhere an animal can fall on them (cap or use wood on horse lines — UMN); a goat run fenced with boards only.

**Two species sharing a fence line** — goats or sheep with horses across one fence get the more restrictive spec on both faces (4×4 mesh at 54″ + top board). SPEC §22 already flags goats and horses sharing a wall.

## 3. Posts, bracing and depth

| Item | Line posts | Corner / end / brace posts | Gate posts | Source |
|---|---|---|---|---|
| Wood, treated | 4×4 (light: run-in, poultry, pony) or 4–5″ round CCA/UC4B, 8′ long | 6″ round or 6×6, 8′; H-brace 8′ apart with a 4″ horizontal and diagonal brace wire twisted tight | 6″ round or 6×6 for gates ≤ 12′; 8″ round / 8×8 or steel pipe for 14–16′ gates | Iowa State FM 1855 (materials lists); SPEC §19.4 lumber table (4×4 "light posts (run-in, fencing)") |
| Steel | 1.33 lb/ft T-post (6′–7′), **capped** | never a T-post | never a T-post | UMN; Kencove |
| Pipe | 2⅜″ line; 2⅞″–4″ terminal (chain link: 1⅝″/1⅞″ line, 2⅜″ terminal residential) | 2⅞″ | 4″ (one size up from line) | chain-link post guides (Hoover, NMI, Fence-All) |
| Spacing | 8′ board fence (16′ boards land on every second post); 8′–12′ woven / no-climb (8′ high-pressure, 12′ typical for 13-48-3 field fence); 12′–20′ high tensile (30′ possible on flat ground with droppers); 4′–8′ panels (16′ panel = 3 posts at 8′, or every 4–6′ in soft ground for pigs); 6′–10′ chain link (10′ max; 6′ on kennel panels **(from knowledge — verify)**) | H-brace span 8′; double-H for pulls > 660′ **(from knowledge — verify)** | — | Bekaert; ProFence; Kencove; Iowa State; chain-link guides |
| Depth | ⅓ of post length and ≥ 30–36″ (8′ post → 32″ + 6″ gravel); below frost; 24–27″ for chain-link line posts | 36–48″; brace posts 4′ into the ground per the cattle guides | 6–8″ deeper than line posts, always concrete, ≥ 12″ hole; 42–48″ under a 12′+ gate | Sereno / NMI / BuildToolHQ one-third rule summaries; American Family cattle brace; Fence-All |
| Frost | Ohio (Cuyahoga) frost 32–36″ → line posts 36″, gate and corner posts 42–48″ **(from knowledge — verify with `site.frostDepthIn`)** | | | `model.site.frostDepthIn` (SPEC §6.4) |

Corner rule: every direction change > 15° and every end of a tensioned run (woven wire, high tensile) gets a **brace assembly** (H-brace, or a diagonal-brace corner). Board and panel fences need a plain heavier post, not a brace. Chain link needs a terminal post with a tension bar at every corner, end and gate.

## 4. Gates

| Use | Clear width | Leaf | Placement | Source |
|---|---|---|---|---|
| Walk gate (person + wheelbarrow) | 4′ (3′ minimum for poultry/dog) | one, swing | at the lane, near the pen's outside door | Horse Journals / Stable Management fence planning; SPEC §25 (wheelbarrow 30″) |
| Handling / stock gate | 6′–8′ | one | between adjacent runs (sorting), and run → lane | Stable Management |
| Drive gate (tractor, spreader, skid steer) | 12′ standard; 14′ where an implement is wider than the tractor | one 12′ or two 6′ | on the lane side, aligned with the drive | metalfencetech gate sizes; Horse Journals ("at least one gate in each field 12–16′") |
| Hay / delivery gate | 16′ (or two 8′ leaves — less post load than one 16′) | two | at the lane entry from the drive; never through a pen | haytalk / yesterdaystractors summaries |

Rules of placement the tool enforces:
- **Aligned with the outside door.** A pen with `outsideAccess` gets a run whose fence returns to the wall either side of that Dutch door; the run's gate sits on the far (lane) side, on the same axis as the door where the lane allows it, so a horse walks door → run → gate → lane in a straight line.
- **Gates swing into the run** (pushed open against the animal, closed by pulling toward you from the lane). A gate that swings into a lane blocks the lane. Exception: chicken and dog gates swing **out** so a bird or dog cannot push it open.
- **Both faces reachable.** A gate is never placed in a fence that has no lane or yard on the other side (a gate into the neighbour's run is a "sorting gate" and needs its own flag).
- **Latches per species:** horses — two-way slam latch or chain with snap, kick-through-proof; goats — a latch a thumb cannot flip (spring-loaded slide with clip, or a carabiner) because goats open gravity, kiwi and lever latches **(from knowledge, universal among goat keepers — verify a citation)**; cattle — chain and hook or slam latch; pigs — bolt and pin; chickens and dogs — two-step latch (raccoons work single latches); alpacas — any, they do not test latches.
- **Hardware:** 2 hinges per leaf ≤ 12′, 3 for 14–16′; a 12′ tube gate weighs ~90 lb — the gate post is the loaded member, hence §3.

## 5. Layout rules

1. **Side of the barn.** Runs on the leeward side for the prevailing winter wind (NW in Ohio → runs on the S/E sides) and on the sunny side so they dry; runs against the north wall stay muddy (Penn State all-weather paddock note on drainage; UMN dry lots). The tool reads `site.orientationDeg` and a default NW prevailing-wind bearing until SPEC §26's wind rose lands.
2. **Drainage away from the barn.** Run surface slopes 2% (¼″/ft) away from the wall, never toward it; runs need 6–12″ of the pad's height advantage (SPEC §26 "pad 6–12″ above surrounding grade"). Downspouts on the run side discharge past the fence line, not into the run.
3. **Surface.** Attached runs: 4–6″ compacted stone over geotextile with a 2–3″ screenings cap (Penn State all-weather paddock recipe); a paved apron 8–12′ out from the door is the high-traffic zone. Dry lots: stone at gates, waterers and feeders at minimum.
4. **Lane between runs** 12–16′ for equipment and handling (Horse Journals; MWPS-60 **(from knowledge — verify)**); 8′ minimum for a hand-only lane. Runs are laid out in a row along the wall with one shared lane across their far ends, all gates opening onto it.
5. **Shared fence lines.** Adjacent runs share one fence (counted once in the takeoff). Horses next to horses across a shared line: fine with mesh; two dominant horses or stallions get a 5–10′ double fence or a lane instead (Stable Management *Perfect Paddock*).
6. **No dead-end corners for horses** in a run holding ≥ 2 horses: cut the far corners at 45° (a single 6–8′ panel) or round them (Horse Journals; My Horse University). Single-horse attached runs may stay rectangular. Note that a cut corner in a tensioned fence needs a leaning brace post.
7. **Water and shade** in every run: a hydrant or waterer reachable from the lane (frost-free, ADR-0016 plumbing lane) and shade — the barn eave, a 10′ overhang on the run side, or a tree. A 12 × 24 attached run gets its shade from the barn wall on the N side and its own roof extension on the S side.
8. **Gate to the pen's outside door** — every attached run has (a) the Dutch door in the barn wall and (b) at least one fence gate; a run with only the door is a dead-end trap for handlers (§8 `site.run.noGate`).
9. **Manure and feed access.** The lane connects to the drive and to the manure pad without crossing a run.
10. **Setbacks.** Runs and fences stay inside `site.boundary` less `site.setbacksFt`; Ohio partition-fence law (ORC 971) matters only on a boundary line — a note, not a rule, until the neighbour side is modelled.

## 6. Takeoff formulas (`lib/site/fencing.ts`)

Inputs: each run's rectangle (plan feet), which edge(s) coincide with the barn wall or a lean-to, which edges are shared with another run, the fence kind and height, the gates on each edge.

```
perimeterFt        = 2 (w + d)
wallFt             = Σ length of edges that lie on the barn / lean-to wall (no fence there)
sharedFt           = Σ length of edges shared with an adjacent run (fence counted once — charge it to the run with the lower id)
gateFt             = Σ gate clear widths on this run's own edges
fenceFt            = perimeterFt − wallFt − sharedFt(other run's share) − gateFt
cornerPosts        = number of fence direction changes (a rect run off a wall = 2 free corners + 2 wall returns)
gatePosts          = 2 per gate (a gate at a corner reuses the corner post: 1)
linePosts          = Σ over straight segments of max(0, ceil(segmentFt / spacingFt) − 1)
braceAssemblies    = tensioned kinds (wovenWire, noClimb, hiTensile): every corner, end, and gate post; else 0
totalPosts         = linePosts + cornerPosts + gatePosts (+ 1 extra per H-brace for the brace post)
```

Per-kind materials:

| Kind | Material line | Formula | Notes |
|---|---|---|---|
| `wovenWire`, `noClimb`, `goatPanel`-mesh | rolls | `ceil(fenceFt × 1.05 / rollFt)`; rollFt = 330 (no-climb, sheep-goat, field fence; 100′ rolls for short runs), 100 (welded wire, hardware cloth), 50 (hardware cloth ½″ in 36″/48″) | 5% waste and splices; top board on horse lines = one `board` rail |
| `board` | boards | `rails × ceil(fenceFt / 16)` boards per rail (16′ boards on 8′ posts, 2 bays per board); nails/screws 4 per board end | 1×6 or 2×6 rough-sawn; 4 rails = 4 boards per 16′ section |
| `hiTensile` | wire | `strands × fenceFt × 1.03` lf of 12.5 ga; 4,000′ coils → `ceil(strandFt / 4000)` | strands per species from §2 (3–7) |
| `hiTensile` (any electric) | insulators | `strands × (linePosts + cornerPosts + gatePosts)` line insulators; `strands × 2` end strainers per tensioned segment; 1 tensioner per strand per pull; gate handles `strands_hot × gates` | plus energizer sized ≥ 1 J per mile of multi-strand **(from knowledge — verify)**, ground rods 3 × 6′ |
| `hogPanel`, `cattlePanel`, `goatPanel` | panels | `ceil(fenceFt / 16)` panels, 34″ / 50″ / 48″ high; clips 3–4 per lap + 3 per post | 16′ × 4 ga; T-post or wood post every 8′ (4–6′ pigs) |
| `chainLink` | fabric + framework | `ceil(fenceFt / 50)` rolls of 50′; top rail `fenceFt` lf; tension bars 1 per terminal-post side; tie wires 1 per ft of rail + 1 per ft of post | 6′ or 8′ high (dog), 9/11 ga; 10′ line spacing |
| `hardwareCloth` / `weldedWire` (chicken) | rolls | wall rolls as woven; apron `ceil(fenceFt × 2 ft / rollArea)` for a 24″ apron; overhead netting `w × d` sq ft | apron laid flat and pinned, or buried 12″ |
| `poultryNet` (electric netting) | net | `ceil(fenceFt / 164)` nets of 164′ × 42″/48″ | temporary; no posts to count |
| Gates | each | per §4, by clear width and kind; 2 hinges (3 for ≥ 14′), 1 latch, 1 gate post pair | tube gates 4/6/8/10/12/14/16′ |
| Concrete | bags | `(cornerPosts + gatePosts + bracePosts) × 2` bags of 80 lb; line posts tamped, no concrete (drains better, easier to replace) | SPEC §7.8 concrete category |

## 7. Adjacent-run and door-alignment geometry (`lib/geometry/site.ts`)

- A run is a rect in plan feet, allowed **outside** the footprint (negative x/y or beyond `wFt`/`dFt` per ADR-0005 — the footprint origin stays at the SW corner). An attached run must have one full edge on an exterior wall or a lean-to's outer edge (`rectsShareEdge`, `lib/model/zones.ts`) and that edge must contain the pen's exterior opening.
- Overlap: `rectsOverlap` against the footprint, every lean-to polygon, every other run, and the drive polygon when it exists — any overlap is an `error`; two runs touching along an edge is the shared-line case.
- The fence geometry emitted is the same `BoxMember` stream the 3D scene and plan reader consume (kinds `fencePost`, `fenceRail`, `fenceMesh`, `gateLeaf` — new `BoxKind` entries for the 3D engineer), posts as 4×4 / 5″ boxes at `heightFt + depthFt` with the bottom at `−depthFt`, mesh as a thin box with a wire-grid texture, gates as a leaf box with a swing arc in plan. Runs also emit a `gravel` footprint (existing kind) at −4″ so the surface reads on the site plan.

## 8. Rules table (`rules/site/*`)

Severity: `error` only for geometry that cannot be built (overlap) or an animal-safety fence; `warn` for below-minimum area/height and a missing gate; `info` for below-recommended. Every message ends "— verify with your extension office / fence contractor" (shared helper). `RuleSource`: `Species:<org>` is used below; `MWPS:60` where MWPS-60 is the primary; an `NRCS:382` form for the fence practice standard would need to be added to `RuleSource` by the Lead (§10).

| Id | Severity | Condition | Message (short form) | Citation |
|---|---|---|---|---|
| `site.run.areaMinimum` | warn | `run area < min per head × headCount` (§1 min column; horse = per run) | "Run {name} is {sqft} sq ft for {n} {species}; minimum {min}." | `Species:extension-equine` (Extension Horses drylots), `Species:nmsu-goat` (D-703), `Species:osu-sheep`, `Species:psu-beef`, `Species:aoa` |
| `site.run.areaRecommended` | info | area ≥ min but < recommended | "Run {name} meets the minimum; {rec} sq ft per head is recommended." | same |
| `site.run.attachedWidth` | info | attached horse run narrower than its stall's door wall or < 12′ | "Run {name} is {w}′ wide; match the 12′ stall so the door is centred." | `MWPS:60` **(from knowledge — verify)** |
| `site.fence.height` | warn | `fence.heightFt < min height for species` (§2); info when between min and preferred | "{species} fence at {h}″ — {min}″ minimum, {pref}″ preferred." | `Species:umn-equine` (UMN fencing), `Species:extension-goat`, `Species:aoa`, `Industry` (dog, chicken) |
| `site.fence.hazard` | error | fence kind in the species' "do not use" list (§2): barbed + horse/pony/alpaca/sheep; hogPanel/cattlePanel/fieldFence + horse; chainLink + horse/pig; chickenWire alone + chicken; electric-only + alpaca | "{kind} is unsafe for {species}: {reason}." | `Species:umn-equine`; `Species:aoa`; `Industry` |
| `site.fence.tpostCaps` | warn | steel T-posts on a horse, pony or alpaca line without `capped: true` | "Cap the T-posts on run {name} or use wood." | `Species:umn-equine` |
| `site.fence.goatOffset` | info | goat run with woven wire or chain link and no `electricOffset` | "Goats stand on mesh — add a hot offset wire at 10″ and knee height." | `Species:osu-goat` |
| `site.fence.predator` | warn | chicken run without apron or overhead cover; alpaca/sheep run without a to-grade bottom (bottom gap > 4″) or hot wire | "Run {name} is open to predators: {missing}." | `Species:aoa`; `Industry` (poultry extension) |
| `site.fence.sharedSpecies` | warn | two runs sharing a line with different species where either species' hazard list includes the other's fence kind, or goats/sheep next to horses without 4×4 mesh | "Runs {a} and {b} share a fence; use {spec} on both faces." | `Species:extension-goat`; SPEC §22 |
| `site.run.noGate` | warn | run with `gates.length === 0` (door only) | "Run {name} has no gate to the lane — handlers and manure have no way out but the stall." | `MWPS:60`; `Industry` |
| `site.run.doorNotTouching` | warn | run for a pen with `outsideAccess` whose wall edge does not contain that pen's exterior opening, or a run with no wall edge at all attached to a pen | "Run {name} does not reach the outside door of {pen}." | `Industry` (SPEC §18.2 "run stub") |
| `site.run.gateAlignment` | info | a gate exists but its centre is > 6′ off the outside door's axis while the lane side is free | "Line the gate up with the Dutch door so the path is straight." | `MWPS:60` **(from knowledge — verify)** |
| `site.run.overlap` | error | run rect overlaps the footprint, a lean-to, another run or the driveway | "Run {name} overlaps {other}." | `Industry` (geometry) |
| `site.run.outsideBoundary` | warn | run or fence crosses `site.boundary` less `setbacksFt` | "Run {name} crosses the setback line." | `User` (user-entered boundary) |
| `site.gate.equipmentWidth` | warn | a run flagged `equipmentAccess` (default true for cattle, horse dry lots > 1,000 sq ft, any run > 2,000 sq ft) whose widest gate < 12′; info when < 14′ with a spreader/skid steer noted | "Run {name} needs a 12′ gate for a tractor or spreader; widest is {w}′." | `Industry` (Horse Journals 12–16′; gate-size charts) |
| `site.gate.swing` | info | gate `swing: "out"` into the lane for hoofed species, or `swing: "in"` for chicken/dog | "Gate {tag} swings into the lane; hang it to swing into the run." | `Industry` |
| `site.gate.latch` | info | goat run with `latch` of `gravity`/`lever`/`kiwi`; chicken or dog run without a two-step latch | "Goats open {latch} latches — use a spring slide with a clip." | `Industry` |
| `site.run.deadEndCorner` | info | horse run with `headCount ≥ 2` and all four corners square | "Cut or round the far corners so a horse can't be trapped." | `Species:extension-equine` (Horse Journals / My Horse University) |
| `site.run.drainage` | info | run on the uphill side of the pad (`slopePct < 2` away) or on the N side of the barn (by `orientationDeg`) | "Run {name} is on the wet/shaded side; slope it 2% away from the wall." | `Species:psu-equine` (All-weather paddocks) |
| `site.run.waterShade` | info | run with no waterer/hydrant fixture and no shade (no wall on its N side, no overhang, no `shade` feature) | "Run {name} has no water / no shade." | `Species:umn-equine` |
| `site.lane.width` | info | lane between runs < 12′ when any run is `equipmentAccess`; warn < 8′ | "Lane is {w}′; 12–16′ lets a tractor and spreader through." | `Industry` (Horse Journals) |
| `site.post.depth` | info | `depthIn < max(36, frostDepthIn, postLengthFt × 4)` for line posts, or gate posts not ≥ 6″ deeper | "Set posts {d}″ deep (⅓ of length, below frost {f}″)." | `Industry` (one-third rule; `site.frostDepthIn`) |
| `site.post.spacing` | warn | spacing > max for kind (§3): board 8′, woven 12′, high tensile 20′, panels 8′ (6′ pig), chain link 10′ | "{kind} posts at {s}′ — keep to {max}′." | `Industry` (Iowa State FM 1855) |
| `site.fence.braceMissing` | warn | tensioned kind with `braces: false` at any corner/end/gate | "Woven and high-tensile fence needs an H-brace at every corner, end and gate." | `Industry` (Kencove / NRCS 382) |

## 9. Cost placeholders (`rules/materials/prices.ts` format, new category `fencing`, `source: "placeholder"`)

Big-box / farm-store list prices, 2025–2026, rounded; to be reconciled against Iowa State FM 1855 (Dec 2024) when it can be fetched. **Placeholders, user-editable per project via `model.priceOverrides`, never quotes.** Labor (Iowa State values it at $20/h with ~2.5–3.5 h per 100′ of woven wire **(from knowledge — verify)**) is a separate "ask your fence contractor" line. Add `fencing: "Runs & fencing"` to `PRICE_CATEGORY_LABEL`.

```ts
// category: "fencing"
{ sku: "fence.post.4x4x8",        description: "4×4 × 8' PT post, UC4B",                        unit: "each", unitCost: 14,   category: "fencing", source: "placeholder" },
{ sku: "fence.post.round5x8",     description: "4–5\" × 8' round CCA post",                    unit: "each", unitCost: 16,   category: "fencing", source: "placeholder" },
{ sku: "fence.post.round6x8",     description: "6\" × 8' round CCA corner / gate post",        unit: "each", unitCost: 28,   category: "fencing", source: "placeholder" },
{ sku: "fence.post.6x6x10",       description: "6×6 × 10' PT gate post",                       unit: "each", unitCost: 48,   category: "fencing", source: "placeholder" },
{ sku: "fence.post.tpost6",       description: "6' T-post 1.33 lb/ft",                         unit: "each", unitCost: 7,    category: "fencing", source: "placeholder" },
{ sku: "fence.post.tpostCap",     description: "T-post safety cap",                            unit: "each", unitCost: 1.2,  category: "fencing", source: "placeholder" },
{ sku: "fence.brace.hkit",        description: "H-brace kit (4\" rail, pins, brace wire, strainer)", unit: "each", unitCost: 30, category: "fencing", source: "placeholder" },
{ sku: "fence.wire.noClimb48.330",description: "2×4 no-climb 48\" × 330' 12.5 ga",             unit: "each", unitCost: 420,  category: "fencing", source: "placeholder" },
{ sku: "fence.wire.noClimb60.200",description: "2×4 no-climb 60\" × 200'",                     unit: "each", unitCost: 330,  category: "fencing", source: "placeholder" },
{ sku: "fence.wire.sheepGoat48.330", description: "4×4 sheep & goat 48\" × 330' 12.5 ga",     unit: "each", unitCost: 300,  category: "fencing", source: "placeholder" },
{ sku: "fence.wire.field47.330",  description: "Field fence 47\" × 330' (6×12)",               unit: "each", unitCost: 200,  category: "fencing", source: "placeholder" },
{ sku: "fence.wire.welded2x4.100",description: "Welded wire 2×4 48\" × 100' 14 ga",            unit: "each", unitCost: 110,  category: "fencing", source: "placeholder" },
{ sku: "fence.wire.hwCloth48.100",description: "Hardware cloth ½\" 48\" × 100' 19 ga",         unit: "each", unitCost: 130,  category: "fencing", source: "placeholder" },
{ sku: "fence.wire.hiTensile.lf", description: "12.5 ga high-tensile wire (4,000' coil ÷ lf)", unit: "lf",   unitCost: 0.05, category: "fencing", source: "placeholder" },
{ sku: "fence.wire.barbed.1320",  description: "Barbed wire 1,320' roll (cattle only)",        unit: "each", unitCost: 95,   category: "fencing", source: "placeholder" },
{ sku: "fence.panel.hog34",       description: "Hog panel 34\" × 16' 4 ga",                    unit: "each", unitCost: 40,   category: "fencing", source: "placeholder" },
{ sku: "fence.panel.cattle50",    description: "Cattle panel 50\" × 16' 4 ga",                 unit: "each", unitCost: 38,   category: "fencing", source: "placeholder" },
{ sku: "fence.panel.goat48",      description: "Goat panel 4×4 48\" × 16' 6 ga",               unit: "each", unitCost: 75,   category: "fencing", source: "placeholder" },
{ sku: "fence.board.1x6x16",      description: "1×6 × 16' rough-sawn fence board",             unit: "each", unitCost: 14,   category: "fencing", source: "placeholder" },
{ sku: "fence.board.2x6x16",      description: "2×6 × 16' PT rail",                            unit: "each", unitCost: 22,   category: "fencing", source: "placeholder" },
{ sku: "fence.chainLink.6x50",    description: "Chain-link fabric 6' × 50' 11 ga",             unit: "each", unitCost: 170,  category: "fencing", source: "placeholder" },
{ sku: "fence.chainLink.topRail.lf", description: "1⅜\" top rail + ties",                     unit: "lf",   unitCost: 2.2,  category: "fencing", source: "placeholder" },
{ sku: "fence.chainLink.linePost8", description: "1⅝\" × 8' line post + cap",                 unit: "each", unitCost: 22,   category: "fencing", source: "placeholder" },
{ sku: "fence.chainLink.termPost8", description: "2⅜\" × 8' terminal post + hardware",        unit: "each", unitCost: 40,   category: "fencing", source: "placeholder" },
{ sku: "fence.poultryNet.164",    description: "Electric poultry netting 48\" × 164'",         unit: "each", unitCost: 220,  category: "fencing", source: "placeholder" },
{ sku: "fence.elec.insulator",    description: "Line-post insulator",                          unit: "each", unitCost: 0.3,  category: "fencing", source: "placeholder" },
{ sku: "fence.elec.strainer",     description: "In-line strainer / tensioner",                 unit: "each", unitCost: 3.5,  category: "fencing", source: "placeholder" },
{ sku: "fence.elec.gateHandle",   description: "Insulated gate handle + anchor",               unit: "each", unitCost: 6,    category: "fencing", source: "placeholder" },
{ sku: "fence.elec.energizer",    description: "Energizer, ≤ 5 mile, 110 V",                   unit: "each", unitCost: 130,  category: "fencing", source: "placeholder" },
{ sku: "fence.elec.groundRod",    description: "6' galvanized ground rod + clamp",             unit: "each", unitCost: 18,   category: "fencing", source: "placeholder" },
{ sku: "fence.gate.tube4",        description: "4' tube gate, 1¾\" 20 ga, hinges + latch",     unit: "each", unitCost: 95,   category: "fencing", source: "placeholder" },
{ sku: "fence.gate.tube8",        description: "8' tube gate",                                 unit: "each", unitCost: 130,  category: "fencing", source: "placeholder" },
{ sku: "fence.gate.tube12",       description: "12' tube gate",                                unit: "each", unitCost: 170,  category: "fencing", source: "placeholder" },
{ sku: "fence.gate.tube16",       description: "16' tube gate",                                unit: "each", unitCost: 230,  category: "fencing", source: "placeholder" },
{ sku: "fence.gate.mesh4",        description: "4' mesh-filled gate (goat / poultry / dog)",   unit: "each", unitCost: 140,  category: "fencing", source: "placeholder" },
{ sku: "fence.gate.chainLink4x6", description: "4' × 6' chain-link walk gate w/ latch",        unit: "each", unitCost: 120,  category: "fencing", source: "placeholder" },
{ sku: "fence.gate.latch.twoStep",description: "Two-step / spring-slide latch with clip",      unit: "each", unitCost: 18,   category: "fencing", source: "placeholder" },
{ sku: "fence.hw.staples.lb",     description: "1¾\" barbed fence staples",                    unit: "lb",   unitCost: 3.5,  category: "fencing", source: "placeholder" },
{ sku: "fence.hw.panelClip",      description: "Panel clip / T-post clip",                     unit: "each", unitCost: 0.25, category: "fencing", source: "placeholder" },
{ sku: "fence.surface.stone.cuyd",description: "Compacted #57 / screenings run surface",       unit: "cuyd", unitCost: 45,   category: "fencing", source: "placeholder" },
{ sku: "fence.surface.geotextile.sqft", description: "Non-woven geotextile under run stone",  unit: "sqft", unitCost: 0.18, category: "fencing", source: "placeholder" },
{ sku: "fence.labor.note",        description: "Post driving, stretching, labor",              unit: "each", unitCost: 0,    category: "fencing", source: "placeholder" }, // "not estimated — ask your fence contractor"
```

Sanity check against extension totals: Iowa State's Dec-2024 sheet puts woven wire at roughly $2.50–3.00/ft materials + labor and high-tensile electrified at about $1.00–1.50/ft over 1,320′ **(from knowledge — verify against the PDF)**; a 12 × 24 no-climb horse run off a wall (60′ of fence, 9 posts, one 4′ gate) prices at about $900–1,100 in materials from the list above, which is in that band.

## 10. Model and code touch points (proposal — not implemented here)

Backend adds to `BuildingModel` (SPEC §31 lists `runs`, `fences`, `paddocks`; one array is enough for M5.5 — a paddock is a run with no `penId`):

```ts
runs: {
  id: Id;
  name: string;
  /** Plan feet, may lie outside the footprint (ADR-0005 origin stays at the SW corner). */
  rect: { x: number; y: number; w: number; d: number };
  species: Species; headCount: number;
  /** Pen this run serves; its exterior opening must lie on the shared wall edge. Absent = free-standing paddock / dry lot. */
  penId?: Id;
  fence: {
    kind: 'noClimb' | 'wovenWire' | 'board' | 'hiTensile' | 'pipe' | 'hogPanel' | 'cattlePanel' | 'goatPanel'
        | 'chainLink' | 'weldedWire' | 'hardwareCloth' | 'poultryNet' | 'barbed';
    heightFt: number;
    rails?: number; strands?: number; electric?: boolean; electricOffset?: boolean;
    post: { material: 'wood4x4' | 'round5' | 'round6' | 'tpost' | 'pipe'; spacingFt: number; depthIn: number; capped?: boolean };
    braces: boolean; topBoard?: boolean; apronIn?: number; covered?: boolean;
  };
  gates: { id: Id; side: 'n' | 's' | 'e' | 'w'; offsetFt: number; widthFt: 3 | 4 | 6 | 8 | 10 | 12 | 14 | 16;
           swing: 'in' | 'out'; latch: 'slam' | 'chain' | 'springSlide' | 'twoStep' | 'gravity' | 'lever' | 'kiwi' | 'boltPin';
           hinge: 'left' | 'right' }[];
  surface: 'stone' | 'gravel' | 'dirt' | 'concrete' | 'grass';
  slopePct?: number;              // away from the barn, positive
  equipmentAccess?: boolean;      // default from species / area (§8 site.gate.equipmentWidth)
  shade?: 'wall' | 'overhang' | 'tree' | 'none';
}[];
site.lanes?: { id: Id; polyline: Pt[]; widthFt: number }[];
site.prevailingWindDeg?: number;  // default 315 (NW) until the wind rose lands
```

- **Commands** in `lib/model/runs.ts`: `addRun` (defaults from the species preset — `rules/site/presets.ts` keyed by `Species`, same shape as the Animal advisor's presets), `addRunForPen` (snaps the rect to the pen's exterior edge, width = pen width, depth = preset, one gate on the far side centred on the door), `updateRun`, `removeRun`, `addGate`, `moveGate`, `setFence`. Turning on `outsideAccess` in `lib/model/zones.ts` should offer (not force) `addRunForPen` — the "run stub" SPEC §18.2 already names.
- **Derived** in `lib/site/fencing.ts` (never stored): per-run and total `fenceSegments[]` (with `sharedWith`, `onWall`), `posts[]` (kind, position, depth), `braces[]`, `gates[]` schedule, `takeoff` (§6 lines with skus from §9), `findings`. `lib/site/lanes.ts` derives the lane polygon between runs and the drive when the user has not drawn one.
- **Geometry** in `lib/geometry/site.ts`: new `BoxKind` values `fencePost`, `fenceRail`, `fenceMesh`, `gateLeaf`, `lane`; reuses `gravel` for run surfaces. The 3D engineer owns the render; this lane emits the boxes only.
- **Rules** in `rules/site/{runs,fence,gates,posts}.ts` registered in `rules/index.ts`; `npm run rules:index` after. Sources use the existing `Species:` / `MWPS:` / `Industry` / `User` forms; ask the Lead for `NRCS:${string}` (CPS 382) in `RuleSource` and SPEC Appendix A.
- **UI:** a "Runs & fencing" step after Interior in the step rail (ADR-0012) with a dock panel `components/steps/RunsStep.tsx` (species, size, fence preset, gates) and a site stage that shows the footprint, lean-tos, runs, lane, gates and north arrow. Test ids `run-add`, `run-fence-kind`, `run-gate-add`, `site-lane-width` in `tests/e2e/site.spec.ts`.
- **Pack:** sheet **A1 site plan** (runs, fence lines with post ticks, gates with swing arcs, lane, north arrow, boundary/setbacks) and a **F1 fence schedule** (segments, posts, gates, takeoff) for the Drawing engineer; BOM phase (5) "Site / fencing" (SPEC §29) fed from `takeoff`.
- **Tests:** golden takeoffs in `tests/site/` — G1: one 12 × 24 no-climb run off a 12′ stall, 4′ gate on the E side (fenceFt = 12 + 24 + 24 − 4 = 56, posts = 2 wall + 2 corner + 2 gate + line ceil(24/8)−1 ×2 + ceil(8/8)−1 = 10); G2: four 12 × 24 runs in a row sharing lines (three shared 24′ lines counted once), lane 14′, 12′ drive gate at the lane end; G3: a 40 × 60 goat dry lot, 4×4 mesh 48″, hot offset, two gates. Boundary tests per rule: 287 / 288 sq ft; 47″ / 48″ goat fence; 11′ / 12′ gate; 8′ / 8.5′ board spacing.

## 11. Open questions for Collin

1. Which side of the barn faces the road/drive, and where does the manure pad go? (Sets the lane and the drive-gate end.)
2. Species per pen and whether any two share a fence line (goats next to horses changes both fences).
3. Attached runs on every stall, or a shared dry lot with one gate per stall side?
4. Preferred fence look: 4-board (Kentucky), no-climb with a top board, or high tensile? Budget differs ~3×.
5. Tractor / spreader width on the property (12′ vs 14′ gates) and whether hay arrives by truck through a lane (16′).
6. Property boundary and setbacks entered? (Enables `site.run.outsideBoundary`.)

## Sources (search summaries; primary pages were egress-blocked unless noted)

- Horse space and dry lots: Extension Horses *Drylots for Horses* (400–500 sq ft/horse min; 600 sq ft ≈ 4 stalls); UMN Extension *Horse dry lots and shelters*; Penn State Extension *Construction of Equine All-Weather Paddocks for Mud-Free Management* (Swinker; footing, drainage); Stable Management *Equine Dry Lot and Shelter Size Recommendations*; Extension Horses *How much land do I need for a horse?* (1½–2 acres); Iowa State Small Farms *How Many Horses Can Your Pasture Maintain?*.
- Horse fencing: UMN Extension *Horse fencing considerations* (5′ perimeter, 4½–5′ dividing, no barbed wire, top rail on mesh); Bekaert *Horse and Equine Fence Requirements* (2×4 mesh, 8–12′ posts); Kencove *No Climb Horse Fence*; Horse Rail fence specifications; UKY Equine Programs *Horse Fencing: Is There a Best Choice?* (Coleman; 4-board); MSU Extension *Kentucky Horse Fence*.
- Paddock layout: Horse Journals *Choosing the Best Horse Fence* (rounded corners, 12–16′ lanes and gates); My Horse University *Fence Planning for Horses*; Stable Management *The Perfect Paddock* (alleys between paddocks, opposing gates).
- Goats and sheep: NMSU Guide D-703 *Housing and Working Facilities for Dairy Goats*; UMass CAFE *Housing and Working Facilities for Goats*; OSU Extension meat-goat manual ch. 12 *Housing and Corrals*; OSU Small Ruminant Team *Sheep Housing and Facilities Requirements* (25–40 / 30–50 sq ft); Red Brand / Bomann / Louis Page sheep-and-goat 4×4 48″ specs; sheep101.info land Q&A.
- Cattle: Penn State Extension *Beef Cattle Spacing Requirements*; K-State MF3392 *Guidelines for Planning Cattle Feedlots* (250–350 sq ft); Beef Magazine *4 tips for dry-lotting beef cattle* (500–800 sq ft/pair); Iowa State Ag Decision Maker FM 1855 / B1-75 *Estimated Costs for Livestock Fencing* (rev. Dec 2024); Kencove *Planning and Installing High-Tensile Fence*; USDA-NRCS Maine *High Tensile Manual*; WVU/NRAES-11 *High-Tensile Wire Fencing*; American Family *Safe fences for your cattle* (H-brace 8′ apart, 4′ deep).
- Pigs: Penn State Extension *Raising Small Groups of Pigs*; SARE *Raising Pigs on Pasture* (UF 100–250 sq ft, UArk 400 sq ft, stocking per acre); Premier 1 *Electric Fence and Netting for Hogs & Pigs*; Tractor Supply / The Mill hog panel 34″ × 16′ specs.
- Poultry: Hobby Farms *Run Defense: Build Your Chicken Run to Keep Out Predators*; Tractor Supply *Chicken Fencing*; Garden Betty and Tilly's Nest predator-proofing (½″ hardware cloth, 18–24″ apron); Fresh Eggs Daily fencing guide; 8–10 sq ft/bird run figures across coop-size guides.
- Alpaca / llama: Alpaca Owners Association Academy *Fencing* and *Pasture Planning and Forage Management* (5′ no-climb, 4–7 per acre, predator-out emphasis); Kentucky Alpaca Association *Fencing for Alpacas*; UMass CAFE *Alpaca Housing*; Zareba *Llamas and Alpacas: How High Should the Fence Be?*; Alpacas of Montana stocking rate.
- Dogs: SimpleWag and Backyard Pet Supplies chain-link kennel sizing (4×8 / 5×10 / 6×12, 6′–8′, 9–11 ga); SWi Fence 6×12 welded-frame kennel; USDA Animal Welfare Regulations §3.6 **(from knowledge)**.
- Electric strand heights: Zareba *Guide for Electric Fence Height Based on Your Animals*; FenceFast *Livestock Fence Height Guide*; Speedrite voltage chart.
- Posts and depth: Sereno Fence, NMI Fence, BuildToolHQ and FenceTrac one-third-rule summaries; Fence-All and Hoover Fence chain-link post spacing and depth; ProFence woven-wire and high-tensile installation guides.
- Gates: metalfencetech *Standard Farm Gate Sizes*; LivestockTechs cattle gate guide; haytalk and Yesterday's Tractors forum threads on 12–16′ gates (anecdotal).
- Not opened: MWPS-60 *Horse Facilities Handbook* (Wheeler et al., MidWest Plan Service); NRCS Conservation Practice Standard 382 *Fence*; Ohio Revised Code Chapter 971 (partition fences).
