"use client";

import { selectSaveStatus, useProjectStore } from "@/lib/store/useProjectStore";

const LABEL = { idle: "", dirty: "Unsaved", saving: "Saving…", saved: "Saved", error: "Save failed" } as const;

/** Save state as a dot + word (UX audit §2.9). `data-status` is the e2e hook. */
export function SaveDot() {
  const status = useProjectStore(selectSaveStatus);
  const error = useProjectStore((s) => s.saveError);
  const tone = status === "error" ? "bg-red-500" : status === "saved" ? "bg-emerald-500" : status === "saving" ? "bg-sky-400" : "bg-amber-400";
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted" aria-live="polite" data-testid="save-status" data-status={status} title={status === "error" && error ? error : undefined}>
      <i className={`inline-block h-2 w-2 rounded-full ${tone}`} />
      {LABEL[status]}
    </span>
  );
}
