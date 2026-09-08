import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { PackView } from "@/components/pack/PackView";

export const dynamic = "force-dynamic";

/** /p/[id]/pack — the printable blueprint set (SPEC §9). */
export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const project = await getProjectRepo().getProject(user.id, id);
  if (!project) notFound();
  return <PackView projectId={project.id} model={project.draftModel} />;
}
