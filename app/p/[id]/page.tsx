import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { Editor } from "@/components/editor/Editor";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const project = await getProjectRepo().getProject(user.id, id);
  if (!project) notFound();
  return <Editor projectId={project.id} initialModel={project.draftModel} />;
}
