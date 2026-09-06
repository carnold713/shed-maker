import type { ReactNode } from "react";

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-panel ${className}`}>
      {title ? <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2> : null}
      <div className="p-3">{children}</div>
    </section>
  );
}
