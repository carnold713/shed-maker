# ADR-0002 — Clerk and Postgres with explicit local fallbacks

**Status:** accepted · 2026-09-06 · Backend

## Context
Clerk and Railway Postgres are the production stack (SPEC §11–12). Contributors, CI, and Claude Code sessions frequently have neither secret. The app must still run end to end so the golden path can be exercised.

## Options
1. Require keys everywhere (mock Clerk in tests).
2. Runtime fallbacks: a deterministic dev user when Clerk keys are absent, an in-memory repository when `DATABASE_URL` is absent.
3. Docker-compose Postgres + Clerk test keys checked in.

## Decision
Option 2, guarded:
- `lib/auth.ts` — `getCurrentUser()` returns `DEV_USER` when `CLERK_SECRET_KEY`/`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are unset. In production this returns `null` (signed out) unless `ALLOW_DEV_AUTH=1`.
- `lib/repo/index.ts` — `getProjectRepo()` returns the Prisma repo when `DATABASE_URL` is set, else the in-memory repo. In production this throws unless `ALLOW_MEMORY_REPO=1`.
- `middleware.ts` exports `clerkMiddleware` only when keys exist; otherwise a pass-through.
- `components/auth/AuthProvider.tsx` mounts `ClerkProvider` only when enabled.
- `/api/health` reports which mode is active (`auth: clerk|dev`, `db: ok|error|none`).

## Consequences
- `npm run e2e` and CI run with no secrets.
- Two code paths for auth and persistence; the repository interface (`lib/repo/types.ts`) keeps them identical from the routes' point of view.
- A misconfigured production deploy fails loudly (500 on repo access, signed-out UI) rather than silently serving a dev user.
