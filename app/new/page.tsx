import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Header } from "@/components/site/Header";
import { NewBarnWizard } from "@/components/site/NewBarnWizard";

export const dynamic = "force-dynamic";

/** /new — the four-question wizard (UX audit §5.2). */
export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <NewBarnWizard />
      </main>
    </div>
  );
}
