import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { createDefaultModel } from "@/lib/model/defaults";
import { parseBuildingModel } from "@/lib/model/schema";
import { errorResponse, json } from "@/lib/api";

export const dynamic = "force-dynamic";

const CreateBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    wFt: z.number().positive().max(200).optional(),
    dFt: z.number().positive().max(200).optional(),
    model: z.unknown().optional(),
  })
  .default({});

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await getProjectRepo().listProjects(user.id);
    return json({ projects });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const raw = req.headers.get("content-length") === "0" ? {} : await req.json().catch(() => ({}));
    const body = CreateBody.parse(raw);
    const model = body.model ? parseBuildingModel(body.model) : createDefaultModel({ name: body.name, wFt: body.wFt, dFt: body.dFt });
    const project = await getProjectRepo().createProject(user.id, model);
    return json({ project: { id: project.id, name: project.name } }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
