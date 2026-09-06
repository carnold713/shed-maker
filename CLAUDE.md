# Barn Designer — working notes for Claude Code

- **Source of truth:** `docs/SPEC.md`. Read §2 (agent protocol) and §13 (roadmap) first. Current milestone status: `docs/handoffs/` (latest file).
- **Agents:** personas in `/agents`; roster and lanes in `docs/agents.md`. Stay in your lane; write a handoff note when you cross one.
- **Decisions:** `docs/adr/`. Coordinates/units are ADR-0005 — model lengths are decimal feet, plan y is north, world z is south.
- **Single model:** edit `BuildingModel` via commands in `lib/model/commands.ts`; everything else is derived (`lib/geometry`, `rules/`). Never store derived data.
- **Rules:** pure `Rule` objects in `rules/**` with a citation (`source`) and a test in `tests/rules/`. Register in `rules/index.ts`; regenerate `docs/RULES_INDEX.md` with `npm run rules:index`.
- **Checks before pushing:** `npm run check` (lint, typecheck, vitest) and `npm run e2e` (needs `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` in the remote sandbox).
- **No secrets needed locally:** without `DATABASE_URL`/Clerk keys the app runs on an in-memory repo and a dev user (ADR-0002).
