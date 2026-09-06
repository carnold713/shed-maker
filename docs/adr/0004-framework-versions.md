# ADR-0004 — Pinned framework versions for M0

**Status:** accepted · 2026-09-06 · Lead

## Context
At scaffold time the registry offered Next 16.3, React 19.2, Prisma 7, TypeScript 7, Zod 4. SPEC §11 targets Next 15.

## Decision
| Package | Pinned | Why |
|---|---|---|
| next | 15.5.x | SPEC target; Next 16 renames middleware→proxy and changes caching defaults. Upgrade is its own ADR. |
| react / react-dom | 19.1.x | Clerk 6 peer range. |
| @clerk/nextjs | 6.x | Stable `clerkMiddleware`/`auth()` API. |
| prisma / @prisma/client | 6.19 | Prisma 7 moves config to `prisma.config.ts` and changes the client generator; not needed for M0. |
| zod | 4.x | Current; note `.prefault({})` for nested object defaults. |
| three / @react-three/fiber / drei | 0.185 / 9.x / 10.x | R3F 9 is the React 19 line. |
| zustand / zundo | 5.x / 2.x | |
| typescript | ^5 | TS 7 (Go port) is new; `tsc --noEmit` is part of CI. |
| vitest / @playwright/test | 3.x / 1.63 | |

Exact versions are in `package.json` (`--save-exact`).

## Consequences
- Dependabot/renovate should be configured to open PRs, not auto-merge, for majors.
- Google Fonts were removed from the layout so builds work offline.
