# ADR-0003 — Undo/redo via zundo state snapshots, commands as pure reducers

**Status:** accepted · 2026-09-06 · UX + Backend

## Context
SPEC §11 allows either zundo (snapshot history) or a command pattern with inverse ops.

## Options
1. Command pattern with inverse operations per command.
2. zundo `temporal` middleware snapshotting the `model` slice.

## Decision
Option 2. Commands in `lib/model/commands.ts` are pure `(model, payload) => model` reducers and return the *same reference* when nothing changes, so no-op edits create no history (zundo `equality` compares model references). Only `model` is partialised into history; selection and save state are excluded. History limit 200.

Dirty tracking compares references too: `savedModel` is the exact object last confirmed persisted, so undoing back to it reads as "saved" and redoing away from it reads as "dirty" with no counters to keep in sync.

## Consequences
- Adding a command is one pure function plus a test; no inverse to write.
- Memory grows with history size × model size; models are small (KBs) so 200 entries is fine. Revisit if fixtures/framing overrides make documents large.
- Drag interactions that call a command on every pointer move create one history entry per move; coalescing (`temporal.pause()/resume()` around a drag) is a follow-up for M1.
