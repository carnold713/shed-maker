"use client";

/** Segmented control: one choice among a few, always visible. */
export function Segmented<T extends string>({ value, options, onChange, size = "sm", testId }: { value: T; options: { value: T; label: string; title?: string; testId?: string }[]; onChange: (v: T) => void; size?: "sm" | "md"; testId?: string }) {
  return (
    <div className="inline-flex rounded-xl border border-border/80 bg-background/70 p-0.5" role="group" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          title={o.title}
          data-testid={o.testId}
          className={`rounded-[9px] font-medium transition ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${value === o.value ? "bg-foreground text-background shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
