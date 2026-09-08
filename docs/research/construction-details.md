# Construction details — post-frame barn (Builder / Framer research note)

**Status:** research note, 2026-09-08 · **Owner:** Builder / Framer (`agents/builder.md`) · **Feeds:** `lib/framing/*` (member notes, notches, braces), `lib/bom/hardware.ts` (§12 table), the cut list (§10) and the Build Sequence sheet (§11, SPEC §7.9/§20.4).

**How to read this.** Every number is either code-cited (`IRC:…`, `RCO:…`, `BCSI`), a standard/manufacturer value (`NFBA`, `Simpson`), or industry convention (`Industry`). §13 says which is which and what could not be verified. Nothing here is a substitute for the truss drawings, the door supplier or an engineer where the SPEC says `engineer required`.

**Research method.** `WebSearch` worked through the proxy; `WebFetch` was egress-blocked on every source host tried (nfba.org, strongtie.com, marcometals.com, jlconline.com, metal-panel install guides, county code handouts). So the citations below come from search-result excerpts plus my own knowledge of the NFBA Post-Frame Building Design Manual, the Simpson Strong-Tie catalog, IRC 2021 R602/R802/R403 and common lumber-yard practice — not from reading the documents this session.

**Tool defaults this note is written against** (`lib/model/defaults.ts`, `lib/model/schema.ts`): 6×6 posts, embedded 48", hole 18" dia, pad 18" dia; bays 8'; girts 2×6 face-mounted at 24"; skirt 2×8 × 1 row; carrier 2-ply 2×12; trusses 48" OC, heel 6"; purlins 2×4 on edge at 24"; eave 10'; pitch 4:12; overhang 12". Lumber actuals per `rules/materials/lumber.ts` (2× = 1½", 6×6 = 5½", 2×12 = 11¼"). Model lengths are decimal feet (ADR-0005); the numbers here are in inches because that is how they are cut.

---

## 1. Post-to-carrier connection (truss carrier / header on the bearing walls)

**Default detail: post notched on the inside face, one ply in the notch, second ply lapped, two ½" through-bolts per post.** `postFrame.ts` already puts both carrier plies on the inside face of the posts with the top at the eave; the notch moves ply 1 into the post by 1½".

| Item | Value | Basis |
|---|---|---|
| Notch face | inside face of the post (the carrier side) | Industry |
| Notch depth | one ply thickness = **1½"** (never more than one ply on a 6×6; a 3" notch leaves 2½" of post) | Industry / county post-frame guides |
| Notch height | carrier depth: **11¼"** (2×12) · 9¼" (2×10) · 7¼" (2×8) | geometry |
| Notch top | post top = eave height H (post ends at the eave) | `postFrame.ts` |
| Shoulder (bearing) elevation | H − carrier depth (H − 11¼" for the default) | geometry |
| Plies in the notch | **1** (ply 1). Ply 2 laps ply 1 and is face-nailed to it | Industry |
| Remaining post | 6×6 → 4" × 5½"; 6×8 (7¼" deep) → 5¾"; 4×6 (5½" perpendicular to the wall) → 4"; 3-ply 2×6 → 3" (notch by stopping the inner ply short — no saw notch) | geometry |
| Bolts | **(2) ½" HDG carriage bolts per post per carrier**, washer + nut on the carrier face | Bannock County post-frame guide (1½" notch + two ½" carriage bolts) |
| Bolt length | notched 6×6 + 2 plies: grip 4" + 3" = 7" → **½" × 8"**; unnotched 6×6 + 2 plies: grip 8½" → **½" × 10"**; 3-ply 2×6 notched: grip 6" → ½" × 7"; 6×8 notched: grip 8¾" → ½" × 10" | geometry |
| Bolt positions | 2½" above the carrier bottom and 2½" below the carrier top (NDS edge distance 4D = 2" on the loaded edge); offset ±1" from the post centreline on alternate sides | NDS 12.5 (convention) |
| Ply-to-ply nailing | 16d (3½") at 12" OC, two rows staggered, both plies crowned up | Industry |
| Splices | only over a post; each ply end bears ≥ 2¾" on the post; plies never splice at the same post; (6) 16d each side of a splice in addition to the bolts | Industry |

**The notch carries the roof, the bolts hold it there.** Bearing on the shoulder = 1½" × 5½" = 8¼ in²; at a conservative 1,000 psi compression parallel to grain that is ≈ 8,000 lb per post. Demand for the reference build (30' span, trusses at 4' OC, 40 psf total) ≈ 2,400 lb per truss bearing, ≈ 4,800 lb per 8'-bay post. Two ½" bolts in double shear with the carrier loaded perpendicular to grain are only ≈ 1,000 lb each (NDS Table 12B order of magnitude, ×1.15 snow) — so **an unnotched carrier hanging on two bolts is under-strength for anything but a small shed; the tool should raise `engineer required` for `carrier.notched === false` unless the Structural reviewer supplies a bolt table.**

**Cut layout on the post (in place, after the posts are set and braced):**
1. Shoot the eave line H on every post with a laser (finished floor = 0). Square the line around all four faces.
2. Measure down the carrier depth (11¼") and square that line around: this is the shoulder.
3. On the two side faces gauge 1½" in from the inside face between the two lines.
4. Circular saw at 1½" depth: cut the shoulder line, then kerf every ½" up to the top; knock out with a hammer, pare the shoulder flat with a chisel. The shoulder is the bearing surface: flat, level, ±⅛".
5. Check the shoulders across the wall with a string: adjacent shoulders within 1/200 of the bay (½" at 8'; NFBA) and the whole wall within ¼" (working target).

```
 Elevation, inside face of a bearing-wall post          Plan section at the carrier
 (looking outward)                                       (outside of the wall at the top)

        ── post top = eave H ──                                 girt 2×6  ┌────────────┐ 1½"
   ┌───────────────────────────┐ ┐                              ┌────────┴────────────┴──┐
   │ ply 2 (lapped, 16d @ 12") │ │                              │                        │
   │ - - - - - - - - - - - - - │ │ 11¼" = notch height          │   6×6 post   5½"       │  4" left
   │ ply 1 sits in the notch   │ │   (carrier depth)            │                        │
   │       o   ½" bolt 2½" ↓   │ │                              ├────────┬───────┬───────┤ ← notch 1½"
   │       o   ½" bolt 2½" ↑   │ │                              │ notch  │ ply 1 │ ply 2 │   inside face
   ├───────────────────────────┤ ┘ ← shoulder H − 11¼"           └────────┴───────┴───────┘
   │                           │                                          carrier 2-ply 2×12
   │   post 5½" wide           │
```

**Alternatives.** (a) Structural screws instead of bolts: (4) 0.220" × 8" timber screws (Simpson SDWS / FastenMaster TimberLOK class) per post, two rows staggered, through both plies with ≥ 5" in the post — only with the notch, and only with the screw maker's post-frame tables (`Industry`, unverified values). (b) Trusses landing directly on posts (truss spacing = bay): the truss sits in a 1½" × 5½" notch at the post top or between the plies of a laminated column — outside this tool's default; flag for the truss supplier. (c) 60d ring-shank nails alone (4–6 per post): common on old sheds, not recommended here — no uplift value.

**Eave-girt clash.** The eave girt occupies the top 5½" of the post's outside face, where the upper bolt head lands. Either install the carrier bolts before the eave girt and counterbore the back of the girt ⅝" × ½" at each head, or put both bolts in the lower band (2½" and 5" above the carrier bottom, 3" apart horizontally).

---

## 2. Truss bearing

- **Trusses are never notched, drilled or cut** (BCSI; the truss design assumes the full heel). They bear on top of the carrier; bearing width available = 3" (2 plies) ≥ the usual 1½" minimum on the truss drawing — put "bearing width 3 in" on the truss order (`trussSpec`).
- **Layout** from the same end of the building as the purlins and roof panels; the gable truss face sits flush with the outside of the end-wall girts (`positions[0] = chordT/2`), then 48" OC; the last space is the remainder.
- **Toe-nails:** (3) 16d box (3½" × 0.135") per bearing, two on one side, one on the other (IRC 2021 Table R602.3(1), rafter/truss to plate).
- **Hurricane tie per bearing:** Simpson **H2.5A** (18 ga): (5) 0.131" × 1½" nails into the truss + (5) into the carrier face; allowable uplift ≈ 600–635 lb DF/SP, ≈ 540 lb SPF; lateral ≈ 450/385 lb (Simpson catalog values as reported in search excerpts — verify the current table). Upgrade to **H10A** — (9) 0.148" × 1½" nails each leg, ≈ 1,340 lb uplift SP — when the eave is > 14', the truss spacing is 8' or more, the site is Exposure C with ≥ 115 mph wind, or the Structural reviewer says so. One tie per bearing, same side of the truss at both ends; do not double up on the same nails.
- **End-wall posts** stop at the eave under the gable truss bottom chord (the tool models this): 1 × H2.5A or a twist strap (Simpson LTS/MTS) per post to the chord, plus (2) 16d toe-nails.
- **Truss spacing blocks:** 2×4 × 46½" (48" − 1½") flat on the carrier between truss heels, (2) 16d toe-nails each end; they hold spacing while sheeting, close the heel against birds and give the eave trim/closure a backer. Count = (trusses − 1) per bearing wall. Optional but recommended; purlins on edge do not close the heel.
- **Purlin-on-edge blocking:** 2×4 × 22½" flat blocks between purlins over the gable truss (holds the cantilevered purlins on layout and backs the rake trim), and a 2×6 sub-fascia nailed to the purlin ends/tails at the eave (the eave trim needs it). Count: (purlin rows − 1) per gable end; 1 sub-fascia per eave.
- **Gable-end truss, two cases (`roof.overhangGableIn`):**
  - **ovG ≤ 24" (default):** the purlins cantilever past the gable truss by ovG (the tool already makes purlins `lengthFt + 2·ovG`); the gable truss is a normal-height truss with gable studs at 24" for siding. Backspan rule: the piece that cantilevers must be continuous over ≥ 2 trusses (backspan ≥ 2 × overhang).
  - **ovG > 24" or a sheathed (2' OC) roof:** order the gable truss **dropped by the purlin depth** — 3½" for 2×4 on edge, 5½" for 2×6 on edge, 1½" for flat purlins/2×4 lookouts on a sheathed roof — and run 2×4 lookouts at 24" OC from the first common truss over the dropped truss to a 2×6 fly rafter, (3) 16d each end. Say "dropped-top-chord gable truss, drop = X" on the truss order.
- **Lateral bracing (note only):** web CLR (1×4 or 2×4 continuous lateral restraint at the web midpoint marked on the truss drawing, with 2×4 diagonals every ≤ 20'), bottom-chord CLR at 10' OC, top chord braced by the purlins (BCSI-B3). Temporary ground bracing on the first truss and diagonal top-chord bracing during erection (BCSI-B2). Any truss > 60' span: `engineer required` (already `structural.roof.clearSpanLimit`).

---

## 3. Rafter seat cuts (lean-to)

The lean-to generator (`lib/framing/leanTo.ts`) uses 2×6 rafters at 24" OC, a 2-ply 2×10 header on the outer posts and a 2×10 ledger on the barn wall, default 3:12, dropped 6" below the main eave.

**Rule:** a notch at the end of a rafter may not exceed ¼ of the depth (IRC 2021 R802.7.1.1) → **max 1⅜" deep on a 2×6**, measured perpendicular to the rafter edge. The seat (level) cut equals the width of what it sits on: **3" on the 2-ply header, 1½" on a single ledger**. Lay out with a framing square: hold the pitch (3 or 4) on the tongue and 12 on the blade; plumb lines along the tongue, level lines along the blade.

| 2×6 rafter | 3:12 (θ = 14.04°) | 4:12 (θ = 18.43°) |
|---|---|---|
| Plumb-cut line across the 5½" face (ridge/ledger end, tail) | 5 11/16" (5.67") | 5 13/16" (5.80") |
| Level-cut line across the face (only if a level tail cut is wanted) | 22 11/16" | 17⅜" |
| Birdsmouth on the 3" header: seat (level) cut | 3" | 3" |
| … heel (plumb) cut height | ¾" | 1" |
| … notch depth ⊥ to the rafter (limit 1⅜") | ¾" (0.73") ✓ | 15/16" (0.95") ✓ |
| … HAP, height above the header measured plumb | 4 15/16" | 4 13/16" |
| Birdsmouth on a 1½" ledger: seat / heel / depth ⊥ | 1½" / ⅜" / ⅜" | 1½" / ½" / ½" |
| Largest seat allowed by R802.7.1.1 | 5 11/16" | 4⅜" |
| Rafter slope length per foot of depth | 1.0308 ft/ft | 1.0541 ft/ft |
| 8' / 10' / 12' / 14' / 16' deep lean-to, cut length between bearings | 8'-3" / 10'-3 11/16" / 12'-4 7/16" / 14'-5 3/16" / 16'-5⅞" | 8'-5 3/16" / 10'-6½" / 12'-7 13/16" / 14'-9 1/16" / 16'-10⅜" |
| Drop over that depth | 24 / 30 / 36 / 42 / 48" | 32 / 40 / 48 / 56 / 64" |

Add a 12" tail beyond the header for a drip edge: tail cut length along the slope = 12" / cos θ = 12⅜" (3:12) / 12⅝" (4:12), plumb cut at the end. The generator currently has no lean-to overhang; add `overhangIn` to the lean-to or note it in the cut list.

**Header end (low side):** birdsmouth bearing on top of the 2-ply header (seat 3"), (3) 16d toe-nails (IRC Table R602.3(1)) + **1 × H2.5A per rafter** (an open lean-to sees net uplift; tie every rafter). Because the rafter bears on top, its top edge sits HAP (≈ 4¾"–5") above the header top — the generator should either raise `lowFt` by HAP or drop the header by HAP; right now it draws the rafter top flush with the header top, which only matches a hanger.

**Ledger end (high side), pick one:**
- **Hanger (matches the tool's flush-top geometry):** Simpson **LSSR26Z** slopeable/skewable rafter hanger (adjusts to 45° slope), rafter plumb-cut, top flush with the ledger top; nails per the catalog (10d × 1½" in the round holes, ≈ 10 per hanger — count unverified). No birdsmouth.
- **Bearing on top:** rafter birdsmouthed over the ledger (seat 1½"), (3) 16d toe-nails + 1 × H2.5A; rafter top ends HAP above the ledger. Cleaner for water (no hanger in the weather) but the roof sits ≈ 5" higher at the wall.

**Ledger fastening.** The generator puts the ledger ¾" outboard of the wall line, i.e. over the steel siding (retrofit detail). Through 1½" ledger + ¾" of siding rib, a lag only reaches structure at the posts:
- at every post crossed: **(2) ½" × 8" HDG lag screws** (⅜" pilot, ≥ 4" in the post, 2" from the ledger edges, staggered);
- between posts: **(1) ¼" × 4½" structural screw every 16", staggered top/bottom**, into the 2×6 girt behind (the girt carries the rafters that land between posts; fine for ≤ 8' bays and ≤ 12' depth, beyond that `engineer required`);
- Z-flashing over the ledger top under the siding lap; butyl under the lag heads.
The brief's "½" × 4" lag" only works when the ledger sits directly on a 2× backer (new build: install the ledger before the siding, in place of the girt row it lands on, then the 4" lag or ¼" × 4½" screw at 16" staggered is right). No rafter ties are needed (mono-slope, no ridge thrust).

---

## 4. Knee braces

- **Member:** 2×6 at 45° from the post to the truss beside it (Residential Code of Ohio §328 prescriptive post-frame: "a 2×6 brace from the column to the … truss or rafter adjacent to the post at a 45° angle"; attachment height by RCO Table 328.6 — table not retrieved). One brace per bearing-wall post that carries a truss, on the inside of the wall in the truss plane. With 8' bays and 4' OC trusses every post carries a truss → **count = bearing-wall posts** (corners and jamb posts included).
- **When:** RCO §328's prescriptive path requires them; NFBA's paper *Knee Braces in Post-Frame Buildings* notes they add little to a diaphragm-designed building and load the truss unexpectedly, so an engineered building may omit them. Tool rule: generate them when `eaveHeightFt ≥ 10` or `spanFt ≥ 30` under the prescriptive path; always list them on the truss order so the truss designer accounts for the brace reaction.
- **Geometry:** legs `a` (down the post, out along the truss) equal. Top edge (short edge) = a·√2; long edge (bottom, long point to long point) = a·√2 + 2·w = a·√2 + 11" for a 2×6; both end cuts 45°, parallel (a parallelogram: plumb cut against the post, level cut under the chord). End-cut line across the 5½" face = 7¾".

| legs a | short edge a√2 | long edge (cut length) | stock / pieces per stick (nested 45° cuts) |
|---|---|---|---|
| 24" | 33 15/16" | 44 15/16" | 8' → 2 |
| 30" | 42 7/16" | 53 7/16" | 10' → 2 |
| 36" (default, ≤ 12' eave) | 50 15/16" | 61 15/16" | 12' → 2 · 16' → 3 |
| 42" | 59⅜" | 70⅜" | 12' → 2 |
| 48" (≥ 14' eave or ≥ 40' span) | 67⅞" | 78⅞" | 14' → 2 · 20' → 3 |

- **Fit-up:** the post is 5½" wide and the truss 1½", so a brace flat on the post's side face is 2" off the truss face. Nail a 2×6 × 24" brace block flat to the bottom chord ((6) 16d) and shim ½"; the brace bears on the post face and on the block.
- **Fasteners per brace:** post end **(1) ½" × 8" HDG carriage bolt** (grip 5½" + 1½" = 7") + washer/nut + (2) 16d; truss end **(4) 16d** face nails into the chord/block (RCO §328 minimum is (3) 10d) — or (3) ¼" × 3" structural screws; plus the brace block. Never bolt through a truss chord without the truss designer's OK.

---

## 5. Girts, skirt board, rat guard

**Face-mounted 2×6 girts (default).** Wide face vertical against the outside of the posts, 1½" outboard (matches `postFrame.ts`).
- **Nails:** **(2) 16d HDG ring-shank (3½" × 0.148") per girt–post crossing**; at a splice post each girt end gets its own two → 4 nails at that post. Alternative: (2) #10 × 3½" structural screws.
- **Splices** only at post centrelines: with a 5½" post each end bears 2¾". **Stagger**: adjacent rows never splice on the same post; row r starts with a 1-bay piece when r is even, a 2-bay piece when r is odd (§10 gives the stick rule).
- **Alignment:** individual girt slope ≤ 1% (NFBA Accepted Practices) — 1" in 8' is the limit, a string every third row keeps it under ¼"; row spacing **±½"** (working target from NFBA's "spacing within ½"" language). Girts stop at rough openings (the generator's `freeSegments`), with a 2×6 on edge between girts at each jamb.
- **Corners:** the side-wall girt runs long to the outside of the end-wall girt; the end-wall girt butts to it; (3) 16d through the lap into the corner post.

**Bookshelf girts (`girts.mount = "bookshelf"`, between posts, flat).** Length = clear bay − ⅛" (8' bay, 6×6: 96 − 5½ − ⅛ = **90⅜"**; two from a 16' stick). Each end: **Simpson PF26 post-frame hanger** (18 ga top-flange hanger, 10d nails driven through the guide holes at an angle — schedule per catalog) **or** a 2×4 bearing block 22½" long flat on the post between girts with (2) SDWS 0.160" × 3" screws each (Hansen's commercial-girt detail) and (2) 16d toe-nails from the girt into the block. No stagger is possible; the inside finish comes out flush. The generator still renders bookshelf as face-mounted — geometry change pending.

**Skirt (splash) board.** PT **2×8 UC4B**, one row (default) with the bottom 3" below finished floor; grade is 4–6" below the floor (ADR-0009), so the tool's skirt bottom is 1–3" *above* grade — set `skirt.rows = 2` or lower the skirt to grade − 2" so soil never touches steel (Hansen: 4–6" of treated plank exposed, siding held ≥ 4" up from the plank bottom).
- **Nails:** **(3) 16d HDG ring-shank per post** for a 2×8 (2 for a 2×6); butt splices at posts; corners lapped like the girts. Level it with the laser — it is the datum for the girt layout and the siding bottom.
- **Barrier:** treated lumber corrodes galvanized/Galvalume steel — an **8"-wide strip of 15-lb felt, house-wrap or 6-mil poly** between the skirt and the steel/rat guard, the full perimeter (a 36" × 144' roll cut in 4 strips covers 576 lf).
- **Rat guard / base trim:** formed base trim with a lip that closes the panel ribs, screwed to the skirt at 24" with #10 × 1" screws, panel bottom held 1"–4" above the skirt bottom and never in contact with soil, gravel or concrete. Count = wall perimeter − door widths.

---

## 6. Posts in the ground (and the bracket-on-pier alternative)

| Item | Rule | Default (6×6, Cleveland-area frost 36" — verify) | Basis |
|---|---|---|---|
| Hole diameter | ≥ post + 2 × 6" collar; 24" for 6×8 or high wind | **18"** | SPEC §20.1 / Industry |
| Hole depth | max(frost + 6", 48", ¼ post length); footing below frost | **48"** (frost 36" + 6" = 42" → 48" governs) | IRC R403.1.4.1 (below frost) / Sutherlands rule of thumb |
| Footing pad | poured 18" dia × 8–9" (tool: ½ dia = 9") or precast "cookie" ≥ 18" × 6"; post bears on concrete, never soil | 1.2–1.3 cu ft = **2–3 × 80-lb bags** (0.6 cu ft/bag) | Industry |
| Collar (default) | 12"-tall collar on top of the pad around the post, remainder backfilled | 18" hole, 12" collar − post = 1.6 cu ft = **3 bags** | Hansen / DIY Pole Barns |
| Full-depth concrete (what `PostScheduleRow.concreteCuFt` computes) | hole − post volume | 7.07 − 0.84 = 6.2 cu ft = **11 bags** or 0.23 cu yd per post | `postFrame.ts` |
| Uplift cleats | **(2) PT 2×6 × 12"** blocks, one on each of two opposite faces, parallel to the wall so they fit the hole, bottom flush with the post bottom, **(2) ½" × 5" HDG lag screws each** (or (6) 60d RS each) | 2 blocks + 4 lags per post | DIY Pole Barns / Hansen |
| Rebar (with a collar) | **(2) #4 or #5 × 9"** through ⅝" holes at 3" and 9" up from the bottom, perpendicular to each other, ends inside the concrete (≥ 1½" cover) | 2 per post | DIY Pole Barns / Hansen ("high-wind option") |
| Backfill | native soil or ¾" crushed stone in 6"–8" lifts, hand-tamped; no topsoil/organics; crown at grade | — | NFBA / Industry |
| Post | UC4B ground-contact PT; do not cut the treated bottom; field-treat any cut with copper naphthenate | — | AWPA U1 use category (via SPEC §19.1) |
| Temporary bracing | (2) 2×4 × 8' braces to stakes per post, duplex nails; stay until carriers, girts and end-wall braces are on | — | Industry |

**Bracket-on-pier alternative** (`post.foundation = "bracketPier"`): 12"–18" Sonotube piers to frost depth + 6" on a 24" × 8" footing (or Perma-Column precast piers), posts untreated above the bracket (UC3B for the bottom foot is cheap insurance).

| Bracket | Anchoring | Post attachment | Notes |
|---|---|---|---|
| Simpson **CBSQ66-SDS2** | wet-set in the pier (embedded plate), 1" standoff | SDS screws supplied | highest uplift of the Simpson wet-sets |
| Simpson **PBS66** | wet-set, 1" standoff | (14) 16d HDG or (2) ½" machine bolts | light duty |
| Simpson **ABU66Z** | drill-set on a ⅝" anchor bolt (J-bolt or Titen HD; diameter to verify), 1" standoff, slotted base | (12) 16d or SD screws | slot allows ±¼" post placement |
| Perma-Column **Sturdi-Wall SW66** (drill-set) / **Sturdi-Wall Plus** (wet-set rebar legs) | ½" wedge anchors into cured concrete (count per the SW design manual — typ. 2–4) / rebar legs in wet concrete | **(2) ½" through-bolts** with flat washer under the head, flat + lock washer + nut, **110–120 ft-lb** | the post-frame standard; the Plus version is the moment-resisting one for piers/stem walls |

A bracket foundation loses the embedded post's fixity: the building then relies on diaphragm action, knee braces or a moment bracket. Rule: `bracketPier` with eave > 12', open sides (lean-to, run-in) or bays > 10' → `engineer required`; otherwise note "moment-rated bracket (Sturdi-Wall Plus or equal)".

---

## 7. Roof and wall steel

**Panel:** 29 ga (26 ga upgrade), **36" net coverage, ¾" major ribs at 9" OC** (5 ribs per panel counting the lap rib), Galvalume/painted; cut to length by the supplier in 1" increments; keep panels ≤ 24' for handling (a 40' roof slope needs an end lap).

**Screws** (color-matched, HWH with bonded EPDM washer, driven until the washer just bulges):
- **#10 × 1"** panel-to-wood in the flat (walls into girts, roof into purlins); **#10 × 1½"** wherever the screw passes a lap, closure or trim; #10 × 2" only for on-rib fastening (not used by default).
- **¼" × ⅞" (#12) lap "stitch" screws** panel-to-panel at every side lap: **24" OC on roofs, 36" OC on walls** (12" in high wind).
- Trims: #10 × 1" into wood at 12" OC, stitch screws trim-to-panel at 12"–18".

**Pattern per 36" panel per row** (Metal Sales / ABC-style 29-ga install guides, as reported): eave, ridge and end-lap rows = a screw **on each side of every major rib** = **8**; intermediate purlin/girt rows = **one screw per rib spacing, alternating sides** = **4, +1 through the lap rib = 5** on roofs; walls use 4 in the field and 8 at the base and eave rows.

**Formulas for `lib/bom/hardware.ts`** (`rows` = purlins crossed by the panel; wall rows = girt rows + skirt):
```
roofScrewsPerPanel = 2·8 + 5·(purlinRows − 2)          // 10 rows → 56
roofStitchPerPanel = ceil(panelLengthIn / 24)          // 17' panel → 9
wallScrewsPerPanel = 2·8 + 4·(girtRows + 1 − 2)        // 5 girt rows + skirt → 32
wallStitchPerPanel = ceil(panelLengthIn / 36)
```
Sanity check: the lumber-yard rule of thumb is ≈ 80 screws per square (100 sq ft) at 24" purlins; the formula gives ≈ 100–110 per square because it counts the heavy eave/ridge rows properly. Add 5% waste (SPEC §7.8).

**Closures:** outside foam closure under the panel at the eave (1 per roof panel; also at the top of wainscot and under the eave trim on walls if the building is closed); inside closure under the ridge cap, both sides (2 per roof panel) — vented closure if a ridge vent is specified.

**Lengths and allowances**
- **Roof panel length** = (span/2 + eave overhang)/cos θ + 2" drip past the sub-fascia − 1" ridge gap (each side leaves 1"–2" under the cap; 2"–3" for a vented ridge). Reference build 30' × 4:12 × 12": run 16' → slope 202.4" → **order 204" (17'-0")**. Panels per plane = ceil((length + 2·ovG)/3').
- **Wall panel length** = eave height H − panel-bottom height (skirt bottom + 4" hold-up → 1" above the floor with the tool's skirt) → order **H − 1"** rounded up to the inch; the eave trim covers the top. Gable panels: schedule stepped lengths — each successive 36" panel changes by 36 × pitch/12 = 12" at 4:12, 9" at 3:12.
- **Side lap** = one rib (already netted in the 36" coverage). **End lap** (only when a slope needs two panels) = **6" over a purlin with butyl tape sealant**, fastened through both panels. Panels overhang the eave trim 1½"–2".
- **Lap direction:** start at the end away from the prevailing wind so laps face downwind; check every 5 panels that coverage = 15'-0" ± ¼" (panels creep).

**Trims per building** (10' sticks, 4"–6" laps → count = ceil(run / 9.5') + 1 spare per 10; formed trim can be ordered up to 20'+ to cut laps):

| Trim | Run | Notes |
|---|---|---|
| Eave trim / drip edge | 2 × (L + 2·ovG) | on the 2×6 sub-fascia, under the roof panels |
| Rake (gable) trim | 4 × slope length | + 2 × lean-to rakes; 4 peak caps |
| Ridge cap | L + 2·ovG | + vented closure if ridge vent |
| Outside corner trim | 4 × H | + lean-to corners |
| Base trim / rat guard | perimeter − door widths | over the PT barrier (§5) |
| J-channel | windows: 2H + W (sides + bottom) · man doors: 2H + W | head gets a drip/head trim instead of J |
| Door jamb trim (overhead, sliding) | 2H + W per door | covers the 2×6 jamb boards; sliding doors add a track cover/rain hood = track length |
| Head / drip trim | W + 6" per window and door | installed last, laps over the side J |
| Wainscot Z / transition | perimeter | only with wainscot |
| Inside/outside closures, butyl tape, touch-up paint | see above | tape: ≈ 1 × 50' roll per 6 roof panels with end laps |

---

## 8. Openings (framing + hardware, per the tool's `DOOR_PALETTE` / `WINDOW_PALETTE`)

**Sliding doors (8×8, 10×10, 12×12, bi-parting 16×12)** — box-rail or round-rail hardware, 400–600 lb class (Cannonball-type):
- **Track length = 2 × opening width** (single leaf: 16'/20'/24'; bi-parting 16': 32' total, 16' each way), from 6'/8'/10'/12' stock with splice bars; **brackets 1 per 24" + 1** (track length/2 + 1) on a **2×8 track board** = track length, lagged to the header/eave girt with ⅜" × 4" lags at 16"; the track hangs the leaf ≈ 3" off the wall (the tool models 3").
- **Per leaf:** **(2) trolleys** (450 lb each — a 12×12 steel-skinned wood leaf is 250–350 lb), **1 stay roller** (or a stay guide ≥ 60% of the leaf width), **1 latch** (bi-parting: 1 centre latch + cane bolts), **2 stops** per track run (1 per end), pull handles. Leaf size: width = opening + **6"** (3" overlap per side minimum; the tool draws 6" per side, which is also common for a rain lap) — height = opening + 3"–4" with 1" floor clearance. Leaf frame: 2×4 perimeter, rails at 30" OC, one diagonal, 29-ga steel; or a bought "sliding door frame kit" (2 verticals, bottom rail with rear stop, top rail). Rain hood/track cover = track length; jamb trim 2H + W.
- **Framing:** header per the opening (the `postFrame.ts` placeholder draws a single-ply 2×10 for 8'–12' openings and 2×12 above; use 2 plies as for overhead doors), jamb posts at ≥ 8' (`JAMB_POST_MIN_WIDTH_FT`); 2×6 PT jamb boards on the jamb posts for the leaf to close against; concrete apron (ADR-0009).

**Overhead (sectional) doors (9×8, 10×10, 12×12, 16×12):**
- **Jamb posts each side; RO = door width × door height** (the door mounts behind a "picture frame" of jamb boards); **header: 2-ply 2×12 × W between the jamb posts for 10' and 12' doors** (Hansen: 2×12 SPF for all large openings), each end on a Simpson HUC212-2 concealed-flange hanger or a 2×6 × 12" bearing block lagged to the post ((3) ⅜" × 4"); the alternative is a face-mounted header W + 11" lapping the posts with (2) ½" × 8" carriage bolts each end. 16' → 3-ply 2×12 or LVL, `engineer required`. The generator's placeholder gives 2×10 at 8'–12' — change to 2×12 for overhead doors ≥ 10' (Structural to confirm the table).
- **Clearances:** headroom **12"** above the opening for standard-lift torsion hardware (the tool's `OVERHEAD_DOOR_HEADROOM_FT = 1`), 14"–15" with an opener, 18" for commercial hardware; **side room ≥ 3¾"** (5½" recommended for torsion springs) each side from the RO to the next obstruction; **backroom = door height + 18"** (+ 4'-6" with an opener rail). Roll-up: 18" headroom (tool: 1.5').
- **Jamb boards:** **(2) 2×6 PT** verticals (2×8 with non-steel siding) + **(1) 2×6 head**, flush with the inside of the door-jamb trim, **#10 × 3" screws at 16"** into the posts/header; vinyl weather-stop 2H + W; door, tracks, springs and opener by the supplier — print "verify with door supplier" on the callout.

**Man doors (3'0" × 6'8", 2'8", half-light) and double 6'/8':**
- **RO = unit + 2" wide × unit + 2" tall** → **38" × 82"** for a 36" pre-hung (34" × 82" for a 32"; 74" × 82" double 6'). The wall is only ≈ 2¼" thick (girt + steel) so the pre-hung unit needs a **2×6 buck**: 2×6 on edge each side between the skirt and the header girt (the generator's `jamb` members), 2×6 head, PT threshold plate on the slab.
- **Fasteners:** (12) #10 × 3" screws through the jambs into the buck (6 per side, at 16"), (2) 3" screws per hinge into the buck (6), shims at each screw, low-expansion foam, 1 drip cap W + 6", J-channel 2H + W, 1 lockset/deadbolt, sealant.

**Windows (2×3 … 6×4, sill 3'–5'):**
- **RO = unit width + ½" × unit height + ½"** for nail-fin vinyl (or the maker's RO); framing: 2×6 jambs girt-to-girt, 2×6 flat sill at `sillFt`, 2×6 flat head; fin screws **#8 × 1⅝" at 12"** (≈ 2 per foot of perimeter).
- **Flashing sequence on a steel-sided wall with no WRB** (shingle fashion — bottom, sides, top): (1) sill pan — 6" self-adhered flashing across the sill and 6" up each jamb, or a bent Z-pan 12" longer than the window; (2) set the unit on the pan in a bead of sealant behind the side and head fins only (leave the sill fin unsealed to drain); (3) tape the side fins; (4) tape the head fin over the sides; (5) steel: J-channel both sides and the sill piece with weep notches, panels cut ¼" short; (6) **head/drip trim last**, lapping over the side J and under the panel above; (7) seal the side J to the frame, never the sill.

---

## 9. Stall hardware (site-built stall fronts and partitions, 12×12 horse stall)

Assumed stall: 12' front on the aisle (4' sliding door + 8' fixed section, grille top) and 12' partitions between stalls (kick wall + grille); posts at 12' bays or interior 6×6/4×6 stall posts. Counts are per **section** (one wall between two posts) and per **door**; a stall = 1 front + shared partitions.

| Component | Spec | Count per 12' section | Fastening | Basis |
|---|---|---|---|---|
| Stall U-channel | **1⅝" (16 ga) galvanized × 8'** (fits 1½" T&G; 1.8" 14-ga heavy option), one per post face, full height so boards and grille both drop in | 2 | **(6) ¼" × 3" lag/structural screws** per channel through the pre-punched holes (12"–16" OC) | American Stalls / RAMM / Spring Creek listings |
| Kick wall | 2×6 T&G (1½" × 5⅛" face), **4'-3" high = 10 boards**, cut to clear + ¼" (12' bay with 6×6 → 138¼") | 10 | drop into the channels; (2) #10 × 3" screws through the channel holes per board end | Industry |
| Grille | 42" tall welded 1" tube on 3" OC (horse) or 4×4 6-ga welded mesh in an angle frame (goat/sheep), section length − ¼" | 1 (8' section on the front, 12' on partitions) | drops into the channel above the boards; **(2) ⅜" × 3" lags per end** through the frame tabs; optional 2×6 cap | Industry |
| Sliding stall door 4' × 8' | leaf 4' (T&G bottom, 45" grille top, steel frame or 2×4/steel) | 1 per stall | **8' track, 5 brackets** (8/2 + 1), **2 trolleys, 2 stops, 1 stay roller/floor guide, 1 slide-bolt latch, 1 handle**; 2×8 × 8' track board with (4) ⅜" × 4" lags into the posts/header | RAMM / Country Mfg stall-door kits |
| Swing gate (tube gate 4'–6' or steel-frame swing door) | 2 hinge points | 1 per opening | **(2) ½" × 8" screw-hook hinge pins** in ⁷⁄₁₆" pilots + the gate's 2 straps; **1 two-way lockable latch** (or chain + snap); 1 hook-and-eye hold-open | Industry |
| Dutch door 4' × 8' (exterior stall door) | 2 leaves | 1 per stall (if run-outs) | **(4) 12" heavy T-hinges** with (12) ⅜" × 2½" carriage bolts; **(2) slide latches** (1 per leaf) + 1 leaf-to-leaf bolt; 1 steel chew guard 4' on the lower leaf; 1 hold-open | Industry |
| Feeder / hay rack | corner feeder + wall rack | 1 + 1 | corner feeder **(4) ¼" × 2" lags**; hay rack **(4) ⅜" × 3" lags** | Industry |
| Automatic waterer | wall-mount frost-free with heat trace | 1 | **(4) ⅜" × 3" lags** into a 2×8 backer between the kick boards; ½" supply + GFCI heat-trace outlet (MEP) | Industry |
| Small hardware | bucket hooks, halter hook, blanket bar, salt holder | 2 + 1 + 1 + 1 | #10 × 2" screws | Industry |
| Mats | 4' × 6' × ¾" rubber | 6 per 12×12 stall | loose-laid over screened base | Industry |

Placement rules already in the SPEC (§24): no waterer in a trap corner, no feeder under a window, no fixture in the door swing.

---

## 10. Cut-list rules the tool should apply

**End cuts by member** (code the cut list as P = plumb, L = level, B = birdsmouth, 45 = 45° parallel ends, N = notch, S = square):

| Member | Ends | Notes |
|---|---|---|
| Post (bearing wall) | S bottom (never cut the treated end), S top at H, **N** 1½" × carrier depth on the inside face | §1 |
| Post (end wall, lean-to outer) | S / S | lean-to header sits on the post top |
| Carrier, header, girt, skirt, purlin, plate, blocking | S / S | joints only over posts/trusses |
| Lean-to rafter | **P** at the ledger (hanger) or **B** 1½" (bearing), **B** 3" at the header, **P** tail | §3 |
| Knee brace | **45 / 45** parallel | long edge = a√2 + 11" (§4) |
| End-wall diagonal brace (2×6 X in the corner bays) | angled ends at atan(rise/run) — not 45° | per bay geometry |
| Trusses | none — supplier | never field-cut |
| Gable ladder lookouts, sub-fascia, fly rafter | S / P | only when ovG > 24" |

**Stock selection.** `stockLength()` already picks the shortest stock ≥ length. Add pairing: cut *n* pieces from one stick when `n·L + (n−1)·⅛" ≤ stock` and the leftover beats the sum of singles' leftovers. For 45°-ended pieces the shared cut saves w·√2 per joint: `n·L_long − (n−1)·7¾" ≤ stock`. Examples: two 46½" spacer blocks from one 8'; two 90⅜" bookshelf girts from one 16'; two 61 15/16" knee braces from one 12' (three from a 16'); two 46" T&G door boards from one 8'.

**Continuous girts and purlins — "2 bays per stick where possible", joints only on supports, adjacent rows never joint on the same support:**

| Support spacing | Face girts / skirt (butt at post centres, piece = k × bay exactly) | Purlins on edge (lapped 12" past the truss, piece = k × spacing + 12") |
|---|---|---|
| 8' bays / 4' trusses | 16' = 2 bays (default); odd rows start with an 8', even rows with a 16'; last piece = remainder | 13' from 14' stock = 3 spaces + lap (7% waste); rows alternate starting with 9' from 10' (2 spaces + lap) |
| 10' bays | 20' = 2 bays; alternate rows start with a 10' | — |
| 12' bays | 12' = 1 bay (no stagger possible; order 24' where the yard has it) | — |
| Trusses at 2' OC (sheathed) | — | no purlins; sheets |
| Butt-with-block option (zero waste) | — | piece = k × spacing exactly (8'/12'/16' at 4' OC), 2×4 × 12" splice block under the joint, (4) 16d each side |

Lapped purlins offset the next run by 1½"; alternate the offset side each row so panel screws still find the purlin. Cantilevered gable pieces (ovG) must be continuous over ≥ 2 trusses. Keep the SPEC's 10% lumber waste for the BOM; a stagger-aware cut list usually lands at 3–6%.

**Cut-list line:** member kind · nominal · treatment · count · cut length (ft-in to ⅛") · end codes · stock length · pieces per stick · rule ref (`ruleRef` from the member).

---

## 11. Build sequence checklist (with checks and tolerances)

Tolerances: **NFBA** = *Accepted Practices for Post-Frame Building Construction: Framing Tolerances* (values as reported in search excerpts); **BCSI** = SBCA/TPI BCSI-B1 Table B1-2; **target** = the tighter working number from the project brief that a good crew hits (the tool prints both).

1. **Site prep** — strip topsoil, cut/fill, compact; pad 4–6" above finished grade, ¾" crushed base; grade falls 2% (¼"/ft) for 10' all round. *Check:* pad extends ≥ 5' past the walls.
2. **Batter boards and lines** — corners from the plan; strings on the **outside girt face** (the wall line, ADR-0006), boards 4' outside. *Check:* diagonals equal within **¼"** (30×40 → 50'-0"; 36×48 → 60'-0"; 24×36 → 43'-3¼"); 3-4-5 at each corner.
3. **Mark post centres** — per the post schedule: corner posts inset one girt thickness + half a post from the wall start (1½" + 2¾" = 4¼" with 6×6 posts and 2×6 girts — `cornerInset` in `postFrame.ts`), then the bay module. *Check:* spacing within **2"** of plan, each post within **¾"** of the average (NFBA); target ±½".
4. **Dig holes** — 18" × 48" (or frost + 6"); auger; keep water out. *Check:* depth −0/+2"; hole centred on the post mark ±2".
5. **Footings** — pour 8–9" pads (or set precast); rebar/cleat blocks fixed to the posts. *Check:* pad top ±½" (posts are cut in place later, so this is loose).
6. **Set posts** — notch face inward, cleats parallel to the wall, plumb both ways, 2 braces each. *Check:* plumb ≤ **1% of height** (NFBA — 1¼" at 10'); **target ¼" in 8'**; outside face **1½" inside the string** everywhere within ¼"; surface slope ≤ 1.5%.
7. **Collars / backfill** — 12" collar (or full pour), backfill in 6" lifts and tamp; leave braces up.
8. **Eave line** — laser from the floor datum; mark H on every post. *Check:* all marks within **¼"** (target); adjacent bearing points within **1/200 of the bay** (NFBA: ½" at 8').
9. **Cut post tops and notches** — §1. *Check:* shoulders level ±⅛" across, ±¼" post-to-post.
10. **Carriers** — ply 1 into the notches crown up, ply 2 lapped, bolts, splices at posts and staggered. *Check:* top string-straight within ¼"; no two plies spliced at one post.
11. **Skirt board** — bottom line from the laser, level. *Check:* ±¼" along the wall; it is the girt datum.
12. **Girts** — layout up from the skirt at 24" (or per the generator), splices staggered, stopped at openings. *Check:* spacing **±½"**, slope ≤ **1%** (NFBA), string every third row.
13. **Rough openings** — headers, 2×6 jambs and sills, jamb boards. *Check:* RO +0/−⅛", diagonals equal within ⅛", plumb ⅛" over the height.
14. **End-wall diagonals and corners** — 2×6 X-bracing (or strap) in the corner bays, both end walls. *Check:* corner posts still plumb after bracing.
15. **Trusses** — layout on both carriers from the same end; gable truss first, ground-braced (BCSI-B2); then 48" OC with spacer blocks, toe-nails and ties. *Check:* spacing ±½" at the bearings; plumb ≤ **D/50 or 2"**, bow ≤ 1/200 of the length (BCSI); heel centred on the 3" bearing.
16. **Truss bracing** — temporary top-chord diagonals; permanent web CLR and bottom-chord CLR per the drawing. *Check:* every marked web has its restraint before loading.
17. **Purlins** — from the eave up at 24" along the slope, lapped/staggered, cantilevered at the gables. *Check:* every row string-straight within **¼"** (screws must find them), spacing ±½".
18. **Knee braces, sub-fascia, fly rafters, gable studs, eave blocking.** *Check:* brace bolts snug, blocks tight.
19. **Roof prep** — eave trim on the sub-fascia, outside closures. *Check:* eave line straight; first panel square to the eave (overhang equal at both ends within ⅛").
20. **Roof panels** — start at the downwind gable, 2" eave overhang, screw pattern, stitch screws, end laps 6" with tape. *Check:* coverage 15'-0" ±¼" every 5 panels; ridge gap 1"–2"; no "dimpled" screws that missed a purlin.
21. **Ridge cap, closures, vents, rake trims and peak caps.** *Check:* cap laps 6" with sealant, screws into purlins through the closure.
22. **Wall steel** — base trim over the PT barrier, first panel plumb within ⅛" in 10', screw pattern, J-channels and head trims at openings, corner trims. *Check:* panel bottoms 1"–4" above the skirt bottom and clear of soil; laps downwind.
23. **Slab** — 4" over 4" gravel with vapour barrier where finished, fibre or 6×6 mesh, control joints ≤ 12' OC, thickened edges at doors/aprons, wash-bay slope, ½" isolation at the posts. *Check:* top at the 0 datum ±¼"; thresholds sit on concrete.
24. **Doors and windows** — overhead doors by the supplier; sliding-door track boards, track, leaves; man doors; windows per §8. *Check:* sliding leaf plumb, 1" floor clearance, latch engages; overhead RO square.
25. **Interior** — stall channels, kick boards, grilles, doors, mats, feeders, waterers; electrical rough-in before liners (MEP). *Check:* channels plumb, boards tight, latches horse-proof.
26. **Close-out** — sealant at J-channels and ridge, touch-up paint, gutters (optional), aprons and grading, punch list (washers compressed not crushed, no missing braces or blocks, treated wood nowhere in contact with steel).

---

## 12. Hardware per unit (what `lib/bom/hardware.ts` implements)

Units: *per post* = every post; *per bearing post* = posts under a carrier; *per truss bearing* = 2 per truss; *per crossing* = one member crossing one support; *per panel* = one 36" panel; *per opening* = one door/window; *per section* = one stall wall between posts.

| Item | Unit | Qty | Typical spec | Source |
|---|---|---|---|---|
| Footing pad concrete | per post | 1.3 cu ft (2–3 bags) | 18" × 9" pad, 3,000 psi bagged mix, 0.6 cu ft per 80-lb bag | Industry |
| Collar concrete (default) | per post | 1.6 cu ft (3 bags) | 12" collar in an 18" hole | Hansen / DIY Pole Barns |
| Full-depth concrete (alt., what the schedule computes) | per post | hole − post = 6.2 cu ft (11 bags) | 18" × 48" | `postFrame.ts` |
| Uplift cleats | per post | 2 blocks + 4 lags | PT 2×6 × 12", ½" × 5" HDG lag screws | DIY Pole Barns / Hansen |
| Rebar | per post | 2 | #4 × 9" (or #5), at 3" and 9" up, crossed | DIY Pole Barns |
| Temporary braces | per post | 2 (reusable) + 4 duplex nails | 2×4 × 8' | Industry |
| Post bracket (alt. foundation) | per post | 1 | CBSQ66-SDS2 (wet) / ABU66Z + ⅝" anchor (drill) / Sturdi-Wall SW66 + wedge anchors + (2) ½" bolts | Simpson catalog / Perma-Column (see §13) |
| Carrier bolts | per bearing post, per carrier | 2 | ½" × 8" HDG carriage bolt + nut + washer (½" × 10" if unnotched) | Bannock County guide / NDS |
| Carrier ply nails | per lin ft of carrier | 2 | 16d, two rows staggered at 12" | Industry |
| Carrier splice nails | per splice | 6 | 16d each side of the joint | Industry |
| Girt nails | per girt–post crossing | 2 (4 at a splice post) | 16d HDG ring-shank 3½" × 0.148 | Industry (brief) |
| Skirt nails | per skirt–post crossing | 3 (2×8) / 2 (2×6) | 16d HDG ring-shank | Industry |
| PT barrier strip | per lin ft of skirt | 1 lf × 8" wide | 15-lb felt / house-wrap / 6-mil poly | Hansen |
| Bookshelf girt hanger | per girt end | 1 (+ nails per catalog) | Simpson PF26 (or 2×4 × 22½" block + 2 × SDWS16300) | Simpson / Hansen |
| Truss toe-nails | per truss bearing | 3 | 16d box, 2 + 1 | IRC:R602.3(1) |
| Hurricane tie | per truss bearing | 1 + 10 nails | H2.5A, 0.131 × 1½" (H10A + 18 × 0.148 × 1½" upgrade) | Simpson catalog |
| End-wall post to gable truss | per end-wall post | 1 tie + 2 toe-nails | H2.5A or LTS/MTS strap, 16d | Industry |
| Truss spacer block | per truss space, per bearing wall | 1 + 4 nails | 2×4 × 46½", 16d | Industry |
| Purlin to truss (on edge, lapped) | per crossing | 2 nails | 16d RS toe-nails (or 1 × 60d RS through the lap / 1 × ¼" × 4½" screw) | Hansen / APB / FBi (convention) |
| Purlin to truss (flat) | per crossing | 2 | 20d HDG ring-shank | Hansen |
| Purlin lap | per lap | 3 | 16d through the lap | Industry |
| Purlin splice block (butt option) | per joint | 1 block + 8 nails | 2×4 × 12", 16d | Industry |
| Gable purlin blocking | per gable end | purlin rows − 1 | 2×4 × 22½" + 4 × 16d each | Industry |
| Sub-fascia | per eave | 1 × (L + 2·ovG) lf | 2×6, 2 × 16d per purlin/tail | Industry |
| Lookouts (ovG > 24") | per lookout | 6 nails | 2×4, 3 × 16d each end | Industry |
| Knee brace | per bearing post | 1 brace, 1 bolt, 6 nails, 1 block | 2×6 × 61 15/16" (legs 36"), ½" × 8" carriage bolt, 16d, 2×6 × 24" block + 6 × 16d | RCO §328 (min 3-10d) / Industry |
| End-wall diagonal | per end-wall corner bay | 2 braces, 4 bolts, 8 nails | 2×6 × bay diagonal, ½" × 8" bolts, 16d | NFBA (convention) |
| Lean-to rafter, header end | per rafter | 3 toe-nails + 1 tie | 16d, H2.5A | IRC / Simpson |
| Lean-to rafter, ledger end | per rafter | 1 hanger (+ ≈ 10 nails) | LSSR26Z, 10d × 1½" | Simpson (count unverified) |
| Lean-to ledger at posts | per post crossed | 2 | ½" × 8" HDG lag + washer | Industry |
| Lean-to ledger between posts | per 16" | 1 (staggered) | ¼" × 4½" structural screw | Industry |
| Lean-to header on outer posts | per outer post | 1 cap or 2 ties + 4 toe-nails | Simpson post cap sized for a 5½" post / 3" beam (verify fit) or 2 × H2.5A, 16d | Industry (unverified) |
| Roof panel screws | per panel | 16 + 5 × (rows − 2) | #10 × 1" HWH EPDM (1½" at laps/trims) | Metal-panel install guides |
| Roof stitch screws | per panel | ceil(length/24") | ¼" × ⅞" lap screw | Industry |
| Wall panel screws | per panel | 16 + 4 × (rows − 2) | #10 × 1" | Metal-panel install guides |
| Wall stitch screws | per panel | ceil(length/36") | ¼" × ⅞" | Industry |
| Closures | per roof panel | 1 outside (eave) + 2 inside (ridge) | foam, vented at a ridge vent | Industry |
| Trim screws | per 10' trim stick | 10 + 10 | #10 × 1" into wood, stitch screws to panel | Industry |
| Ridge cap | per lf of ridge | 1/9.5 stick | 10' stick, 6" lap, butyl | Industry |
| Trims (eave, rake, corner, base, J, head, jamb) | per building | runs per §7 table | 10' sticks, 4"–6" laps | Industry |
| Butyl tape | per end lap or ridge | 1 lf per lf of lap | 1" × 50' roll | Industry |
| Sliding door track | per opening | 2 × W lf | box/round rail 400–600 lb, splice bars | Cannonball cheat sheet |
| Sliding door brackets | per opening | track/2 + 1 | with 2×8 track board 2 × W and ⅜" × 4" lags at 16" | Cannonball cheat sheet |
| Sliding door leaf hardware | per leaf | 2 trolleys, 1 stay roller, 1 latch, 2 stops per track run, 1 handle set | 450-lb trolleys | Cannonball cheat sheet |
| Sliding door rain hood | per opening | 2 × W lf | track cover trim | Industry |
| Overhead door framing | per door | 2 jamb boards (H + 12"), 1 head (W + 12"), 1 header 2-ply 2×12 × W between the jamb posts on 2 hangers (Simpson HUC212-2 or 2×6 × 12" bearing blocks with 3 × ⅜" × 4" lags each), ≈ (2H + W)/16" × 3" screws, weather-stop 2H + W | 2×6 PT jambs; door/track/springs by supplier | Hansen / Garaga (headroom 12", side room ≥ 3¾", backroom H + 18") |
| Man door | per door | 1 unit, 2×6 buck (2 jambs + head + PT sill), 12 + 6 × 3" screws, shims, 1 foam, 1 drip cap, J 2H + W, 1 lockset, sealant | RO 38" × 82" for 36" | Industry |
| Window | per window | 1 unit, 2×6 sill + head + 2 jambs, perimeter + 24" of 4" flashing tape, 2 fin screws/ft (#8 × 1⅝"), J 2H + W, head trim W + 6", 1 sealant | RO unit + ½" × unit + ½" | Industry |
| Stall U-channel | per section end (per post face) | 1 + 6 lags | 1⅝" 16-ga × 8', ¼" × 3" | Stall suppliers |
| Kick boards | per 12' section | 10 | 2×6 T&G × 12', 4'-3" high | Industry |
| Grille | per section | 1 + 4 lags | 42" tall, ⅜" × 3" | Industry |
| Sliding stall door kit | per door | 8' track, 5 brackets, 2 trolleys, 2 stops, 1 stay roller, 1 latch, 1 handle, 1 × 2×8 × 8' + 4 lags | 4' × 8' leaf | Stall-door kits |
| Swing gate | per gate | 2 hinge pins, 1 latch, 1 hold-open | ½" × 8" screw hooks | Industry |
| Dutch door | per door | 4 T-hinges + 12 bolts, 2 latches + 1 leaf bolt, 1 chew guard, 1 hold-open | 12" heavy T-hinge, ⅜" × 2½" | Industry |
| Feeder / hay rack | per stall | 4 + 4 lags | ¼" × 2" / ⅜" × 3" | Industry |
| Waterer | per stall | 1 + 4 lags + 2×8 backer + supply + outlet | ⅜" × 3" | Industry / MEP |
| Small stall hardware | per stall | 2 hooks, 1 halter hook, 1 blanket bar, 1 salt holder | #10 × 2" screws | Industry |
| Mats | per 12×12 stall | 6 | 4' × 6' × ¾" | Industry |

**Worked check for the reference build** (30 × 40, ridge along the 40', 8' bays, 10' eave, 4:12, 12" overhangs): 18 posts (12 bearing incl. corners, 6 end-wall) → 36 uplift cleats, 24 carrier bolts, 12 knee braces; 11 trusses → 22 H2.5A, 66 toe-nails, 20 spacer blocks; 10 purlin rows × 2 planes × 11 trusses = 220 crossings → 440 toe-nails; girt crossings = 5 rows × (12 + 6 + corner double-counting) ≈ 5 × 22 = 110 → 220 nails + skirt 22 × 3 = 66; roof: 2 planes × ceil(42/3) = 28 panels × 17'-0" → 28 × 56 = 1,568 screws + 252 stitch; walls: 2 × ceil(40'/3) + 2 × ceil(30'/3) = 28 + 20 = 48 panels (before gables and openings) × 32 = 1,536 screws. QA can use these as the golden numbers for `hardware.ts`.

---

## 13. Sources and confidence

**Code-cited (high confidence in the rule; wording via search excerpts, not the code text itself):**
- IRC 2021 **R802.7.1.1** — notches at the ends of rafters ≤ ¼ of the depth (birdsmouth limit, §3). Confirmed by several code-commentary excerpts.
- IRC 2021 **Table R602.3(1)** — rafter/truss to plate: (3) 16d box or (3) 10d common toe-nails, 2 + 1 (§2, §3).
- IRC 2021 **R403.1.4.1** — footings/embedment below the frost line (§6; already `structural.site.frostDepthVerified`).
- **Residential Code of Ohio §328 (2019; §324 in the 2013 RCO)** *Post frame accessory structures* — 2×6 knee brace at 45°, (3) 10d at the bottom chord, fastener Table 328.7 keyed to width and snow load, brace-height Table 328.6, post/header tables. **Table values not retrieved** — Structural should pull them; this is Collin's jurisdiction, so the prescriptive path there matters.
- **BCSI-B1 Table B1-2** (SBCA/TPI) — truss out-of-plumb ≤ D/50 or 2"; the 1/200 bow limit is from memory.

**Standards and manufacturer values (medium confidence — search excerpts of the documents; PDFs could not be opened):**
- **NFBA Accepted Practices — Framing Tolerances:** post plumb ≤ 1% of height and surface slope ≤ 1.5%; adjacent girder bearing points within 0.5% (1/200) of their spacing; post spacing within 2" of plan and each post within ¾" of the average; girt slope ≤ 1%; "spacing within ½"" (girt rows, as far as the excerpt shows). **The brief's ¼"-in-8' plumb and ±¼" bearing height are tighter than NFBA and are used here as working targets, labelled as such.** Truss-spacing and eave-height tolerances in inches: not verified.
- **Simpson Strong-Tie:** H2.5A 18 ga, (5) + (5) 0.131 × 1½" nails, uplift 625–635 lb DF/SP and 540 lb SPF, lateral 450/385 lb; H10A (9) + (9) 0.148 × 1½", ≈ 1,340 lb SP; PF26 post-frame hanger and LSSR26Z slopeable rafter hanger exist and fit as described (nail counts unverified); ABU66Z / PBS66 / CBSQ66 1" standoff (PBS66: 14 × 16d or 2 × ½" bolts; ABU66Z anchor diameter unverified).
- **Perma-Column Sturdi-Wall:** drill-set with wedge anchors or wet-set (Plus), ½" through-bolts torqued 110–120 ft-lb; anchor count per bracket unverified.
- **Cannonball sliding-door cheat sheet (via DC Metal / Marco Metals):** track = 2 × opening, 2 trolleys per door at 450 lb, brackets ≈ 24" OC, 1 stay roller or a stay guide ≥ 60% of the width; the "3 in more than the opening" door-width wording is ambiguous, so §8 gives 3"–6" per side.
- **29-ga ag panel (Metal Sales Classic Rib / ABC / Tuff Rib guides):** 36" coverage, ¾" ribs at 9" OC; eave/ridge rows fastened both sides of every rib, field rows one per rib spacing alternating; 6" end lap with tape sealant; trims in ≈ 10' sticks lapped 4"–6". The exact per-row counts (8 / 5 / 4) are my reading of that pattern — the BOM should let the supplier's pattern override.
- **Garaga / door-industry clearances:** 12" headroom for standard-lift torsion, 3¾" minimum side room, backroom from the header; the "+18"" and opener allowances are convention.
- **Hansen Pole Buildings / DIY Pole Barns / Sutherlands / APB (trade practice):** 1½" notch + (2) ½" carriage bolts (also in the Bannock County ID prescriptive guide); 2×12 SPF headers for large openings and 2×6 PT jamb boards; 4–6" of exposed treated splash plank, non-metal barrier between steel and treated wood, siding held ≥ 4" up; uplift blocks (2) 2×6 × 12", 12" collar, (2) #5 × 9" rebar at 3" and 9"; purlins on edge lapped with a 60d ring-shank, flat purlins with (2) 20d; bookshelf girt blocks 22½" with SDWS16300 screws; stall U-channel 1⅝" 16-ga × 8' (1.8" 14-ga) and stall-door kits (8' track, 2 trolleys, latch, stop, guide, 2 channels, 45" grille).

**Industry convention / my own arithmetic (not verified this session):** bolt lengths and positions; the 8,000-lb notch-bearing and ≈ 1,000-lb-per-bolt estimates (NDS Table 12B order of magnitude — Structural to replace); truss spacer blocks; purlin lap of 12" and the 14'/10' stock rule; all screw-count formulas; wall-panel length rule; RO sizes (38 × 82 man door; window + ½"); ledger lag and screw sizes (deliberately longer than the brief's ½" × 4", see §3); knee-brace and birdsmouth tables (pure geometry, computed, see the ratios in §3–§4); concrete yields (0.6 cu ft per 80-lb bag); stall counts; lag counts for feeders, waterers and grilles; the per-post lean-to header cap.

**Could not verify at all:** NFBA truss-spacing/eave-height tolerances; RCO §328 tables; LSSR26Z and PF26 nail schedules; ABU66Z anchor diameter; Sturdi-Wall anchor count; Simpson post-cap fit for a 5½" post with a 3" beam; the Classic Rib field-row pattern page; whether the tool's 6"-per-side sliding-leaf overlap or a 3" overlap is what Collin's builder uses.

**Blocked hosts this session (WebFetch):** nfba.org, strongtie.com, marcometals.com, jlconline.com, tri-statemetalroofing.com, bannockcounty.us, sutherlands.com, diypolebarns.com, permacolumn.com, up.codes, hansenpolebuildings.com, medinaco.org.

---

## Appendix — discrepancies with the current generators (for the M2 backlog, no code changed here)

1. `postFrame.ts` draws both carrier plies inboard of the post face; with the §1 notch, ply 1 sits 1½" into the post — shift both plies when `carrier.notched` (new field, default `true`) and emit a `note: "notched 1½ × 11¼ inside face"` on bearing posts.
2. The header placeholder draws a single-ply 2×10 for 8'–12' openings and 2×12 above; overhead and sliding doors ≥ 10' should get 2-ply 2×12 on hangers or bearing blocks (§8) — Structural's table replaces both.
3. `leanTo.ts` draws rafter tops flush with the ledger and header tops (hanger geometry at both ends); the header end normally bears with a birdsmouth and sits HAP higher (§3). The ledger is outboard of the siding, so the lags must be ½" × 8" at posts (§3).
4. Sliding leaves are drawn 6" wider each side; 3" is the hardware minimum (§8) — keep 6" but expose it.
5. Skirt bottom at −3" leaves 1–3" of air above grade with a 4–6" pad; default `skirt.rows` to 2 or lower the skirt (§5).
6. Not generated yet: knee braces (`kneeBrace` kind exists), truss spacer blocks, gable blocking/sub-fascia, end-wall diagonals, girt/purlin stagger (§10), lean-to tails and ties.
