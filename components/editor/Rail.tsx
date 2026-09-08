"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ViewMode } from "./Toolbar";

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cube: "M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2zm0 0v9m8-4.5L12 11 4 6.5",
  plan: "M4 4h16v16H4zM4 12h8m0 0v8m0-8V4",
  split: "M4 5h16v14H4zM12 5v14",
  frame: "M4 20V8l8-5 8 5v12M4 12h16M8 20V9m8 11V9",
  check: "M9 12l2 2 4-4m-3 10a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  pack: "M4 7h16v13H4zM4 7l2-3h12l2 3M9 11h6",
  help: "M12 17h.01M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4m0 7a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  project: "M4 5h16v14H4zM4 10h16M9 10v9",
} as const;

function RailButton({ label, active, onClick, children, testId }: { label: string; active?: boolean; onClick?: () => void; children: ReactNode; testId?: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
      className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${active ? "bg-accent text-white shadow-[0_8px_18px_-8px_rgba(238,125,43,0.9)]" : "text-muted hover:bg-black/5 hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

/** Left icon rail (reference layout): logo, mode switches, utilities. */
export function Rail({ view, onView, onCheck, onPack, onProject, projectOpen }: { view: ViewMode; onView: (v: ViewMode) => void; onCheck: () => void; onPack: () => void; onProject: () => void; projectOpen: boolean }) {
  return (
    <nav className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-border/60 bg-panel py-3">
      <Link href="/" className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_8px_18px_-8px_rgba(238,125,43,0.9)]" title="Your barns" aria-label="Your barns">
        <Icon d={ICONS.home} />
      </Link>
      <span className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-muted">MENU</span>
      <div className="2xl:hidden">
        <RailButton label="Project panel" active={projectOpen} onClick={onProject} testId="rail-project">
          <Icon d={ICONS.project} />
        </RailButton>
      </div>
      <RailButton label="3D view" active={view === "3d"} onClick={() => onView("3d")} testId="rail-3d">
        <Icon d={ICONS.cube} />
      </RailButton>
      <RailButton label="Plan" active={view === "plan"} onClick={() => onView("plan")} testId="rail-plan">
        <Icon d={ICONS.plan} />
      </RailButton>
      <RailButton label="Split view" active={view === "split"} onClick={() => onView("split")} testId="rail-split">
        <Icon d={ICONS.split} />
      </RailButton>
      <RailButton label="Checks" onClick={onCheck} testId="rail-checks">
        <Icon d={ICONS.check} />
      </RailButton>
      <RailButton label="Builder pack (coming in M4)" onClick={onPack}>
        <Icon d={ICONS.pack} />
      </RailButton>
      <div className="mt-auto flex flex-col gap-2">
        <a href="https://github.com/carnold713/shed-maker/blob/claude/barn-designer-handoff-da76fh/docs/SPEC.md" target="_blank" rel="noreferrer" className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted hover:bg-black/5 hover:text-foreground" title="Spec" aria-label="Spec">
          <Icon d={ICONS.help} />
        </a>
      </div>
    </nav>
  );
}
