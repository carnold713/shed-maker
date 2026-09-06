import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/s/(.*)", "/api/health"]);

/**
 * With Clerk keys present every non-public route requires a session.
 * Without keys (local dev) requests pass straight through and lib/auth
 * substitutes a dev user — see ADR-0002.
 */
const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export default clerkConfigured ? withClerk : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
