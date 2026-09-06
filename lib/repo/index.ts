import "server-only";
import { hasDatabase } from "@/lib/db";
import type { ProjectRepo } from "./types";

export type * from "./types";

let warned = false;

export function getProjectRepo(): ProjectRepo {
  if (hasDatabase()) {
    // Lazy require keeps @prisma/client out of the bundle path when unused.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./prisma") as typeof import("./prisma")).prismaRepo;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_REPO !== "1") {
    throw new Error("DATABASE_URL is required in production");
  }
  if (!warned) {
    warned = true;
    console.warn("[repo] DATABASE_URL not set — using in-memory project store (dev only).");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("./memory") as typeof import("./memory")).memoryRepo;
}
