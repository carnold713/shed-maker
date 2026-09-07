import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-accent-foreground shadow-[0_6px_16px_-8px_rgba(238,125,43,0.8)] hover:brightness-105",
    secondary: "border border-border bg-panel text-foreground shadow-sm hover:bg-background",
    ghost: "text-foreground hover:bg-black/5",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}
