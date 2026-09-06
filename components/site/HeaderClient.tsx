"use client";

import Link from "next/link";
import { useAuthEnabled } from "@/components/auth/AuthProvider";
import { UserMenu } from "@/components/auth/UserMenu";

/** Client-safe header for client-rendered routes (the editor). */
export function Header() {
  const enabled = useAuthEnabled();
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
      <Link href="/" className="font-semibold tracking-tight">
        Barn Designer
      </Link>
      <UserMenu enabled={enabled} />
    </header>
  );
}
