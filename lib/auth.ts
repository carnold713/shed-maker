import "server-only";

/**
 * Auth boundary. Clerk is the real provider; when Clerk keys are absent
 * (local dev, CI, preview without secrets) we fall back to a single
 * deterministic dev user so the app remains runnable. See ADR-0002.
 */
export interface CurrentUser {
  /** Our User.id (cuid) — resolved from clerkId on first sight. */
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
}

export const DEV_USER: CurrentUser = {
  id: "dev_user",
  clerkId: "dev_clerk",
  email: "dev@localhost",
  name: "Dev User",
};

export function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

/** Returns the signed-in user or null. Never throws for "not signed in". */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isClerkConfigured()) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_AUTH !== "1") {
      return null;
    }
    return DEV_USER;
  }
  const { currentUser } = await import("@clerk/nextjs/server");
  const u = await currentUser();
  if (!u) return null;
  const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? "";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
  const { getProjectRepo } = await import("@/lib/repo");
  const dbUser = await getProjectRepo().upsertUser({ clerkId: u.id, email, name });
  return { id: dbUser.id, clerkId: u.id, email, name };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new UnauthorizedError();
  return u;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
