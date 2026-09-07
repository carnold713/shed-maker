import type { ReactNode } from "react";

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/70 bg-panel shadow-[0_1px_2px_rgba(31,29,26,0.04),0_8px_24px_-16px_rgba(31,29,26,0.25)] ${className}`}>
      {title ? <h2 className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h2> : null}
      <div className="p-4 pt-2">{children}</div>
    </section>
  );
}
