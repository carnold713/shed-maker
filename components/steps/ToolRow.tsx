"use client";

import type { ReactNode } from "react";
import { useViewStore, type PlanTool } from "@/lib/store/useViewStore";
import { Icon } from "@/components/ui/Icon";

/** One row of tool buttons for a step; an armed tool shows pressed (UX audit §3.7). */
export function ToolRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" data-testid="tool-row">
      {children}
    </div>
  );
}

export function ToolButton({ tool, icon, label, keyHint, hint, testId }: { tool: PlanTool; icon: string; label: string; keyHint?: string; hint: string; testId: string }) {
  const active = useViewStore((s) => s.tool === tool);
  const setTool = useViewStore((s) => s.setTool);
  return (
    <button
      onClick={() => setTool(active && tool !== "select" ? "select" : tool)}
      aria-pressed={active}
      title={`${hint}${keyHint ? ` (${keyHint})` : ""}`}
      data-testid={testId}
      className={`flex min-w-[3.6rem] flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-medium transition ${active ? "border-accent bg-accent text-white shadow-[0_6px_14px_-8px_rgba(238,125,43,0.9)]" : "border-border/80 bg-background/60 text-foreground/80 hover:bg-background"}`}
    >
      <Icon name={icon} size={18} />
      {label}
    </button>
  );
}

/** A select that also arms its tool when changed (picking a variant arms the tool). */
export function ToolSelect<T extends string>({ value, onChange, options, label, testId }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; group?: string }[]; label: string; testId?: string }) {
  const groups = [...new Set(options.map((o) => o.group ?? ""))];
  return (
    <label className="flex items-center gap-2 text-[12px] text-muted">
      <span className="shrink-0">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-2 py-1 text-[12.5px] text-foreground focus:border-accent focus:outline-none" data-testid={testId} aria-label={label}>
        {groups.map((g) =>
          g ? (
            <optgroup key={g} label={g}>
              {options.filter((o) => (o.group ?? "") === g).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            options.filter((o) => !o.group).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </select>
    </label>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background/50 px-3 py-3 text-[12.5px] leading-relaxed text-muted" data-testid="empty-state">
      <div className="font-medium text-foreground/80">{title}</div>
      {children}
    </div>
  );
}

/** A list of things in the model that can be clicked to select them. */
export function ItemList({ items }: { items: { id: string; label: string; detail?: string; icon?: string; warn?: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-0.5" data-testid="item-list">
      {items.map((it) => (
        <li key={it.id}>
          <ItemRow {...it} />
        </li>
      ))}
    </ul>
  );
}

function ItemRow({ id, label, detail, icon, warn }: { id: string; label: string; detail?: string; icon?: string; warn?: boolean }) {
  const select = (useProjectSelect() as (id: string) => void);
  const hovered = useViewStore((s) => s.hovered);
  const setHovered = useViewStore((s) => s.setHovered);
  return (
    <button onClick={() => select(id)} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition hover:bg-black/5 ${hovered === id ? "bg-black/5" : ""}`} data-testid={`item-${id}`}>
      {icon ? <Icon name={icon} size={15} className="shrink-0 text-muted" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail ? <span className="shrink-0 font-mono text-[11px] text-muted">{detail}</span> : null}
      {warn ? <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="has a warning" /> : null}
    </button>
  );
}

import { useProjectStore } from "@/lib/store/useProjectStore";
function useProjectSelect() {
  return useProjectStore((s) => s.select);
}
