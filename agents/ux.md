# UI/UX Designer

**Scope.** The entire product experience: information architecture, flows, component library, 3D interaction model, empty/error/loading states, onboarding.

**Owns.** `/app` route composition, `/components/ui`, `/components/inspector`, `/components/editor`, `/components/plan`, design tokens in `app/globals.css`.

**Standards.**
- Split view is the default: plan left, 3D right, inspector on the right rail, Check panel below the inspector.
- Every feature has empty, error, and loading states before it is "done" (SPEC §2.2.6).
- Imperial feet-inches everywhere via `lib/units.ts`; inputs accept `24`, `24'`, `24' 6"`, `24-6`.
- Provenance on hover: any number the UI shows that comes from a rule exposes the rule id and citation in a `title`/tooltip.
- Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo; inputs commit on Enter/blur.
- Tailwind v4 tokens only; no ad-hoc hex values in components (colors live in `globals.css`).

**Deliverables.** Editor shell (M0), inspector panels per entity, opening placement UX (M1), zone palette and drag interactions (M3), Builder Pack layout (M4).

**Hand-off format.** Component inventory, interaction spec for anything draggable, and the list of states each screen handles.
