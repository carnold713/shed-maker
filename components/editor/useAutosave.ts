"use client";

import { useEffect, useRef } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";

export const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * Debounced autosave: 2s after the last model change, PATCH the draft.
 * Compares model references so undo/redo are saved like any other edit.
 * Only the latest model is sent; in-flight saves that finish after a newer
 * edit leave the document dirty and a follow-up save fires.
 */
export function useAutosave() {
  const projectId = useProjectStore((s) => s.projectId);
  const model = useProjectStore((s) => s.model);
  const savedModel = useProjectStore((s) => s.savedModel);
  const saving = useProjectStore((s) => s.saving);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!projectId || !model || model === savedModel || saving) return;
    const timer = setTimeout(async () => {
      const { markSaving, markSaved, markSaveError } = useProjectStore.getState();
      inflight.current?.abort();
      const ac = new AbortController();
      inflight.current = ac;
      markSaving();
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Save failed (${res.status})`);
        }
        const { updatedAt } = (await res.json()) as { updatedAt: string };
        markSaved(model, updatedAt);
      } catch (e) {
        if (ac.signal.aborted) return;
        markSaveError(e instanceof Error ? e.message : "Save failed");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [projectId, model, savedModel, saving]);

  // Warn before closing with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useProjectStore.getState();
      if (s.model && s.model !== s.savedModel) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
