import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof UnauthorizedError) return json({ error: "Unauthorized" }, { status: 401 });
  if (err instanceof ZodError) {
    return json({ error: "Invalid model", issues: err.issues.slice(0, 20) }, { status: 400 });
  }
  if (err instanceof SyntaxError) return json({ error: "Malformed JSON" }, { status: 400 });
  console.error(err);
  return json({ error: "Internal error" }, { status: 500 });
}
