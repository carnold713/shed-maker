import Link from "next/link";
import type { ReactNode } from "react";
import { isClerkConfigured } from "@/lib/auth";
import { UserMenu } from "@/components/auth/UserMenu";

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          Barn Designer
        </Link>
        {children}
      </div>
      <UserMenu enabled={isClerkConfigured()} />
    </header>
  );
}
