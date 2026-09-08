"use client";

import type { ReactNode } from "react";

/** Inspector column docked to the right of the stage (in flow, never over the canvas). */
export function InspectorDock({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="relative flex shrink-0">
      <button
        onClick={onToggle}
        className="absolute -left-7 top-1/2 z-20 flex h-16 w-7 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-border/70 bg-panel/90 text-xs text-muted shadow-sm hover:text-foreground"
        aria-expanded={open}
        title={open ? "Hide properties" : "Show properties"}
        data-testid="inspector-toggle"
      >
        {open ? "›" : "‹"}
      </button>
      {open ? (
        <aside className="flex h-full w-[21rem] flex-col gap-3 overflow-y-auto border-l border-border/60 bg-panel/70 p-3 backdrop-blur" data-testid="inspector-dock">
          {children}
        </aside>
      ) : null}
    </div>
  );
}
