"use client";

import { useState } from "react";
import { useProjectStore, useTemporal } from "@/lib/store/useProjectStore";
import { Button } from "@/components/ui/Button";
import { SaveStatus } from "./SaveStatus";

export type ViewMode = "split" | "3d" | "plan";

export function Toolbar({ view, onView }: { view: ViewMode; onView: (v: ViewMode) => void }) {
  const { undo, redo, canUndo, canRedo } = useTemporal();
  const name = useProjectStore((s) => s.model?.meta.name ?? "");
  const setName = useProjectStore((s) => s.setName);
  const projectId = useProjectStore((s) => s.projectId);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);

  const saveVersion = async () => {
    if (!projectId) return;
    const label = window.prompt("Version label (optional)", "") ?? null;
    if (label === null) return;
    const res = await fetch(`/api/projects/${projectId}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (res.ok) {
      const { version } = (await res.json()) as { version: { number: number } };
      setVersionMsg(`Saved v${version.number}`);
      setTimeout(() => setVersionMsg(null), 2500);
    } else {
      setVersionMsg("Version save failed");
    }
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel px-3">
      <input
        aria-label="Project name"
        className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-border focus:border-accent focus:outline-none"
        defaultValue={name}
        key={name}
        onBlur={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <div className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" onClick={() => undo()} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
        ↶ Undo
      </Button>
      <Button variant="ghost" onClick={() => redo()} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
        ↷ Redo
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <div className="flex rounded-md border border-border p-0.5 text-xs">
        {(["split", "3d", "plan"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`rounded px-2 py-1 ${view === v ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
            aria-pressed={view === v}
          >
            {v === "split" ? "Split" : v === "3d" ? "3D" : "Plan"}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        {versionMsg ? <span className="text-xs text-muted">{versionMsg}</span> : null}
        <SaveStatus />
        <Button onClick={saveVersion} title="Snapshot the current draft as a named version">
          Save version
        </Button>
      </div>
    </div>
  );
}
