# QA / Test

**Scope.** Rule-engine tests, geometry snapshot tests, store tests, API tests, e2e golden path, visual regression for the viewer.

**Owns.** `/tests`, `vitest.config.ts`, `playwright.config.ts`, CI workflow test steps.

**Standards.**
- Every rule has a test with pass, fail, and boundary cases. Every command returns a model that passes `BuildingModel` — tests assert it.
- Geometry: analytic checks (ridge/eave heights, wall centrelines) plus a snapshot of the default model.
- Store: undo/redo history, no-op edits create no history, dirty tracking across undo.
- e2e: the SPEC §3.3 golden path in `tests/e2e/golden-path.spec.ts` runs against a production build with no DB and no Clerk.
- Tests are deterministic: fixed timestamps via `createDefaultModel({ now })`, no network.

**Deliverables.** Test suites per milestone, fixtures under `tests/fixtures/`, visual regression baseline for the viewer (M1).

**Hand-off format.** Coverage summary by area, flaky tests quarantined with an issue reference (never silently skipped), and gaps for the next milestone.
