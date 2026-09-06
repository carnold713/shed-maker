# Handoff — Lead → all agents · M0 Skeleton complete · 2026-09-06

## What shipped
- Next 15 App Router + TypeScript strict + Tailwind v4, Clerk (optional), Prisma 6 + Postgres, Railway config, GitHub Actions CI.
- `BuildingModel` Zod schema (`lib/model/schema.ts`) covering every §10.2 field, with nested defaults, `migrateModel`, and `createDefaultModel` (Appendix B defaults, 24×36 post-frame gable).
- Commands as pure reducers (`lib/model/commands.ts`): footprint, eave height, method, roof, name, snap-to-module. Exterior walls are re-derived from the footprint with stable ids; openings that no longer fit are dropped.
- Zustand store + zundo undo/redo (`lib/store/useProjectStore.ts`), reference-based dirty tracking, keyboard shortcuts.
- Geometry derivation (`lib/geometry`): slab, wall panels, gable/shed roof planes, gable-end infill. Analytic tests prove ridge/eave heights.
- Rules runner (`rules/`) with three rules: frost depth verified (IRC R403.1.4.1), clear-span limit (NFBA), footprint on 2' module (Industry). Check panel shows findings with citations and a one-click fix.
- Editor: split plan/3D view, inspector (footprint, walls, roof), plan drag handles, orbit viewer, autosave (2s debounce → `PATCH /api/projects/:id`), explicit "Save version" (`POST …/versions`).
- API: `/api/health`, `/api/projects` (GET/POST), `/api/projects/[id]` (GET/PATCH/DELETE), `/api/projects/[id]/versions` (GET/POST). Ownership enforced in the repo layer.
- Tests: 37 vitest cases, 1 Playwright golden-path e2e (create → edit → autosave → undo/redo → reload → list).

## Assumptions
- Post-frame default (SPEC §14 Q2 unanswered). Frost 36" unverified (Q3).
- Rect footprint only; `poly` is in the schema but `deriveGeometry` throws on it.
- Gambrel/hip/monitor render as gable until their geometry lands.
- Exterior wall thickness 5.5" nominal for both methods; Builder to set per-method values in M2.

## Untested
- Prisma repo against a live Postgres (unit/e2e use the in-memory repo). Schema compiles and `migrate diff` generated `prisma/migrations/20260906000000_init`. First Railway deploy should run `prisma migrate deploy` via the preDeploy command and hit `/api/health`.
- Clerk sign-in flow (no keys in this environment). Middleware, provider, and `getCurrentUser` follow the Clerk 6 API.

## Next: M1 — Envelope
- **UX + 3D:** openings on walls (drag-to-place, snap to stud bays), wall click → inspector, interior/cutaway views, layer toggles. Coalesce drag history (`temporal.pause/resume`).
- **Architect:** opening placement rules (min distance from corners), sill defaults.
- **Builder:** opening rough-opening and header sizing rules (needed by M1 inspector, generator in M2).
- **Backend:** thumbnails on save (P1), share links (M4) can start early.
- **QA:** visual regression baseline for the viewer once openings render.

## Known gaps / follow-ups
- Home page renders two "New barn" buttons in the empty state (header + empty-state CTA); fine, but e2e uses `.first()`.
- `Dev user` badge is shown when Clerk is not configured — remove once keys are set in Railway.
- Railway `preDeployCommand` uses `npx prisma migrate deploy`; confirm Railpack keeps devDependencies (prisma CLI) available at deploy time, or move `prisma` to `dependencies`.
