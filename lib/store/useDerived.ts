"use client";

import { useMemo } from "react";
import { useProjectStore } from "./useProjectStore";
import { deriveFraming, type FramingSet } from "@/lib/framing";
import { deriveGeometry, type Geometry } from "@/lib/geometry";
import { runRules, type ValidationReport } from "@/rules";

/**
 * Memoised derivations from the current model (SPEC §10.2 "derived, never
 * stored"). Every consumer shares the same framing/geometry per model.
 */
const cache = new WeakMap<object, { framing: FramingSet; geometry: Geometry; report: ValidationReport }>();

export function deriveAll(model: NonNullable<ReturnType<typeof useProjectStore.getState>["model"]>) {
  let hit = cache.get(model);
  if (!hit) {
    const framing = deriveFraming(model);
    const geometry = deriveGeometry(model, framing);
    const report = runRules(model);
    hit = { framing, geometry, report };
    cache.set(model, hit);
  }
  return hit;
}

export function useDerived() {
  const model = useProjectStore((s) => s.model);
  return useMemo(() => (model ? deriveAll(model) : { framing: null, geometry: null, report: null }), [model]);
}
