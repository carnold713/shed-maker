# Barn Designer

Construction-ready barn and shed design: set a footprint and carve up the interior, or place stalls and let the tool derive the envelope. One `BuildingModel` drives the 2D plan, the 3D scene, the framing layer, the materials list, and the plan sheets.

`docs/SPEC.md` is the source of truth. Milestone 0 (skeleton) is complete; see `docs/handoffs/` for the current state and next steps.

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
app/          routes: /, /new, /p/[id], /api/*
components/   ui/, editor/, inspector/, plan/, scene/, auth/, site/
lib/          model/ (schema, commands, migrations), store/, geometry/, repo/, units.ts
rules/        design/, structural/, framing/, materials/, animals/, mep/  — pure rules with citations
agents/       persona files for the agent team (SPEC §2)
docs/         SPEC.md, adr/, handoffs/, agents.md, RULES_INDEX.md
prisma/       schema + migrations
tests/        vitest (model, rules, geometry, store) + Playwright e2e
```

## Deploy (Railway)
`railway.json` builds with `npm run build`, runs `prisma migrate deploy` before deploy, starts `npm run start`, and health-checks `/api/health`. Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `APP_URL`, `SHARE_TOKEN_SECRET`.

> This tool generates conventional light-frame and post-frame layouts using prescriptive rules and common industry practice. It is a planning and communication aid, not a substitute for a licensed engineer, architect, or your local building department.
