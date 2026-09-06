import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { errorResponse, json } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ label: z.string().max(120).optional() }).default({});

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const versions = await getProjectRepo().listVersions(user.id, id);
    return json({ versions });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Explicit "Save version" — snapshots the current draft as an immutable ProjectVersion. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = Body.parse(await req.json().catch(() => ({})));
    const version = await getProjectRepo().createVersion(user.id, id, body.label?.trim() || null);
    if (!version) return json({ error: "Not found" }, { status: 404 });
    return json({ version }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
