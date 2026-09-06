# ADR-0001 — One JSON `BuildingModel`, relational shell around it

**Status:** accepted · 2026-09-06 · Lead + Backend

## Context
The building is a document-shaped thing: walls, openings, roof, zones, fixtures, overrides. Geometry, framing, BOM, drawings and validation are all functions of it. A fully relational schema would mean ~40 tables and every rule would need a DB round-trip or an ORM hydration step.

## Options
1. Fully relational (tables per entity).
2. One `jsonb` document per project version, relational tables for identity/ownership/versions/sharing/comments.
3. Document DB.

## Decision
Option 2. `BuildingModel` is a Zod schema (`lib/model/schema.ts`) with a `schemaVersion`. `Project.draftModel` holds the autosaved working copy; `ProjectVersion.model` holds immutable snapshots. JSON migrations are code (`lib/model/migrations.ts`) and run on read, so old documents are upgraded lazily and the DB never needs a data migration for model-shape changes.

Derived data (`Geometry`, framing, BOM, drawings, `ValidationReport`) is never stored. It is recomputed from the model and memoised in memory.

## Consequences
- Rules and geometry are pure TypeScript with no persistence concerns; tests need no database.
- Querying inside the model (e.g. "all projects with a wash bay") is not supported; if needed later, add denormalised columns.
- Every write goes through `parseBuildingModel`; a document that fails validation is rejected with 400, never stored partially.
