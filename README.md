# Barn Designer

Construction-ready barn and shed design: set a footprint and carve up the interior, or place stalls and let the tool derive the envelope. One `BuildingModel` drives the 2D plan, the 3D scene, the framing layer, the materials list, and the plan sheets.

`docs/SPEC.md` (v2, Part II wins over Part I) is the source of truth. Shipped: the envelope (openings, post-frame framing as real geometry), the interior (stalls, aisles, rooms, doors, derived partitions), the exterior catalog (doors, windows, lean-tos, concrete), a WebGPU-first renderer, the step-based editor, electrical planning (lights, outlets, panel, circuits, routing), the new-barn wizard, and a printable blueprint pack with a cut list, hardware schedule, build sequence and a raw-materials cost estimate. See `docs/handoffs/` for the current state and next steps.

## How it is organised for the user
Seven steps in the left rail — **Project · Layout · Building · Outside · Electrical · Check · Plans** — each with one panel of controls and its own plan tools. The status bar always says what the pointer is over or what a click will do. **Plans** opens `/p/[id]/pack`: eleven Letter-landscape sheets (cover, floor plan, foundation & post plan, wall framing elevations, roof framing, electrical plan & panel schedule, schedules, materials & cost, cut list, hardware, build sequence) that print to PDF from the browser. Prices are placeholders you can edit; every number traces to a rule, a member or a research table (`docs/research/`).

## Stack
Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · React Three Fiber · Zustand + zundo · Zod · Prisma + Postgres · Clerk · Railway.

## Run it
```bash
npm install
npm run dev          # http://localhost:3000
```
With no `DATABASE_URL` the app uses an in-memory store; with no Clerk keys it runs as a local dev user (ADR-0002). Copy `.env.example` to `.env` to point at Postgres and Clerk.

```bash
npm run check        # lint + typecheck + unit tests
npm run e2e          # production build golden path in Chromium (set PW_CHROMIUM_PATH if using a system browser)
npm run db:migrate   # prisma migrate deploy
```

## Layout
```
app/          routes: /, /new (wizard), /p/[id] (editor), /p/[id]/pack (blueprints), /api/*
components/   ui/, editor/ (shell), steps/ (one panel per step), inspector/ (selected item), plan/, scene/, pack/ (sheets), auth/, site/
lib/          model/ (schema, commands, zones, interiorDoors, leanTos, electrical, wizard), framing/, geometry/, interior/, electrical/, bom/ (estimate, cutlist, hardware, sequence), store/, repo/, units.ts
rules/        design/, structural/, framing/, materials/ (lumber, prices), animals/, mep/ (electrical)  — pure rules with citations
agents/       persona files for the agent team (SPEC §2)
docs/         SPEC.md, adr/, handoffs/, research/, ux/, agents.md, RULES_INDEX.md
prisma/       schema + migrations
tests/        vitest (model, rules, geometry, store) + Playwright e2e
```

## Deploy (Railway)
`railway.json` builds with `npm run build`, runs `prisma migrate deploy` before deploy, starts `npm run start`, and health-checks `/api/health`. Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `APP_URL`, `SHARE_TOKEN_SECRET`.

> This tool generates conventional light-frame and post-frame layouts using prescriptive rules and common industry practice. It is a planning and communication aid, not a substitute for a licensed engineer, architect, or your local building department.
