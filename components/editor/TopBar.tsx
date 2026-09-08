"use client";

import { useState } from "react";
import { useProjectStore, useTemporal } from "@/lib/store/useProjectStore";
import { selectStageView, useViewStore, type StageView } from "@/lib/store/useViewStore";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { Popover, MenuRow, MenuDivider } from "@/components/ui/Popover";
import { ViewMenu } from "./ViewMenu";
import { SaveDot } from "./SaveStatus";

/** Top bar (UX audit §2.9): name · save state · undo/redo · Plan | Both | 3D · View · Fit · more. */
export function TopBar() {
  const model = useProjectStore((s) => s.model)!;
  const projectId = useProjectStore((s) => s.projectId);
  const setName = useProjectStore((s) => s.setName);
  const { undo, redo, canUndo, canRedo } = useTemporal();
  const stageView = useViewStore(selectStageView);
  const setStageView = useViewStore((s) => s.setStageView);
  const requestFit = useViewStore((s) => s.requestFit);
  const [toast, setToast] = useState<string | null>(null);
  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2800);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      say("Link copied — it works for anyone with your login");
    } catch {
      say(window.location.href);
    }
  };
  const saveVersion = async () => {
    if (!projectId) return;
    const label = window.prompt("Name this version (optional)", "") ?? null;
    if (label === null) return;
    const res = await fetch(`/api/projects/${projectId}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) });
    if (res.ok) {
      const { version } = (await res.json()) as { version: { number: number } };
      say(`Saved version ${version.number}`);
    } else say("Couldn't save a version — try again");
  };

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-panel/80 px-3 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          aria-label="Barn name"
          className="min-w-0 max-w-[22rem] flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold tracking-tight hover:border-border focus:border-accent focus:outline-none"
          defaultValue={model.meta.name}
          key={model.meta.name}
          onBlur={(e) => setName(e.target.value.trim() || model.meta.name)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          data-testid="project-name"
        />
        <SaveDot />
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Undo" hint="Undo (Ctrl+Z)" onClick={() => undo()} disabled={!canUndo} icon="undo" />
        <IconButton label="Redo" hint="Redo (Ctrl+Shift+Z)" onClick={() => redo()} disabled={!canRedo} icon="redo" />
      </div>

      <Segmented<StageView>
        value={stageView}
        onChange={setStageView}
        testId="stage-view"
        options={[
          { value: "plan", label: "Plan", title: "Plan only", testId: "stage-plan" },
          { value: "both", label: "Both", title: "Plan and 3D side by side", testId: "stage-both" },
          { value: "3d", label: "3D", title: "3D only", testId: "stage-3d" },
        ]}
      />

      <ViewMenu />
      <IconButton label="Fit" hint="Show the whole barn (F)" onClick={requestFit} icon="fit" />
      <Popover
        testId="action-more"
        button={(open) => <IconButton label="More" hint="More actions" icon="more" active={open} />}
      >
        {(close) => (
          <>
            <MenuRow onClick={() => { (window as unknown as { __barnScreenshot?: () => void }).__barnScreenshot?.(); close(); }} testId="action-download">
              <Icon name="camera" size={16} /> Download picture (PNG)
            </MenuRow>
            <MenuRow onClick={() => { copyLink(); close(); }} testId="action-share">
              <Icon name="link" size={16} /> Copy link
            </MenuRow>
            <MenuRow onClick={() => { saveVersion(); close(); }}>
              <Icon name="plans" size={16} /> Save a version
            </MenuRow>
            <MenuDivider />
            <div className="px-2.5 py-1.5 text-[11px] leading-relaxed text-muted">
              <div className="mb-1 font-semibold text-foreground/80">Keyboard</div>
              Ctrl+Z undo · Ctrl+Shift+Z redo · Delete removes · arrows nudge · F fit · X cutaway · Esc backs out · Ctrl+1…7 steps
            </div>
          </>
        )}
      </Popover>
      {toast ? <div className="menu absolute right-3 top-[calc(100%+6px)] z-30 px-3 py-2 text-xs">{toast}</div> : null}
    </header>
  );
}

export function IconButton({ label, hint, onClick, disabled, icon, active, testId }: { label: string; hint?: string; onClick?: () => void; disabled?: boolean; icon: string; active?: boolean; testId?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={hint ?? label} data-testid={testId} aria-pressed={active} className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-35 ${active ? "bg-foreground text-background" : "text-muted hover:bg-black/5 hover:text-foreground"}`}>
      <Icon name={icon} size={18} />
    </button>
  );
}
