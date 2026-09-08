"use client";

import type { ReactNode } from "react";

/** One printable sheet (Letter landscape) with a title block. */
export function Sheet({ n, total, code, title, project, date, children, className = "" }: { n: number; total: number; code: string; title: string; project: string; date: string; children: ReactNode; className?: string }) {
  return (
    <section className={`sheet ${className}`} data-testid={`sheet-${code}`} aria-label={`${code} ${title}`}>
      <header className="sheet-head">
        <div>
          <div className="sheet-code">{code}</div>
          <h2 className="sheet-title">{title}</h2>
        </div>
        <div className="sheet-meta">
          <div className="font-semibold">{project}</div>
          <div>
            {date} · sheet {n} of {total}
          </div>
          <div className="text-[9px] uppercase tracking-[0.12em]">Planning drawing — verify with your building department</div>
        </div>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

export function Table({ head, rows, className = "", testId }: { head: ReactNode[]; rows: ReactNode[][]; className?: string; testId?: string }) {
  return (
    <table className={`sheet-table ${className}`} data-testid={testId}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Notes({ title = "Notes", items }: { title?: string; items: ReactNode[] }) {
  return (
    <div className="sheet-notes">
      <div className="sheet-notes-title">{title}</div>
      <ol>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ol>
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="sheet-kv">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
