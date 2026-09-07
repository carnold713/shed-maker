"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: ReactNode;
  onSelect?: () => void;
  children?: MenuItem[];
  disabled?: boolean;
  separator?: boolean;
  shortcut?: string;
  danger?: boolean;
}

/**
 * Right-click menu (SPEC §21.1). Positioned at the cursor, flips to stay on
 * screen, supports one level of submenu on hover. Closes on Escape, outside
 * click, or selection.
 */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = x + r.width > window.innerWidth - 8 ? Math.max(8, x - r.width) : x;
    const ny = y + r.height > window.innerHeight - 8 ? Math.max(8, window.innerHeight - r.height - 8) : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="menu" data-testid="context-menu" className="fixed z-50 min-w-48 rounded-md border border-border bg-panel py-1 text-sm shadow-lg" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}

function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul>
      {items.map((it, i) =>
        it.separator ? (
          <li key={i} className="my-1 border-t border-border" />
        ) : (
          <li key={i} className="relative" onMouseEnter={() => setOpen(it.children ? i : null)}>
            <button
              role="menuitem"
              disabled={it.disabled}
              className={`flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left hover:bg-background disabled:opacity-40 ${it.danger ? "text-red-700" : ""}`}
              onClick={() => {
                if (it.children) return;
                it.onSelect?.();
                onClose();
              }}
            >
              <span>{it.label}</span>
              {it.children ? <span className="text-muted">›</span> : it.shortcut ? <span className="font-mono text-[11px] text-muted">{it.shortcut}</span> : null}
            </button>
            {it.children && open === i ? <Submenu items={it.children} onClose={onClose} /> : null}
          </li>
        ),
      )}
    </ul>
  );
}

/** Submenu that flips upward and scrolls when it would run off the viewport. */
function Submenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ top: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next: React.CSSProperties = {};
    if (r.bottom > window.innerHeight - 8) {
      const overflow = r.bottom - (window.innerHeight - 8);
      next.top = -Math.min(overflow, r.top - 8);
    } else next.top = 0;
    if (r.right > window.innerWidth - 8) {
      next.left = "auto";
      next.right = "100%";
    }
    setStyle(next);
  }, []);
  return (
    <div ref={ref} className="absolute left-full -ml-1 max-h-[80vh] min-w-44 overflow-y-auto rounded-md border border-border bg-panel py-1 shadow-lg" style={style}>
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}
