import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { createDefaultModel } from "@/lib/model/defaults";

export const dynamic = "force-dynamic";

/**
 * /new — creates a default project and opens it. Template picker lands in M4;
 * for now query params ?w=24&d=36&name=... seed the rectangle.
 */
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const sp = await searchParams;
  const num = (v: string | string[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : undefined;
  };
  const name = typeof sp.name === "string" && sp.name.trim() ? sp.name.trim().slice(0, 120) : undefined;
  const model = createDefaultModel({ name, wFt: num(sp.w), dFt: num(sp.d) });
  const project = await getProjectRepo().createProject(user.id, model);
  redirect(`/p/${project.id}`);
}
