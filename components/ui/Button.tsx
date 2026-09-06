import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-accent-foreground hover:brightness-95",
    secondary: "border border-border bg-panel text-foreground hover:bg-background",
    ghost: "text-foreground hover:bg-black/5",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}
