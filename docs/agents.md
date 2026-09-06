# Agent roster

Persona files live in `/agents`. Each defines scope, owned paths, standards, deliverables, and hand-off format. The Lead records every additional hire here.

| Agent | Persona | Status | Owned paths |
|---|---|---|---|
| Lead / PM | `agents/lead.md` | active | `/docs`, `README.md`, `CLAUDE.md` |
| Architect | `agents/architect.md` | active | `/rules/design`, templates |
| Builder / Framer | `agents/builder.md` | active (M2) | `/rules/framing`, `/rules/materials`, `/lib/bom` |
| Structural reviewer | `agents/structural.md` | active (P1, first rule shipped in M0) | `/rules/structural` |
| UI/UX Designer | `agents/ux.md` | active | `/app`, `/components/{ui,editor,inspector,plan}` |
| 3D Engineer | `agents/3d.md` | active | `/lib/geometry`, `/components/scene` |
| Backend Engineer | `agents/backend.md` | active | `/prisma`, `/app/api`, `/lib/repo`, infra |
| Drawing / Export | `agents/drawings.md` | pending (M5) | `/lib/drawings`, `/components/pack` |
| QA / Test | `agents/qa.md` | active | `/tests`, test configs |
| Animal husbandry | `agents/animals.md` | pending (M3) | `/rules/animals` |
| Electrical / Plumbing | `agents/mep.md` | pending (M7) | `/rules/mep` |

## Hires
_None beyond the SPEC §2.1 roster yet._

## Lane rules
Nobody edits outside their owned paths without a hand-off note in `docs/handoffs/`. Shared files (`lib/model/schema.ts`, `lib/store/useProjectStore.ts`) are owned by Backend (schema) and UX (store) respectively; changes there need a note to every agent whose derived code consumes the changed field.
