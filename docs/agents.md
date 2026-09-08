# Agent roster

Persona files live in `/agents`. Each defines scope, owned paths, standards, deliverables, and hand-off format. The Lead records every additional hire here.

| Agent | Persona | Status | Owned paths |
|---|---|---|---|
| Lead / PM | `agents/lead.md` | active | `/docs`, `README.md`, `CLAUDE.md` |
| Architect | `agents/architect.md` | active | `/rules/design`, templates |
| Builder / Framer | `agents/builder.md` | active | `/rules/framing`, `/rules/materials`, `/lib/framing`, `/lib/bom` |
| Structural reviewer | `agents/structural.md` | active (P1, first rule shipped in M0) | `/rules/structural` |
| UI/UX Designer | `agents/ux.md` | active | `/app`, `/components/{ui,editor,inspector,plan,steps,site}` |
| 3D Engineer | `agents/3d.md` | active | `/lib/geometry`, `/components/scene` |
| Backend Engineer | `agents/backend.md` | active | `/prisma`, `/app/api`, `/lib/repo`, infra |
| Drawing / Export | `agents/drawings.md` | active (pack shipped 2026-09-08) | `/components/pack`, `/lib/bom/cutlist.ts`, `/lib/bom/sequence.ts` |
| QA / Test | `agents/qa.md` | active | `/tests`, test configs |
| Animal husbandry | `agents/animals.md` | pending (M3) | `/rules/animals` |
| Electrical / Plumbing | `agents/mep.md` | plumbing pending (M7) | `/rules/mep` (plumbing) |
| Electrician | `agents/electrician.md` | active (hired 2026-09-08) | `/rules/mep/electrical.ts`, `/lib/electrical`, `/lib/model/electrical.ts`, `/lib/geometry/electrical.ts` |

## Hires
- **2026-09-08 — Electrician** (`agents/electrician.md`). Hired by the owner's request for lights, outlets, load/amperage and routing. Delivered `docs/research/electrical-planning.md`; the Lead landed the schema (`model.electrical`), `RuleSource` forms `NEC:` / `ASABE:` / `MWPS:`, the derivation and 11 rules (ADR-0013). The persona's owned paths were adjusted to where the code landed (see the table).

## Lane rules
Nobody edits outside their owned paths without a hand-off note in `docs/handoffs/`. Shared files (`lib/model/schema.ts`, `lib/store/useProjectStore.ts`) are owned by Backend (schema) and UX (store) respectively; `lib/framing` is the Builder's, and `lib/geometry` (3D) consumes its output without re-deriving framing; changes there need a note to every agent whose derived code consumes the changed field.
