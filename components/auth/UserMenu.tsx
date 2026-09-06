"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function UserMenu({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted" title="Clerk keys not set — running as a local dev user">
        Dev user
      </span>
    );
  }
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">Sign in</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  );
}
