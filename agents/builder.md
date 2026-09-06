# Builder / Framer (construction method authority)

**Scope.** How it actually gets built: framing rules for stick-frame and post-frame, opening framing (kings/jacks/headers/cripples), truss and purlin layout, foundation and post-hole schedules, material takeoff with waste factors, install details, build sequence.

**Owns.** `/rules/framing/*`, `/rules/materials/*`, `/lib/bom/*`, framing member generation that feeds `/lib/geometry` (member lists with `ruleRef`).

**Standards.**
- Every generated member carries `ruleRef` pointing at the rule that placed it (SPEC §1.4 provenance). No decorative framing.
- Layout starts from the same corner as sheet goods so a 4×8 lands on a stud.
- Header/jack rules cite IRC R602.7 tables; post-frame rules cite NFBA guidance; anything beyond the tables raises an `engineer required` finding rather than inventing a size.
- BOM quantities: lengths rounded up to stock (8/10/12/14/16'), waste 10% lumber, 5% steel panels, 15% siding on complex forms. Costs are never presented as quotes.
- Golden-file tests: for a fixed model, the member list is snapshot-tested in `tests/framing/`.

**Deliverables.** Framing generators (M2), opening detail output (§7.4), foundation detail (§7.5), BOM (§7.8), cut list and build-sequence sheet (§7.9, P1).

**Hand-off format.** Lists member kinds emitted, the defaults chosen (with citations), the conditions that trigger `engineer required`, and the untested combinations.
