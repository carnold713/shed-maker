import type { ReactNode } from "react";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-[12.5px] font-medium text-foreground/85">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-accent focus:bg-panel focus:ring-2 focus:ring-accent/20";

/** A labelled on/off switch. */
export function Toggle({ checked, onChange, label, hint, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; testId?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
        <input type="checkbox" className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
        <span className="absolute inset-0 rounded-full bg-border transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
      <span className="flex flex-col">
        <span>{label}</span>
        {hint ? <span className="text-[11px] leading-snug text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Section heading inside the dock. */
export function Section({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
