# Electrical planning for a post-frame barn — research and implementation notes

**Agent:** Electrician (`agents/electrician.md`) · **For:** SPEC §6.1, §27, §9.1 sheet E1 · **Milestone:** M6/M7 · **Date:** 2026-09-08
**Code edition:** NEC 2020 section numbers; the 2023 renumbering of Article 547 is shown in parentheses where it differs. Ohio adopts the NEC through the OBC/RCO and many Cuyahoga County townships exempt agricultural buildings from *building* permits (SPEC §14 Q3) — that does not remove the NEC, the utility's requirements, or the insurer's expectations. Verify the edition and inspection scope with the AHJ.

> **Everything here is advisory.** It is planning input for the tool, not a design. Every finding, schedule and sheet note the tool emits from it must carry: *"Advisory only — verify with a licensed electrician / AHJ."*

## 0. How this was researched, and what was not verified

- `WebSearch` worked. `WebFetch` was egress-blocked for nfpa.org, ecmweb.com, up.codes, extension.psu.edu, horses.extension.org, esc.rutgers.edu and the ASABE/ANSI stores, so NEC section numbers and extension figures were confirmed from search summaries of those pages, not the primary text. Anything marked **(from knowledge)** was not confirmed online and must be checked in the adopted code book before the rule ships.
- Confirmed via search summaries: 2020 NEC 547.5 (wiring methods, 547.5(G) GFCI), 547.8 (luminaires), 547.9 (disconnecting means), 547.10 (equipotential planes); 2023 NEC 547.26 (physical protection), 547.28 (GFCI), 547.31 (luminaires), 547.44 (equipotential planes); Table 300.5 (18" PVC, 24" UF); Table 220.102 farm demand factors (first 60 A at 100%, next 60 A at 50%, remainder 25%); Table 430.248 single-phase FLCs (¼ hp 5.8 A, ½ hp 9.8 A, ¾ hp 13.8 A, 1 hp 16 A at 115 V); voltage-drop constants K = 12.9 (Cu) / 21.2 (Al); heated bucket nameplates (5 gal 130 W, 16 gal 260 W); Penn State / Rutgers extension guidance on conduit, guarded lamps, dust-tight boxes, GFCI everywhere and panel location.
- Foot-candle targets are extension planning figures (Penn State / Extension Horses "Stall Barn Lighting", MWPS-60 *Horse Facilities Handbook*, ASABE EP344.4 *Lighting Systems for Agricultural Facilities*). They are not code. The exact per-zone table in EP344.4 could not be fetched; the values in §2 are the commonly published extension numbers and are labelled `Species:extension-equine` in rules.

## 1. Fixture and equipment catalog

Planning VA is what the load calculation uses; where the nameplate is larger the nameplate wins. Amps are at the stated voltage. "Shared" means the device joins a circuit of its kind; "dedicated" means its own breaker. All boxes in animal, wash and exterior areas are NEMA 4X nonmetallic (PVC/fiberglass) with no open screw holes (547.5(C), 2023: 547.22/547.24 **(from knowledge)**).

| Catalog key | Item | Volts | Watts / planning VA | Amps | Circuit | Box / mount | Agricultural-rating notes |
|---|---|---|---|---|---|---|---|
| `light.highBay100` | LED high-bay, 100 W, ≈14,000 lm (140 lm/W), 5000 K | 120 | 100 W / 111 VA (PF 0.9) | 0.9 | shared lighting 15/20 A | hook or pendant from truss bottom chord / purlin bracket, 14–20' AFF (12' min) | IP65 dust-tight; aisles and equipment bays only — not the stall fixture. `light.highBay150` (150 W, ≈20,000 lm, 1.4 A) when mounting height > 18'. |
| `light.strip4` | 4' LED vapor-tight strip, 40 W, ≈5,000 lm, 4000–5000 K | 120 | 40 W / 44 VA | 0.37 | shared lighting 15/20 A | surface on bottom chord, ceiling or girt with stainless screws; through-wire gasketed | IP65/66 polycarbonate lens (no glass). In pens: ≥ 11' AFF (rearing reach) **or** wire guard — NEC 547.8 (2023: 547.31), Penn State. Default fixture for stalls, aisles, rooms. |
| `light.wallPack40` | Exterior LED wall pack, 40 W, ≈4,500 lm, photocell option | 120 | 40 W / 44 VA | 0.37 | shared exterior-lighting 15/20 A | FS weatherproof box through the siding, 9–12' above grade, 12–18" above the door head on the latch side | Wet-location listed (410.10(A)); full-cutoff optic recommended. One at every exterior door (§2.6). |
| `recep.stall20` | Stall-front receptacle, 20 A GFCI duplex, WR/TR | 120 | 350 VA planning (5-gal heated bucket 130 W + ag-rated fan ≈ 190 W; 16-gal bucket 260 W) | ≈ 3 | dedicated 20 A GFCI per 2–3 stalls | NEMA 4X FS box, in-use cover, 48" AFF on the **aisle side** of the stall front | Never inside the pen (§3). Cord ≤ 6' through a cord port above the stall door; no extension cords (Penn State). GFCI: 547.5(G) (2023: 547.28). |
| `recep.gp20` | General-purpose 20 A GFCI duplex, WR | 120 | 180 VA (220.14(I)) | 1.5 | shared 20 A GFCI, ≤ 8–10 per circuit | 4X FS box at 48" AFF (18" allowed in office/tack); WP cover where damp, in-use cover where wet | Aisle walls, tack, feed, wash (outside spray zone), equipment bay. |
| `recep.ext20` | Exterior 20 A GFCI, WR, extra-duty in-use cover | 120 | 180 VA; 1,500 VA when a tank de-icer is assigned | 1.5 / 12.5 | shared exterior 20 A GFCI; **dedicated** when it feeds a de-icer | 4X box, 48" above grade, at each exterior door and paddock tank | 406.9(B)(1) in-use cover; 547.5(G)/210.8(B) GFCI. |
| `appl.waterHeater45` | Wash-bay storage water heater, 40–50 gal | 240 | 4,500 W → ×1.25 = 5,625 VA (422.13) | 18.75 → 23.4 | dedicated 30 A / 2-pole, 10 AWG Cu | hard-wired, LFMC whip; lockable breaker or disconnect in sight (422.31(B)); utility side of the wash bay, off the floor, out of the spray zone | A tankless unit (18–27 kW, 75–115 A) does not fit a 100 A barn panel — rule flags it. 6 kW units → 30 A still (25 A × 1.25 = 31.3 → 35 A **(from knowledge)**). |
| `fan.stall` | Agricultural-rated stall/aisle fan, 18–20", sealed motor | 120 | 100–300 W (nameplate) | 1–2.5 | cord to `recep.stall20`, or hard-wired on a 20 A fan circuit (≤ 8 fans, switch per fan) | ≥ 8' AFF or on the stall front outside reach, aimed through the grille | Box fans are not dust-rated and are a documented barn-fire cause (Penn State); catalog only lists sealed-motor fans. |
| `motor.opener05` | Overhead door opener, ½ hp | 120 | nameplate ≈ 5–6 A; Table 430.248 FLC 9.8 A → 1,176 VA for the feeder calc | 9.8 (table) | dedicated 20 A GFCI (two openers per circuit allowed when nameplates ≤ 16 A total) | 20 A ceiling receptacle at the motor head (door centre, ≈ door height + 4' from the header, at ≥ 12' AFF); jackshaft openers get a wall receptacle at the side | 430.22: 12 AWG carries 125% FLC (12.25 A). GFCI per 547.5(G) / 210.8(B)(8). |
| `motor.wellPump05` | Submersible well pump, ½–1 hp | 230 | FLC 4.9 / 6.9 / 8.0 A (Table 430.248) → 1,176 / 1,656 / 1,920 VA | 4.9–8.0 | dedicated 20 A / 2-pole, 12 AWG (430.52 ≤ 250% FLC) | control box in the utility room; disconnect within sight of the controller (430.102) | Hard-wired 240 V: no GFCI required under 547.5(G). Optional: only when `site` says the barn has its own well. |
| `heat.tack15` | Tack-room heater, 1.5 kW wall-mounted fan-forced, thermostat | 120 | 1,500 W → ×1.25 = 1,875 VA (424.3(B)) | 12.5 → 15.6 | dedicated 20 A, 12 AWG | 4" square box, hard-wired, ≥ 3' from tack racks / blankets | Cord-and-plug 12.5 A exceeds the 12 A allowed on a 15 A circuit (210.23(A)(1)) → dedicated 20 A receptacle labelled HEATER. Never in a pen or hay zone. |
| `heat.deicer15` | Stock-tank de-icer, 1,500 W | 120 | 1,500 VA | 12.5 | dedicated 20 A GFCI WP | via `recep.ext20` at the tank | Counted at nameplate; nothing else on the circuit. |
| `recep.welder50` | Equipment-bay welder / compressor receptacle, NEMA 6-50 (optional) | 240 | 50 A × 240 = 12,000 VA (welder demand per 630.11 duty cycle) | 50 | dedicated 50 A / 2-pole, 6 AWG Cu | 4" square box, 48" AFF | Only offered on a 125 A panel. 2023 210.8(B) may extend GFCI to 240 V ≤ 50 A receptacles in some locations — verify. |
| `misc.autoWaterer` | Heated automatic waterer | 120 | 50–150 W | ≤ 1.25 | shares the stall receptacle circuit | hard-wired in conduit, no receptacle in the pen | Metallic equipment in a pen → equipotential-plane trigger (547.10, 2023: 547.44). |
| `misc.lowVoltage` | Cameras / Wi-Fi / PoE switch | 120 | 180 VA (one `recep.gp20` in the utility room) | — | shared | Cat6 in its own conduit | Not on the load calc beyond the receptacle. |

Sources: nameplate ranges from the manufacturers' listings surfaced in search (K&H / API heated buckets 130 W and 260 W; typical 100–150 W high-bays at 130–150 lm/W; 40 W vapor-tight strips); NEC Table 430.248 for motor FLCs; 422.13 / 424.3(B) for continuous appliance loads.

## 2. Lighting layout rules

### 2.1 Target illuminance by zone (planning figures — extension guidance, not code)

| `ZoneType` | Target fc (lux) | Default fixture | Notes |
|---|---|---|---|
| `pen` (stall) | 10 (100); 20 where foaling / vet work is expected | `light.strip4`, 1 per stall, centred | Penn State / MWPS-60: general stall 10 fc; task 20. |
| `kidding` | 20 (200) | `light.strip4` | Kidding pens are work areas. |
| `aisle` | 20 (200) | `light.strip4` rows on the bottom chord; `light.highBay100` if eave ≥ 14' | 20 fc is the usual aisle target; extension pages that quote 20–30 fc are counting grooming in the aisle. |
| `tack` | 30 (300) | `light.strip4` | Vendor pages quote 300–400 lux for tack rooms. |
| `feed` | 20 (200) | `light.strip4` | |
| `hay` | 10 (100) | `light.strip4`, enclosed and guarded, ≥ 3' clear of the top of the stack | Fire: Penn State. |
| `wash` | 30 (300); 50 at grooming / vet | `light.strip4`, wet-location listed | Switch outside the spray zone. |
| `equipment` | 20 general (200); 50 at a bench | `light.highBay100` if eave ≥ 14', else strips | |
| `office` / `restroom` | 50 / 30 | standard 4' LED wrap (finished rooms) | |
| `utility` / `milking` | 20 / 50 | `light.strip4` | Milking parlor 50 fc follows the dairy figure in EP344. |
| `open` | 10 | as aisle | |
| exterior door threshold | 2–5 | `light.wallPack40` | Paddock gates 1 fc. |

### 2.2 Fixture count and spacing (lumen method + spacing criterion)

1. Work plane 2.5' AFF everywhere (grooming height); floor level in stalls would give fewer fixtures, so 2.5' is the conservative choice.
2. Mounting height `MHft`: truss bottom chord (≈ `eaveHeightFt`) for open areas; ceiling height in finished rooms; pens require ≥ 11' or a guard (§1).
3. Lumens needed: `N_lumen = ceil(E × A / (Φ × CU × LLF))` with E the target fc, A the zone area ft², Φ fixture lumens, `CU = 0.55` (0.65 when the zone has white liner panels — `wall.assembly.interiorFinish` ≠ `none`), `LLF = 0.75` (dust and lumen depreciation in an agricultural space). Product 0.41–0.49; the tool shows the assumption.
4. Uniformity: `S_max = SC × (MHft − 2.5)` with spacing criterion `SC = 1.2` (manufacturer value when the catalog has one; 1.0 for narrow optics). Grid: `nx = ceil(L / S_max)`, `ny = ceil(W / S_max)`, `N = max(N_lumen, nx × ny)`, spacing `L/nx`, first fixture at half a spacing from the wall, never within 1' of a partition.
5. Snap rows to structure: along an aisle the row sits on the truss bottom chords, so spacing is rounded **down** to a multiple of `frame.trusses.spacingIn` (4' → 8' or 12' spacing); in a stall the fixture sits on the chord nearest the stall centre.
6. Minimums: at least one fixture per pen, room and bay; aisle rows at least one fixture per two bays.
7. Report per zone: fixtures, spacing, achieved fc = `N × Φ × CU × LLF / A`; finding when achieved < target (rule `mep.electrical.lighting.belowTarget`).

Worked examples (5,000 lm strips, 10' bottom chord, SC 1.2 → `S_max = 9'`):
- 12' × 36' aisle @ 20 fc: `N_lumen = 20 × 432 / (5000 × 0.41) = 4.2 → 5`; grid `nx = 4, ny = 2 → 8`; N = 8 (two rows of 4 at 9'). A single row of 5 at 7.2' meets the lumen count (≈ 24 fc average) but fails the transverse spacing check (12' > 9'); the tool offers it as an option with a uniformity note.
- 12' × 12' stall @ 10 fc: `N_lumen = 0.7 → 1`; one strip gives ≈ 14 fc.
- 36' × 48' equipment bay @ 20 fc with 14,000 lm high-bays at 16' (`S_max = 16.2'`): `N_lumen = 20 × 1728 / (14000 × 0.41) = 6.02 → 7`; grid `nx = 3, ny = 3 → 9`; N = 9 at 16' × 12'.

### 2.3 Switching

- A switch controlling the entry-area lighting within 5' inside **every man door** (Industry; mirrors the intent of NEC 210.70 for dwellings).
- **Aisle: 3-way at both ends** (each aisle exit door); 4-way added for a side man door. Rule `mep.electrical.switch.aisle3way`.
- Stall lights: one switch per stall on the aisle side of the stall front at 48", or one switch per group of 2–4 stalls; never inside a pen.
- Rooms: switch inside the door of each tack / feed / wash / utility room; wash-bay switch outside the spray zone or under a WP cover.
- Exterior lights: switch inside the nearest door plus optional photocell / timer (dusk-to-dawn shown as a note, not a device).
- Switch boxes: 4X FS, 48" AFF, spring-closing dust covers in animal areas (Rutgers).

### 2.4 Exterior lights

One `light.wallPack40` at every exterior opening of type `manDoor`, `doubleDoor`, `dutchDoor` (pen outside access), `slidingDoor`, `overheadDoor`, `rollUpDoor`: 12–18" above the head, latch side; two flanking fixtures for doors wider than 12'. Rule `mep.electrical.lighting.exteriorDoor`.

## 3. Receptacle rules

1. **GFCI everywhere.** Every 125 V, 15/20 A receptacle in the barn is GFCI-protected (breaker or first device): NEC 547.5(G) (2023: 547.28) requires it in areas with an equipotential plane, outdoors, damp or wet locations and dirt confinement areas, and 210.8(B) covers the rest of a non-dwelling; treating the whole building as GFCI is simpler and is what extension guidance asks for. 240 V receptacles: not required by 547.5(G) (2020); 2023 210.8(B) extends GFCI to ≤ 50 A single-phase receptacles in listed locations — verify with the AHJ.
2. **Covers.** Wet locations (wash bay spray zone, outdoors, stall fronts that get hosed) → in-use "extra-duty" cover on a 4X box (406.9(B)(1)); damp (covered aisle, under eaves) → weatherproof-when-closed cover (406.9(A)). Devices marked WR; TR where children are expected.
3. **One receptacle per stall front** (`recep.stall20`) for the heated bucket and fan, on the aisle side, 6–12" from the front partition line on the hinge side so cords never cross the door; **dedicated 20 A GFCI per 2–3 stalls** (3 × 350 VA = 1,050 VA = 8.8 A, 44% of 20 A, leaving room for clippers).
4. **No receptacle inside a pen or within animal reach**: nothing inside the pen polygon, nothing on the pen side of a stall front below 8', nothing a horse can reach over a Dutch door. Equipment that must live in the pen (auto-waterer) is hard-wired in conduit. NEC 547.5 physical protection (2023: 547.26) plus Penn State / Rutgers guidance. Rule `mep.electrical.receptacle.animalReach`.
5. **Mounting height 48" AFF** in all animal, wash and aisle areas (above bedding, wash-down splash and most hoof reach; bucket cords are 6'); 18–48" allowed in office / tack.
6. **General receptacles**: one per bay along each aisle wall (≤ 20' apart), 2 in tack (one is the dedicated heater outlet), 1 in feed, 1 in wash outside the spray zone, 1 per bay in equipment, 1 exterior at every exterior door, 1 at each paddock tank.
7. **Per-circuit limit**: ≤ 10 general receptacles on a 20 A circuit (10 × 180 VA = 1,800 VA = 75% of 20 A × 120 V — 220.14(I) with the 80% convention); the tool defaults to 8 because barns plug in clippers, vacuums and heaters. Rule `mep.electrical.circuit.receptacleCount`.
8. Cord discipline is a sheet note: cords ≤ 6', through a cord port above the door, no daisy-chained strips, no extension cords as permanent wiring (400.12; Penn State).

### 3.1 Placement algorithm (`lib/mep/receptacles`)

1. **Stall fronts.** For each `pen` / `kidding` zone find the edge it shares with an `aisle` zone (the stall front). Place `recep.stall20` on the aisle side at 48", 9" from the partition corner on the hinge side of the stall door (`openings` with `type = stallDoor` and a matching `zoneId`; hinge side = the jamb farther from the door's `offsetFt`). A pen with no aisle edge (outside-access-only) gets its receptacle on the nearest aisle or utility wall and an `info` note.
2. **Aisle walls.** Walk every wall segment that bounds an aisle (exterior walls and room partitions facing the aisle); one `recep.gp20` per bay (`frame.bayFt`) at mid-bay, skipping stall fronts (already served) and openings; never more than 20' between receptacles along one wall.
3. **Rooms.** `tack` 2 (one labelled HEATER, dedicated); `feed` 1; `wash` 1 outside the spray zone (≥ 6' from the wash-rack centre, beside the door); `utility` 2 (one for the low-voltage rack); `office` 4 at 18"; `equipment` 1 per bay plus the optional `recep.welder50`.
4. **Exterior.** One `recep.ext20` beside every exterior door on the latch side, 48" above grade; one at each paddock tank once §26 `siteFeatures` exist — that one becomes the dedicated `heat.deicer15` outlet.
5. **Openers.** One ceiling receptacle per `overheadDoor` / `rollUpDoor` at the motor head (door centre, ≈ door height + 4' from the header, on the bottom chord); it is counted with the motor, not as a 180 VA receptacle.
6. **Dedupe.** Two general receptacles within 3' merge unless one is dedicated. Every placed device gets `heightIn = 48` (ceiling devices: chord height), `options.gfci = true`, and `options.wp = true` in `wash` zones and exterior positions.
7. Placement is a one-shot generator like the layout patterns in SPEC §23 — devices become model state, so the user's moves and deletions persist; re-running the generator only fills gaps.

## 4. Load calculation and panel / feeder sizing (NEC 220, simplified)

### 4.1 Steps

1. **Lighting**: Σ luminaire planning VA (220.14(D)) × 1.25 (continuous, 210.20(A) / 215.3).
2. **Receptacles**: 180 VA per yoke (220.14(I)); a stall receptacle counts `max(180, planning VA)` = 350 VA; a de-icer receptacle counts 1,500 VA.
3. **Fixed appliances at nameplate**: water heater × 1.25 (422.13), fixed heaters × 1.25 (424.3(B)).
4. **Motors**: Table 430.248 FLC × volts; the largest motor +25% (430.24, 220.50).
5. **Demand factors — Table 220.102 (farm buildings other than the dwelling)**: loads expected to operate without diversity (not less than 125% of the largest motor and not less than the first 60 A) at 100%; the next 60 A of other load at 50%; the remainder at 25%. The tool treats winter-evening loads (lights, buckets, heaters, water heater) as "without diversity" — conservative. For a barn the AHJ does not treat as a farm building, offer the standard method instead: 220.42/220.44 (non-dwelling receptacles: first 10 kVA at 100%, remainder 50%) with the same motor and continuous factors.
6. Amps = VA / 240. Choose the feeder OCPD from 240.6 standard sizes ≥ calculated amps; the building disconnect must be ≥ 60 A (225.39(D)).

### 4.2 Worked example — 36' × 48' barn: 4 stalls, 12' aisle, tack, feed, wash, opener, well pump, one tank de-icer

| Load | Basis | VA |
|---|---|---|
| Lighting: 8 aisle + 4 stall + 2 tack + 2 feed + 2 wash strips (18 × 44) + 3 wall packs (3 × 44) | 924 VA × 1.25 | 1,155 |
| Stall receptacles 4 × 350 | planning | 1,400 |
| General receptacles 9 × 180 (4 aisle, 1 tack, 1 feed, 1 wash, 2 exterior; the opener outlet is counted with its motor) | 220.14(I) | 1,620 |
| Water heater 4,500 W | × 1.25 | 5,625 |
| Tack heater 1,500 W | × 1.25 | 1,875 |
| Opener ½ hp 9.8 A × 120 = 1,176, largest motor +25% | 430.24 | 1,470 |
| Well pump ½ hp 4.9 A × 240 | 430.248 | 1,176 |
| Tank de-icer | nameplate | 1,500 |
| **Connected (calculated)** | | **15,821 VA = 65.9 A @ 240 V** |
| Demand (220.102): first 60 A @ 100% + 5.9 A @ 50% | | **63.0 A** |

63 A exceeds a 60 A feeder (240.6 → next size 70 A), so the tool recommends a **100 A subpanel**; it also leaves headroom for a compressor, HVLS fan or more stalls (SPEC §29 phasing).

**Example B — 12' × 24' two-stall run-in with a tack corner, 100' from the house:** 3 strips + 1 wall pack (176 VA × 1.25 = 220), 2 stall receptacles (700), 2 general + 1 exterior (540) → 1,460 VA = 6.1 A. Two circuits suffice, so the minimal option is a **20 A 2-pole multiwire branch circuit** (12/3 UF-B at 24" cover, or 3 × 12 AWG + EGC in ¾" PVC) with a 2-pole disconnect at the shed — 225.30 treats a multiwire branch circuit as one circuit and 225.39(C) allows a 30 A disconnect for a two-circuit installation **(from knowledge — the electrician picks the disconnect)**. The tool offers it beside the 60 A / 8-space subpanel and defaults to the subpanel when the user marks "may add stalls" (SPEC §29). At 20 A the 12 AWG run drops 3.3% over 100' (§4.4 formula at 240 V) — the rule asks for 10 AWG.

### 4.3 Panel selection

| Calculated demand | Panel / feeder OCPD | Spaces | When |
|---|---|---|---|
| ≤ 48 A | 60 A main-breaker subpanel | 8–12 | run-in shed, ≤ 3 stalls, no water heater |
| ≤ 80 A | 100 A | 20–24 | default for any barn with a water heater or > 3 stalls |
| ≤ 100 A | 125 A | 24–30 | welder / compressor bay, > 8 stalls |
| > 100 A | 150–200 A — "licensed electrician required" finding | 30+ | tankless heater, arena lighting |

Keep ≥ 20% spare spaces. Hard rule: never size the panel below the demand; soft rule: never below 100 A when `zones` contain `wash`.

### 4.4 Feeder from the house (120/240 V single-phase, 4-wire)

Conductor minimums are 75 °C ampacities from Table 310.16 (60 A: 6 Cu / 4 Al; 100 A: 3 Cu / 1 Al; 125 A: 1 Cu / 2/0 Al). Voltage drop at the **full breaker rating** (conservative), `VD = 2 × K × I × L / CM`, K = 12.9 Cu / 21.2 Al, limit 3% of 240 V = 7.2 V (210.19(A) Info. Note 4 / 215.2(A) Info. Note 2 — a recommendation, mandatory under some energy codes). The tool recomputes at the calculated load and shows both.

| Feeder | 100' | 150' | 200' | EGC (250.122) |
|---|---|---|---|---|
| 60 A Cu | 6 AWG (2.5%) | 4 AWG (2.3%) | 3 AWG (2.5%) — 4 AWG = 3.1% | 10 AWG Cu |
| 60 A Al | 4 AWG (2.5%) | 2 AWG (2.4%) | 1 AWG (2.5%) — 2 AWG = 3.2% | 8 AWG Al / 10 Cu |
| 100 A Cu | 3 AWG (2.0%) | 2 AWG (2.4%) — 3 AWG = 3.1% | 1 AWG (2.6%) | 8 AWG Cu |
| 100 A Al | 1 AWG (2.1%) | 1/0 AWG (2.5%) — 1 AWG = 3.2% | 2/0 AWG (2.7%) | 6 AWG Al / 8 Cu |
| 125 A Cu | 1 AWG (1.6%) | 1 AWG (2.4%) | 1/0 AWG (2.6%) | 6 AWG Cu |
| 125 A Al | 2/0 AWG (1.7%) | 2/0 AWG (2.5%) | 3/0 AWG (2.6%) | 4 AWG Al / 6 Cu |

Notes the sheet must carry:
- 250.122(B): when conductors are upsized for voltage drop, the EGC is upsized in the same circular-mil ratio. 547.5(F): an EGC run underground in an agricultural location is **insulated** copper — no bare EGC in the feeder conduit.
- Four wires (two ungrounded, neutral, EGC); neutral **isolated** from the enclosure at the barn (250.32(B)(1)); grounding electrode system at the barn (250.32(A)): two 8' × 5⁄8" copper-bonded rods ≥ 6' apart (250.52(A)(5), 250.53(A)(2)), 6 AWG Cu GEC (250.66). Main-breaker panel as the building disconnect, nearest the point of entrance (225.31, 225.32, 225.36), rated ≥ 60 A (225.39(D)); one feeder per building (225.30).
- Aluminum is fine for the feeder (XHHW-2 or USE-2, anti-oxidant, Al-rated lugs); copper THWN-2 for everything inside the barn.
- The house service must have capacity for the added feeder — flag "verify house service load (220.83/220.87) with the electrician".

### 4.5 Buried run

| Method | Cover (Table 300.5) | Notes |
|---|---|---|
| PVC Schedule 40 conduit with THWN-2 / XHHW-2 conductors (**preferred**) | 18" general; 24" under driveways / parking in non-dwelling column | Schedule 80 for the risers and where subject to damage (352.10(F)); risers to 8' above grade protected (300.5(D)); ≤ 360° of bends between pull points (352.26); pull string and a spare 1" data conduit in the same trench. |
| USE-2 / RHW-2 aluminum direct burial (URD "quadplex") | 24" | Cheapest 100 A option; still needs conduit sleeves at both risers and under the drive; cannot be re-pulled later. |
| UF-B cable direct burial | 24" | Only practical to 50 A: UF ampacity is the 60 °C column (340.80) — 6 AWG Cu UF = 55 A. Protected in conduit where it emerges (300.5(D)). Permitted in the barn by 547.5(A). |

Conduit size for the feeder (Chapter 9 Table 1 at 40% fill, Table 4/5 areas): 60 A Cu (3 × 6 AWG + 10 EGC = 0.173 in²) → 1"; 100 A Al (3 × 1 AWG + 6 Cu EGC = 0.519 in²) → 1¼" minimum, **1½" recommended** for the pull; 2/0 Al at 200' (0.749 in²) → 1½" minimum, 2" recommended. Trench length = plan distance house panel → barn panel + 2 × depth + 10% for the route; the tool asks the user for the trench route length (`feeder.lengthFt`) rather than guessing from the site plan until §6.4 Site ships.

## 5. Circuit assignment algorithm (`lib/mep/circuits`)

Inputs: catalog devices with position, zone, planning VA, volts, poles; panel rating and spaces; user pins in `model.overrides` (`targetId = deviceId, field = "circuit"`). Output is deterministic (devices sorted by stable id, stalls sorted along the aisle axis) so it can be golden-file tested.

1. **Dedicated circuits first**, one per device: `appl.waterHeater45` 30 A/2P 10 AWG; `motor.wellPump05` 20 A/2P 12 AWG; `heat.tack15` 20 A/1P 12 AWG; `heat.deicer15` 20 A/1P GFCI; `motor.opener05` 20 A/1P GFCI (pair two openers when nameplates ≤ 16 A); `recep.welder50` 50 A/2P 6 AWG.
2. **Stall receptacles**: order pens by projection onto the aisle axis, split into `ceil(n / 3)` contiguous groups of as-even size (4 stalls → 2 + 2, not 3 + 1) with Σ planning VA ≤ 1,920 VA (80% × 20 A × 120 V); one 20 A GFCI circuit per group so the homerun is a single run along the stall fronts.
3. **General receptacles**: group by zone kind and aisle side — aisle-north, aisle-south, rooms (tack + feed + wash + utility), equipment bay, exterior (own circuit, WP). Fill to `min(8 devices, 1,920 VA)`, then start a new circuit.
4. **Lighting**: groups (a) aisle + exterior door lights (3-way controlled), (b) stall lights (split when > 12 stalls), (c) rooms, (d) equipment-bay high-bays. 15 A / 14 AWG by default; promote to 20 A / 12 AWG when Σ VA × 1.25 > 1,440 VA (80% × 15 A × 120 V). Lighting is treated as continuous (≥ 3 h).
5. **80% rule** on every circuit: `Σ continuous VA × 1.25 + Σ non-continuous VA ≤ breaker A × volts` (210.19(A)(1), 210.20(A)); violators are split, or flagged when a single device exceeds it.
6. **Spares**: leave ≥ 20% of spaces empty; add one spare 20 A GFCI receptacle circuit if spaces allow.
7. **Wire size per circuit**: 15 A → 14 AWG, 20 A → 12 AWG, 30 A → 10 AWG, 40 A → 8 AWG, 50 A → 6 AWG (240.4(D), 310.16). Then the voltage-drop check at the calculated circuit load over the routed length (§6): 12 AWG at 16 A reaches only 57' at 3% of 120 V, at 9 A about 100'; 14 AWG at 5 A about 115'. Upsize one gauge (keep the breaker) when over; note that a centred panel halves these runs.
8. **Leg balancing**: standard panel numbering — odd circuits down the left, even down the right, legs alternate every row (1–2 = A, 3–4 = B, …); 2-pole loads occupy two adjacent slots in one column and land on both legs. Greedy placement of 1-pole circuits onto the leg with the lower running VA sum; target imbalance ≤ 10% or 15 A, whichever is larger. Order in the panel: 2-pole loads at the top, then dedicated 1-pole, then receptacle circuits, then lighting.
9. **Report** per circuit: number, description (zone names), breaker A / poles, GFCI (breaker or device), wire AWG + conduit size, connected VA, calculated VA (with 125% where continuous), % of rating, leg, device ids; plus the findings in §8.

## 6. Routing rules inside a post-frame barn (`lib/mep/routing`)

- **Panel**: utility or tack room — driest, least dusty space (Penn State); never in a pen, feed, hay or wash zone. Working space 30" wide × 36" deep × 6'6" high (110.26(A)); top breaker handle ≤ 6'7" AFF (240.24(A)); mounted on the inside face of a post or on girts with a ¼" air space in corrosive areas (300.6(D)); NEMA 3R if it must be outdoors. Prefer a **central** location along the aisle to shorten homeruns (§5.7).
- **Wiring belt**: main runs in conduit along the girts / inside face of posts at **7'6"–8' AFF** — above horse reach, below the 10' bottom chord — fastened to the girt line. PVC Schedule 40 (Article 352, 547.5(A)) in animal and wash areas (manure ammonia corrodes plain EMT — 300.6, 547.5(C)(3)); EMT (Article 358) acceptable in tack, feed, office and equipment rooms; LFMC/LFNC only for the last connection to motors and the water heater (547.5(D), Article 350).
- **Drops**: a vertical conduit from the belt down to each 48" box on the aisle side of the stall front, hugging a post; drops inside a pen only behind the kick-wall (2" lumber, `interiorFinish = kickwall`), never surface-mounted below 7'6" in a pen.
- **Crossing the aisle**: on the side or bottom of a truss bottom chord (strap, no notching or drilling of any truss member without the truss designer's written OK) or across the top of the chords where a ceiling exists ("attic run"); ≥ 10' AFF. Along the aisle: on the bottom-chord line, strapped every 10' and within 3' of each box for EMT (358.30), every 3' for PVC ≤ 1" (352.30); cables every 4.5' and within 12" of boxes (334.30 / 340.10) and within 8" of boxes in agricultural buildings (547.5(B)).
- **Cable vs conduit**: no Type NM-B where animals, dust or wash-down are present — 547.5(A) lists UF, NMC, jacketed MC, copper SE, RNC (PVC) and LFNC; plain NM is not on the list. UF-B and jacketed MC are allowed exposed only ≥ 7'6" AFF and never in a pen (340.12 physical damage, 547.5 physical protection / 2023 547.26). Below 7'6" in any animal or aisle area: conduit. Rule `mep.electrical.wiring.nmExposed`.
- **Boxes**: NEMA 4X nonmetallic in animal, wash and exterior areas, dust-tight, no open holes (547.5(C)(1)); junction boxes accessible without removing the kick-wall or a ceiling (314.29) — a box behind a stall liner is a finding. Box fill per 314.16(B): 12 AWG = 2.25 in³ each, device = 2 conductors, all EGCs = 1; a duplex with two 12/2 cables needs 15.75 in³ — a single-gang FS box (18 in³) passes, a shallow 4 × 4 × 1½" (21 in³) passes; the tool uses FS 18 in³ for devices and 4" × 4" × 2⅛" (30.3 in³) for junctions.
- **Conduit fill** (Chapter 9 Table 1 → 40% for > 2 conductors; Annex C counts, THWN-2 **(from knowledge — verify against the adopted edition)**): ½" EMT 12 × 14 / 9 × 12 / 5 × 10; ¾" EMT 22 × 14 / 16 × 12 / 10 × 10 / 6 × 8; 1" EMT 35 × 14 / 26 × 12 / 16 × 10 / 9 × 8; ½" PVC-40 11 × 14 / 8 × 12 / 5 × 10; ¾" PVC-40 21 × 14 / 15 × 12 / 9 × 10 / 5 × 8; 1" PVC-40 34 × 14 / 25 × 12 / 15 × 10 / 9 × 8. Belt raceway default ¾", promoted to 1" when a run carries more than 9 conductors.
- **Derating**: more than 3 current-carrying conductors in one raceway → 310.15(C)(1): 4–6 = 80%, 7–9 = 70%, 10–20 = 50%. 12 AWG THWN-2 (30 A at 90 °C) × 0.7 = 21 A still carries a 20 A circuit; × 0.5 does not. The tool therefore caps a shared belt raceway at **9 current-carrying conductors** (neutral of a 120/240 V 3-wire multiwire circuit not counted, 310.15(E)(1)); beyond that it starts a parallel raceway.
- **Wire**: THWN-2 copper: 14 AWG 15 A, 12 AWG 20 A, 10 AWG 30 A, 8 AWG 40 A, 6 AWG 55 A (240.4(D), 310.16 60 °C column for ≤ 10 AWG). Branch VD ≤ 3%, feeder + branch ≤ 5% at the calculated load, checked over the routed length (§5.7).
- **Takeoff**: conduit length = Manhattan path along the belt (girts, then chord crossing) + drops + 10%; wire length = conduit length × conductors + 1' per termination; one strap per 3' (PVC) or 10' (EMT); fittings allowance 20% of conduit cost.
- **Exterior**: wall packs and WP receptacles on FS boxes through the steel siding with a grommeted sleeve and sealant; conduit exits above the skirt board, not through it.
- **Wash bay**: no boxes within the spray zone (6' horizontally from the wash-rack centre, 3' from a floor drain) unless 4X with in-use covers; luminaires wet-location listed; keep the water-heater whip and disconnect on the dry side.
- **Equipotential plane** (547.10, 2023: 547.44): required in concrete-floored confinement areas with metallic equipment that is accessible to livestock and likely to become energized (steel stall fronts with heated waterers qualify in the code's words). Bonded wire mesh or rebar in the slab, #8 solid copper to the grounding electrode system, bonded before the pour — coordinate with the Builder's slab detail (§7.5). The tool raises an `info` finding; it does not design the plane.
- **Surge**: a Type 2 SPD at the barn panel is recommended (not required for a non-dwelling feeder — 230.67 / 2023 215.18 are dwelling rules); lightning protection is outside scope (NFPA 780).

## 7. What the E1 electrical plan sheet shows (data for `lib/drawings`)

- **Symbols** (ANSI/IEEE 315, NECA 100 conventions): ceiling luminaire ○ (filled centre); surface strip ▭ with ○ ends; wall luminaire ○ with stub; exterior wall pack ○-stub + "WP"; duplex receptacle ○ with two parallel bars; GFCI = duplex + "GFI"; weatherproof + "WP"; 240 V receptacle ○ with three bars + rating; switch **S**, 3-way **S₃**, 4-way **S₄**, photocell **PC**; junction box **J**; panel ▬ filled rectangle "P1"; motor Ⓜ; fan symbol; water heater "WH" square; disconnect ▭ with blade. Runs: solid line = conduit in the belt/ceiling; dashed = underground or in slab; heights as text (+48", +96").
- **Homerun arrows** from the first device of each circuit toward the panel, labelled `P1-3` (one arrowhead per homerun, tick marks for conductor count above 2), grouped where several circuits share a raceway.
- **Panel schedule** table — columns: Ckt #, Description, Breaker (A / poles), GFCI, Wire (AWG, conduit), Connected VA, Calc VA, Leg (A/B); footer: connected VA, demand VA (220.102), amps at 240 V, feeder size, spare spaces.
- **Feeder note** (example): *Feeder: 100 A 2-pole from house panel; 3 × 1/0 AWG Al XHHW-2 + 8 AWG Cu THWN-2 insulated EGC in 1½" Schedule 40 PVC, 18" min cover (24" under the drive); trench ≈ 160 ft; VD ≈ 2.7% at 100 A; neutral isolated at the barn panel; verify house service capacity. Advisory — verify with a licensed electrician / AHJ.*
- **Grounding electrode note**: *Two 8' × 5⁄8" copper-bonded ground rods ≥ 6' apart, 6 AWG Cu GEC to the panel ground bar (250.32(A), 250.52(A)(5), 250.53(A)(2), 250.66). Equipotential plane bonding, #8 solid Cu, where required (547.10 / 547.44).*
- **Lighting table**: zone, target fc, fixture, count, spacing, achieved fc, mounting height, guard Y/N.
- **Device schedule**: tag, catalog key, count, VA, mounting height, cover type.
- **General notes**: NEC edition assumed; all 125 V 15/20 A receptacles GFCI; wiring methods by area (§6); device heights; no NM in animal areas; junction boxes accessible; the liability statement (SPEC §15).
- The same device list drives the 3D `mep` layer (simple boxes at height, conduit as lines) — never a second model.

### 7.1 Sample panel schedule — the §4.2 barn (100 A main-breaker subpanel, 20 spaces)

Produced by the §5 algorithm: 2-pole loads first, then dedicated 1-pole, receptacles, lighting; odd circuits down the left, even down the right, legs alternating by row.

| Ckt | Description | Breaker | GFCI | Wire / raceway | Conn. VA | Calc VA | Leg |
|---|---|---|---|---|---|---|---|
| 1–3 | Water heater, wash bay, 4.5 kW | 30 A / 2P | — | 10 AWG THWN-2, ¾" PVC, LFMC whip | 4,500 | 5,625 | A+B |
| 2–4 | Well pump ½ hp, 230 V | 20 A / 2P | — | 12 AWG, ¾" PVC | 1,176 | 1,176 | A+B |
| 5 | Tack-room heater 1.5 kW, fixed | 20 A | — | 12 AWG, ¾" EMT | 1,500 | 1,875 | A |
| 6 | Aisle receptacles (4) | 20 A | breaker | 12 AWG, ¾" PVC | 720 | 720 | A |
| 7 | Tank de-icer receptacle, paddock | 20 A | breaker | 12 AWG, ¾" PVC | 1,500 | 1,500 | B |
| 8 | Overhead door opener ½ hp | 20 A | breaker | 12 AWG, ¾" PVC | 1,176 | 1,470 | B |
| 9 | Stall receptacles, stalls 1–2 | 20 A | breaker | 12 AWG, ¾" PVC | 700 | 700 | A |
| 10 | Lights: aisle (8) + exterior (3), 3-way at both ends | 15 A | — | 14 AWG, ¾" PVC | 484 | 605 | A |
| 11 | Stall receptacles, stalls 3–4 | 20 A | breaker | 12 AWG, ¾" PVC | 700 | 700 | B |
| 12 | Room receptacles: tack, feed, wash | 20 A | breaker | 12 AWG, ¾" EMT | 540 | 540 | B |
| 13 | Exterior receptacles (2), WP in-use covers | 20 A | breaker | 12 AWG, ¾" PVC | 360 | 360 | A |
| 14 | Lights: stalls (4), guarded vapor-tight | 15 A | — | 14 AWG, ¾" PVC | 176 | 220 | A |
| 15 | Lights: tack, feed, wash (6) | 15 A | — | 14 AWG, ¾" EMT | 264 | 330 | B |
| 16–20 | Spare (5 of 20 = 25%) | — | | | | | |

Footer: connected 13,796 VA · calculated 15,821 VA (65.9 A) · demand per Table 220.102 = 63.0 A · leg A 7,881 VA / leg B 7,941 VA (0.8% imbalance) · feeder 100 A 2-pole, 4-wire, neutral isolated, own ground rods · *Advisory only — verify with a licensed electrician / AHJ.*

## 8. Rules table (`rules/mep/electrical/*`)

Severity: `warn` = a code requirement is likely unmet (the AHJ would fail it); `info` = extension best practice. Nothing here is `error` (advisory lane). Every message ends "— verify with a licensed electrician / AHJ" (appended by a shared helper, not repeated below).

| Id | Severity | Condition | Message (short form) | Citation |
|---|---|---|---|---|
| `mep.electrical.receptacle.gfci` | warn | any 125 V 15/20 A receptacle without GFCI (device or breaker) | "Receptacle {tag} is not GFCI-protected; every 15/20 A receptacle in a barn needs it." | NEC 547.5(G) (2023: 547.28); 210.8(B) |
| `mep.electrical.receptacle.wetCover` | warn | receptacle in a `wash` zone spray area or outdoors without an in-use cover / 4X box | "Receptacle {tag} is in a wet location without an in-use weatherproof cover." | NEC 406.9(B)(1); 547.5(C) |
| `mep.electrical.receptacle.animalReach` | warn | receptacle or switch inside a `pen`/`kidding` polygon, or on the pen face of a stall front below 96" | "Device {tag} is within animal reach; move it to the aisle side at 48\"." | NEC 547.5 physical protection (2023: 547.26); Penn State / Rutgers |
| `mep.electrical.receptacle.height` | info | device in an animal/aisle/wash zone mounted below 48" | "Device {tag} at {h}\" — 48\" keeps it above bedding, wash-down and hooves." | Species:extension-equine |
| `mep.electrical.receptacle.stallFront` | info | pen with no `recep.stall20` within 3' of its aisle-side front | "Stall {name} has no front receptacle for a heated bucket / fan." | Industry (SPEC §27) |
| `mep.electrical.circuit.receptacleCount` | warn | > 10 general receptacles on one 20 A circuit (info at > 8) | "Circuit {n} serves {k} receptacles; keep it to 8–10." | NEC 220.14(I) + Industry |
| `mep.electrical.circuit.over80` | warn | Σ continuous × 1.25 + non-continuous > breaker rating | "Circuit {n} is loaded to {pct}% of {A} A." | NEC 210.19(A)(1); 210.20(A) |
| `mep.electrical.circuit.dedicated.waterHeater` | warn | `appl.waterHeater45` shares a circuit or is on < 30 A / 10 AWG | "Water heater needs its own 30 A / 2-pole circuit (4.5 kW × 125% = 23.4 A)." | NEC 422.13; 422.11(E); 210.23 |
| `mep.electrical.circuit.dedicated.heater` | warn | fixed heater ≥ 1,000 W not on a dedicated 20 A circuit | "Tack heater {tag} needs a dedicated 20 A circuit (1.5 kW × 125% = 15.6 A)." | NEC 424.3(B); 210.23(A)(1) |
| `mep.electrical.circuit.motor` | warn | opener / pump conductors < 125% of Table 430.248 FLC or no disconnect in sight (pump) | "{tag}: conductors must carry 125% of {FLC} A; pump needs a disconnect within sight." | NEC 430.22; 430.52; 430.102 |
| `mep.electrical.circuit.voltageDrop` | warn | branch VD > 3% at calculated load over routed length (info at 2.5–3%) | "Circuit {n} drops {pct}% over {L} ft; use {awg} AWG or move the panel." | NEC 210.19(A) Info. Note 4 (recommendation) |
| `mep.electrical.panel.undersized` | warn | demand amps (220.102) > panel / feeder OCPD rating, or disconnect < 60 A | "Calculated demand {A} A exceeds the {P} A panel." | NEC 220.102; 215.2; 225.39(D) |
| `mep.electrical.panel.location` | warn | panel inside a `pen`, `wash`, `feed` or `hay` zone, or working space < 30" × 36" | "Panel is in the {zone}; put it in a dry, dust-free utility/tack room with 30\" × 36\" clear." | NEC 110.26(A); 547.5(C); Penn State |
| `mep.electrical.panel.spares` | info | < 20% spare spaces after assignment | "Panel has {k} spare spaces; barns grow — leave 20%." | Industry (SPEC §29) |
| `mep.electrical.feeder.voltageDrop` | warn | feeder VD > 3% at breaker rating (info when > 3% only at full rating but ≤ 3% at demand) | "Feeder drops {pct}% over {L} ft at {A} A; use {size} {material}." | NEC 215.2(A) Info. Note 2 |
| `mep.electrical.feeder.burial` | warn | feeder method cover < 18" (PVC) / 24" (UF, USE, under drive), or riser unprotected | "Feeder trench needs {d}\" of cover for {method}." | NEC Table 300.5; 300.5(D) |
| `mep.electrical.feeder.grounding` | warn | no grounding electrode at the barn, 3-wire feeder, or neutral bonded in the subpanel | "Barn panel needs a 4-wire feeder, isolated neutral and its own ground rods." | NEC 250.32(A)/(B)(1); 250.53(A)(2) |
| `mep.electrical.feeder.egcInsulated` | info | bare EGC specified in the buried feeder | "Use an insulated copper EGC underground in an agricultural location." | NEC 547.5(F) |
| `mep.electrical.lighting.belowTarget` | info | achieved fc < zone target (§2.1) | "{zone} reaches {fc} fc; target {target} fc — add a fixture or raise lumens." | Species:extension-equine; ASABE EP344.4 |
| `mep.electrical.lighting.stallMinimum` | info | pen / room / bay with no luminaire | "{zone} has no light fixture." | Industry |
| `mep.electrical.lighting.guarded` | warn | luminaire in a `pen`/`kidding`/`hay` zone below 132" without a guard, or not vapor-tight / wet-listed in `wash` | "Fixture {tag} is within reach / unprotected; use a guarded vapor-tight fixture or mount ≥ 11'." | NEC 547.8 (2023: 547.31); 410.10(A); Penn State |
| `mep.electrical.lighting.exteriorDoor` | info | exterior door with no exterior luminaire within 6' | "No exterior light at {door}." | Industry; Rutgers / Penn State |
| `mep.electrical.switch.manDoor` | info | man door with no switch within 5' inside | "No light switch at {door}." | Industry (NEC 210.70 analogue) |
| `mep.electrical.switch.aisle3way` | info | aisle with doors at both ends and lighting controlled from one end only | "Aisle lighting needs 3-way switches at both ends." | Industry |
| `mep.electrical.wiring.nmExposed` | warn | NM-B cable anywhere in an animal / wash / exterior area, or UF/MC exposed below 90" in an animal area | "Exposed cable {run} in an animal area; use PVC conduit or raise the run above 7'6\"." | NEC 547.5(A)/(2023: 547.20); 334.10/334.12; 340.12; 300.4 |
| `mep.electrical.wiring.height` | info | conduit run below 90" in a `pen` not behind a kick-wall | "Conduit at {h}\" in stall {name} is within reach — route above 7'6\" or behind the kick-wall." | Species:extension-equine |
| `mep.electrical.box.accessible` | warn | junction box behind a kick-wall / stall liner or above a closed ceiling without access | "Junction box {tag} is not accessible." | NEC 314.29 |
| `mep.electrical.conduit.fill` | warn | raceway fill > 40%, or > 9 current-carrying conductors | "Raceway {run} is over 40% fill / needs derating; upsize or add a raceway." | NEC Chapter 9 Table 1; 310.15(C)(1) |
| `mep.electrical.equipotentialPlane` | info | concrete-floored pen with metallic stall fronts or a heated waterer and no plane recorded | "Equipotential plane may be required in {zone}; bond slab reinforcement before the pour." | NEC 547.10 (2023: 547.44) |
| `mep.electrical.service.capacity` | info | any feeder ≥ 100 A, tankless heater, or demand > 100 A | "Have the electrician confirm the house service can carry a {A} A feeder." | NEC 220.83 / 220.87 |

## 9. Cost placeholders (materials only — `rules/materials/prices.ts` format, category `electrical`, `source: "placeholder"`)

National big-box / supply-house list prices, 2025–2026, rounded. **Placeholders, user-editable per project via `model.priceOverrides`, never quotes.** Labor, trenching, permits and inspection are excluded and shown as separate "ask your electrician" lines.

| sku | Description | Unit | Placeholder $ |
|---|---|---|---|
| `elec.light.highBay100` | LED high-bay 100 W, IP65 | each | 110 |
| `elec.light.highBay150` | LED high-bay 150 W, IP65 | each | 150 |
| `elec.light.strip4` | 4' LED vapor-tight strip 40 W | each | 60 |
| `elec.light.wallPack40` | LED wall pack 40 W, photocell | each | 65 |
| `elec.light.guard` | Wire guard for 4' strip | each | 18 |
| `elec.recep.gfci20` | 20 A GFCI duplex, WR/TR | each | 24 |
| `elec.recep.duplex20` | 20 A duplex, WR (on GFCI breaker) | each | 6 |
| `elec.recep.nema650` | NEMA 6-50 receptacle | each | 18 |
| `elec.cover.inUse` | Extra-duty in-use cover, 1-gang | each | 14 |
| `elec.cover.wp` | Weatherproof flip cover | each | 6 |
| `elec.switch.sp` / `elec.switch.3way` | Single-pole / 3-way switch, WP cover included | each | 6 / 10 |
| `elec.box.fs4x` | 1-gang PVC FS box, NEMA 4X | each | 9 |
| `elec.box.sq4` | 4" square box 2⅛" + cover | each | 4 |
| `elec.box.ceiling` | 4" octagon / fixture box | each | 4 |
| `elec.wire.thwn14.lf` | THWN-2 Cu 14 AWG | lf | 0.15 |
| `elec.wire.thwn12.lf` | THWN-2 Cu 12 AWG | lf | 0.22 |
| `elec.wire.thwn10.lf` | THWN-2 Cu 10 AWG | lf | 0.35 |
| `elec.wire.thwn8.lf` / `thwn6.lf` | THWN-2 Cu 8 / 6 AWG | lf | 0.60 / 0.95 |
| `elec.wire.thwn4.lf` / `thwn3.lf` / `thwn2.lf` / `thwn1.lf` | THWN-2 Cu 4 / 3 / 2 / 1 AWG | lf | 1.50 / 1.90 / 2.30 / 2.90 |
| `elec.wire.xhhwAl4.lf` / `Al2.lf` / `Al1.lf` | XHHW-2 Al 4 / 2 / 1 AWG | lf | 0.50 / 0.70 / 0.85 |
| `elec.wire.xhhwAl10.lf` / `Al20.lf` / `Al30.lf` | XHHW-2 Al 1/0 / 2/0 / 3/0 AWG | lf | 1.00 / 1.20 / 1.45 |
| `elec.cable.uf122.lf` / `uf123.lf` | UF-B 12/2 / 12/3 w/G | lf | 0.85 / 1.20 |
| `elec.cable.urd222.lf` / `urd404.lf` | Al URD quadplex 2-2-2-4 / 4/0-4/0-2/0-4 | lf | 1.70 / 3.40 |
| `elec.conduit.emt050.lf` / `emt075.lf` / `emt100.lf` | EMT ½" / ¾" / 1" | lf | 0.90 / 1.30 / 2.10 |
| `elec.conduit.pvc075.lf` / `pvc100.lf` / `pvc125.lf` / `pvc150.lf` / `pvc200.lf` | PVC Sch 40 ¾" / 1" / 1¼" / 1½" / 2" | lf | 0.70 / 0.95 / 1.30 / 1.60 / 2.00 |
| `elec.conduit.fittings` | Fittings, straps, glue (allowance) | — | 20% of conduit |
| `elec.breaker.1p20` | 15/20 A 1-pole breaker | each | 8 |
| `elec.breaker.1p20gfci` | 20 A 1-pole GFCI breaker | each | 50 |
| `elec.breaker.2p20` / `2p30` / `2p50` | 20 / 30 / 50 A 2-pole breaker | each | 18 / 18 / 28 |
| `elec.breaker.2p60` / `2p100` / `2p125` | 60 / 100 / 125 A 2-pole feeder breaker (house panel) | each | 25 / 80 / 95 |
| `elec.panel.60a8` | 60 A 8-space main-breaker subpanel, 3R | each | 85 |
| `elec.panel.100a20` | 100 A 20-space main-breaker subpanel | each | 160 |
| `elec.panel.125a24` | 125 A 24-space main-breaker subpanel | each | 210 |
| `elec.ground.rod` | 8' × 5⁄8" copper-bonded rod + clamp | each | 25 |
| `elec.ground.gec6.lf` / `epBond8.lf` | 6 AWG bare Cu GEC / 8 AWG solid Cu bonding | lf | 0.80 / 0.55 |
| `elec.spd` | Type 2 surge protective device | each | 90 |
| `elec.labor.note` | Labor, trench, permit, inspection | — | *not estimated — ask your electrician* |

## 10. Model and code touch points (proposal — not implemented here)

Backend adds to `BuildingModel` (SPEC §31 lists `/rules/mep/*`; `model.mep` is named in `agents/mep.md`):

```
mep.electrical: {
  panel: { position: Pt; wallId?: Id; ratingA: 60 | 100 | 125 | 200; spaces: number;
           feeder: { lengthFt: number; material: 'cu' | 'al'; method: 'pvcConduit' | 'useDirect' | 'ufDirect';
                     sourceServiceA?: number } };
  devices: { id: Id; kind: CatalogKey; position: Pt; heightIn: number; wallId?: Id; zoneId?: Id;
             mount: 'wall' | 'ceiling' | 'post' | 'exterior'; options?: { gfci?: boolean; wp?: boolean;
             guarded?: boolean; wattsOverride?: number } }[];
  equipotentialPlane?: boolean;   // user attests the slab is bonded
}
```

Derived in `lib/mep` (never stored): `circuits[]`, `runs[]`, `panelSchedule`, `loadCalc`, `lightingReport`, `takeoff`, `findings`. User pins use the existing `model.overrides` (`targetId = device id, field = "circuit"`). `RuleSource` gains `NEC:${string}` (and optionally `ASABE:${string}`); `docs/RULES_INDEX.md` regenerates. Rules go in `rules/mep/electrical/{receptacles,circuits,feeder,lighting,wiring,panel}.ts`, registered in `rules/index.ts`, tested in `tests/rules/mep/`.

### 10.1 Golden test scenarios for QA (`tests/mep/`, `tests/rules/mep/`)

| Fixture | Expect |
|---|---|
| G1 — 12' × 24' two-stall run-in, tack corner, 100' feeder (§4.2 Example B) | 2 circuits; multiwire branch-circuit option and 60 A / 8-space option both offered; 12 AWG Cu at 20 A over 100' = 3.3% → `feeder.voltageDrop` warns, clears with 10 AWG. |
| G2 — the §4.2 36' × 48' four-stall barn, panel mid-aisle, 160' Al feeder | 13 circuits + 5 spares, 100 A panel, schedule identical to §7.1, leg imbalance ≤ 10%, no voltage-drop findings, `equipotentialPlane` info on every stall. |
| G3 — 36' × 96' twelve-stall barn, two openers, welder, tankless heater, panel on the end wall | 125 A panel; `service.capacity` info for the tankless heater; 4 stall circuits of 3; stall lighting promoted to 20 A; `circuit.voltageDrop` warns on the far-end stall circuits and clears when the panel moves to mid-aisle. |
| Boundaries | 10 receptacles on a circuit passes, 11 warns; 79% / 81% loading; branch VD 2.99% / 3.01%; pen luminaire at 132" passes, 131" warns without a guard; device at 48" passes, 47" infos; feeder cover 18" passes, 17" warns. |

## 11. Open questions for Collin / the AHJ

1. House service size and spare capacity (200 A?) and the panel-to-barn trench route length.
2. Own well at the barn, or house water? (`motor.wellPump05` on/off.)
3. Tank water heater (4.5 kW) or tankless? Tankless changes the panel to 150–200 A.
4. Welder or compressor in the equipment bay (50 A circuit, 125 A panel)?
5. Which NEC edition the inspecting jurisdiction uses (2017 / 2020 / 2023) — changes the 547 section numbers on the sheet and the 240 V GFCI question.
6. Generator inlet / transfer switch for winter water (adds an interlock note, no load).

## Sources (search summaries; primary pages were egress-blocked unless noted)

- NEC Article 547 overviews: EC&M "Keeping Up with Changes in NEC Article 547"; NYEIA "Article 547 Agricultural Buildings — 2023 NEC"; Leviton Captain Code "547.5(G) GFCI Protection in Agricultural Buildings"; UpCodes "547.44 Equipotential Planes"; ECmag "Protecting the Barn: wiring installations and equipotential planes"; Electrician Exam Practice "Understanding NEC Article 547"; Clackamas County "Electrical Wiring for Barns, Riding Arenas, Animal Habitat and Feed Storage".
- NEC 300.5 burial depths: NFPA blog "General Requirements for Wiring Methods"; UpCodes "Minimum Cover Requirements"; VoltageLab burial-depth calculator.
- NEC 220 farm loads: Electrical Contractor Magazine "Branch-Circuit, Feeder and Service Calculations" (Parts LXII/LXIII); Mike Holt forum "Farm Demands".
- NEC 430.248 FLCs: EC&M "Motors and the NEC"; Elliott Electric single-phase FLC table.
- Feeder / voltage drop: WireRef "Detached Garage Subpanel Wiring Guide"; wiregaugecalculator.com "Subpanel Feeder Wire Sizing Guide (NEC 215, 250.32, 310.16)"; electricalcalctools.com "100 Amp Wire Size".
- Extension guidance: Penn State Extension "Fire Safety in Horse Stables" and "Fire Prevention Measures for Equine Facilities" (Kirkland, 2022); Rutgers Equine Science Center "Safety Recommendations for the Stable, Barn Yard, and Horse/Livestock Structures"; Extension Horses "Equine Facilities: Stall Barn Lighting"; MWPS-60 *Horse Facilities Handbook* (Wheeler et al.); ASABE EP344.4 (2014, R2019) *Lighting Systems for Agricultural Facilities*.
- Equipment nameplates: K&H / API heated buckets (5 gal 130 W, 16 gal 260 W) via SmartPak, Cashmans, Jeffers listings; LED lumen/watt figures from LED Lighting Supply and HDLED pole-barn guides.
