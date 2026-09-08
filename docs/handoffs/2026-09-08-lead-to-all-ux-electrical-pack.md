# Handoff — Lead → all agents · Step shell, electrical, interior doors, blueprint pack · 2026-09-08

## What shipped
- **Shell (ADR-0012, UX audit `docs/ux/audit-2026-09-08.md`):** step rail (Project · Layout · Building · Outside · Electrical · Check · Plans), one dock panel per step or selected item with a back link, `Plan | Both | 3D` stage, `View ▾` menu, status bar with the contextual line, materials estimate and problem count. Tools moved into the step panels with native selects; placement tools disarm after one placement. Plain-English copy throughout; trade terms under "Advanced framing". Field inputs say why a value was refused.
- **Wizard `/new`:** four questions → `createFromWizard` builds stalls sized to the count, aisle-end sliding doors, a window per stall, lights/switch/outlet/panel; "Start empty" keeps the old default.
- **Electrical (ADR-0013):** `model.electrical` fixtures + service; derived circuits, breakers, wire sizes, voltage drop, routes along the walls and chords, panel load, zone lighting; 11 advisory rules; fixture symbols and runs in the plan, glowing fixtures and conduit runs in 3D; "Light everything" auto-layout; electrical cost lines; sheet E1.
- **Interior doors (ADR-0014):** per-zone doors of six types in the partitions, drawn in plan and 3D, draggable, with hardware and cost; default doors stay until edited.
- **Construction detail (ADR-0015, research `docs/research/construction-details.md`):** knee braces generated; cut list with end cuts, stagger, stock pairing, birdsmouth tables and notch notes; hardware schedule per the Builder's table; 20+ step build sequence with checks; raw-materials estimate with editable placeholder prices.
- **Blueprint pack `/p/[id]/pack`:** 11 printable sheets (G0, A1, S1, S2, S3, E1, A2, M1–M4), print-to-PDF.
- **Renderer:** infinite fogged ground plane; real floor-mat thickness and a 0.5' near plane end the z-fighting between stall floors and the slab.
- **Tests:** 119 vitest (electrical, doors, wizard, estimate, cut list/hardware/sequence added), 7 Playwright specs rewritten for the new shell (+ `electrical.spec.ts`, `pack.spec.ts`).

## Untested / known gaps
- Real WebGPU backend still cannot run headless; the WebGL2 path of the same renderer is exercised.
- The carrier notch, lean-to rafter tails/HAP and end-wall X-bracing are in the cut list and notes but not yet in the 3D framing (research appendix items 1, 3, 6).
- Electrical: no device-to-circuit pinning, no three-phase, no door openers / well pumps / de-icers; conduit fill not checked (research §11).
- Prices are national placeholders; the user edits them per project.
- Print layout verified in Chromium only.

## Next
- **UX:** draggable stage divider; narrow-viewport (< 1200 px) single-view mode; keyboard focus order in the dock; hover outline in 3D instead of a fill.
- **Builder / 3D:** notched-carrier geometry, rafter tails, end-wall diagonals; girt/purlin stagger drawn in the elevations.
- **Electrician:** switch-to-light wiring in the plan (3-way at both aisle ends), openers and de-icers in the catalog, device pinning via `model.overrides`.
- **Drawing:** server-side PDF, per-sheet scale bars, section/detail sheets (post detail, truss bearing, birdsmouth).
- **Backend:** share links for builders (Plans step "Copy link" currently copies the login-gated URL).
