import { requireUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { parseBuildingModel } from "@/lib/model/schema";
import { errorResponse, json } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await getProjectRepo().getProject(user.id, id);
    if (!project) return json({ error: "Not found" }, { status: 404 });
    return json({ project });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Autosave endpoint: replaces the working draft. Body: { model: BuildingModel }. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as { model?: unknown };
    const model = parseBuildingModel(body.model);
    const res = await getProjectRepo().saveDraft(user.id, id, model);
    if (!res) return json({ error: "Not found" }, { status: 404 });
    return json({ ok: true, updatedAt: res.updatedAt });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const ok = await getProjectRepo().deleteProject(user.id, id);
    if (!ok) return json({ error: "Not found" }, { status: 404 });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
