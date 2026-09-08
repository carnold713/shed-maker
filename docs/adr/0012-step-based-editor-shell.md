# ADR-0012 — Step-based editor shell, one dock panel, plain-English copy

**Status:** accepted · 2026-09-08 · owner: UX (audit: `docs/ux/audit-2026-09-08.md`)

## Context
The M3 shell showed everything at once: four ways to change the view, checks in three places, six always-open dock panels, a floating two-row tool strip over the plan, a 160 px footer of numbers, and a project panel hidden below 1536 px. The owner's verdict: "I don't really know what I'm clicking on half the time." The UX audit found 40+ concrete problems and specified the structure below.

## Decision
- **Steps in a left rail**, in the order the work happens: Project · Layout · Building · Outside · Electrical · Check · Plans (`STEPS` in `lib/store/useViewStore.ts`). Steps are a menu, not a wizard; each shows a status dot from the model, Check carries the problem count, `Ctrl+1…7` jumps.
- **One dock panel.** The dock shows the active step's panel (`components/steps/*`) or, when something is selected, that item's panel with a "← Step" back link (`components/inspector/*`). Changing step keeps the selection only if the step owns it (`components/editor/selectionOwner.ts`).
- **One stage** with a `Plan | Both | 3D` control (choice sticks per step, `STEP_STAGE_VIEW`), one `View ▾` menu for the 3D preset, cutaway height, white model, camera and layers, and a 28 px status bar: facts · the contextual line (what the pointer is over, or what the armed tool will do — `hint` in the view store, `toolHint()`) · materials estimate · problems · saved.
- **Tools live in the step panel**, one row of labelled icon buttons; variants (animal, room, door, window, fixture) are native selects so nothing floats over the plan. Placement tools (door, window, lean-to, fixture, interior door) return to Select after one placement with the new item selected; stamp tools (stall, room, aisle) stay armed until Esc.
- **Escape ladder:** menu → tool → selection. `Delete` removes any selected item; `Ctrl+D` duplicates a stall (plain `D` is the door tool).
- **Copy:** sentence case, no trade jargon in primary UI ("post spacing" not "bay", "stall" not "zone", "Cutaway" not "dollhouse"); trade terms only under "Advanced framing" and on the member panel with a hint.
- **Wizard:** `/new` asks four questions with defaults and builds the whole barn client-side (`lib/model/wizard.ts`), then lands on the Layout step.

## Consequences
- `Toolbar`, `ToolPalette`, `BottomCards`, `InspectorDock`, `ProjectPanel`, `StageHeader` are gone; `Editor` composes `Rail`, `TopBar`, `Stage`, `Dock`, `StatusBar`.
- Test ids for e2e moved with the controls (`rail-step-*`, `stage-*`, `view-*`, `*-picker` selects, `dock-back`); specs were rewritten in the same change.
- Field inputs refuse out-of-range values with a reason instead of silently reverting (`components/ui/FtInput.tsx`).

## Addendum 2026-09-08 — walk inside (first-person view)

The 3D view has a first-person mode (View menu "Walk inside", or the mini map's "Walk inside"): the camera stands at a plan point at a person's eye height (default 6', editable), dragging on the canvas turns it in place like a street view (grab the world), the wheel zooms, W A S D / arrows walk, Q / E turn, Esc leaves. A miniature overhead plan sits in the corner of the 3D view whenever the Inside preset or the walk is on: click anywhere on it to drop in there, drag the person to move, the cone shows the view. State is `walk` in the view store (`components/scene/WalkControls.tsx`, `components/scene/MiniMap.tsx`); orbit controls and camera fitting are suspended while walking.
