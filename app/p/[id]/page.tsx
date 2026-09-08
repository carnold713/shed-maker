import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { Editor } from "@/components/editor/Editor";
import type { Step } from "@/lib/store/useViewStore";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const step = typeof sp.step === "string" ? (sp.step as Step) : undefined;
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const project = await getProjectRepo().getProject(user.id, id);
  if (!project) notFound();
  return <Editor projectId={project.id} initialModel={project.draftModel} initialStep={step} />;
}
