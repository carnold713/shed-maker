"use client";

import { selectSaveStatus, useProjectStore } from "@/lib/store/useProjectStore";

export function SaveStatus() {
  const status = useProjectStore(selectSaveStatus);
  const error = useProjectStore((s) => s.saveError);
  const label: Record<typeof status, string> = {
    idle: "",
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "Saved",
    error: `Save failed${error ? `: ${error}` : ""}`,
  };
  const tone = status === "error" ? "text-red-600" : status === "saved" ? "text-emerald-700" : "text-muted";
  return (
    <span className={`text-xs ${tone}`} aria-live="polite" data-testid="save-status" data-status={status}>
      {label[status]}
    </span>
  );
}
