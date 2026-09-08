# Barn Designer — working notes for Claude Code

- **Source of truth:** `docs/SPEC.md`. Read §2 (agent protocol) and §13 (roadmap) first. Current milestone status: `docs/handoffs/` (latest file).
- **Agents:** personas in `/agents`; roster and lanes in `docs/agents.md`. Stay in your lane; write a handoff note when you cross one.
- **Decisions:** `docs/adr/`. Coordinates/units are ADR-0005 — model lengths are decimal feet, plan y is north, world z is south.
- **Single model:** edit `BuildingModel` via commands in `lib/model/*.ts` (`commands`, `zones`, `interiorDoors`, `leanTos`, `electrical`, `drainage`, `runs`); everything else is derived (`lib/framing`, `lib/geometry`, `lib/interior`, `lib/electrical`, `lib/plumbing`, `lib/site`, `lib/bom`, `rules/`). Never store derived data.
- **Site map:** `components/site/SiteMap.tsx` (Leaflet) draws the barn and runs on satellite tiles from `/api/tiles` (Google Map Tiles with `GOOGLE_MAPS_API_KEY`, else Esri); address search is `/api/geo/search` (Google, else Nominatim). Projection maths in `lib/site/geo.ts` (ADR-0017).
- **Editor shell:** step rail → one dock panel (`components/steps/*` or `components/inspector/*`), stage, status bar (ADR-0012). Copy is plain English; test ids are listed in `tests/e2e/*`.
- **Research the code is built on:** `docs/research/construction-details.md` (framing, cuts, hardware, sequence) and `docs/research/electrical-planning.md` (NEC 547, loads, routing). Cite them in rules and notes.
- **Blueprints:** `/p/[id]/pack` (`components/pack`) derives every sheet from the model; cut list, hardware and sequence live in `lib/bom`.
- **Rules:** pure `Rule` objects in `rules/**` with a citation (`source`) and a test in `tests/rules/`. Register in `rules/index.ts`; regenerate `docs/RULES_INDEX.md` with `npm run rules:index`.
- **Checks before pushing:** `npm run check` (lint, typecheck, vitest) and `npm run e2e` (needs `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` in the remote sandbox).
- **No secrets needed locally:** without `DATABASE_URL`/Clerk keys the app runs on an in-memory repo and a dev user (ADR-0002).
