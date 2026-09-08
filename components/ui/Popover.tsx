"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Button that opens a small panel below it; closes on outside click or Escape. */
export function Popover({ button, children, align = "right", className = "", testId, panelTestId, open: controlledOpen, onOpenChange }: { button: (open: boolean) => ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: "left" | "right"; className?: string; testId?: string; panelTestId?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [inner, setInner] = useState(false);
  const open = controlledOpen ?? inner;
  const setOpen = (o: boolean) => {
    setInner(o);
    onOpenChange?.(o);
  };
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <div onClick={() => setOpen(!open)} data-testid={testId}>
        {button(open)}
      </div>
      {open ? (
        <div className={`menu absolute top-[calc(100%+6px)] z-40 min-w-[18rem] p-1.5 ${align === "right" ? "right-0" : "left-0"}`} role="menu" data-testid={panelTestId}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuRow({ children, onClick, active, disabled, testId, hint }: { children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; testId?: string; hint?: string }) {
  return (
    <button role="menuitemcheckbox" aria-checked={!!active} disabled={disabled} onClick={onClick} data-testid={testId} title={hint} className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-[13px] transition disabled:opacity-40 ${active ? "bg-accent/12 text-accent" : "hover:bg-black/5"}`}>
      <span className="flex items-center gap-2">{children}</span>
      {active ? <span aria-hidden>✓</span> : null}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-0.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</div>;
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-border/80" />;
}
