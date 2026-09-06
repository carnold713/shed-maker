import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getProjectRepo } from "@/lib/repo";
import { Header } from "@/components/site/Header";
import { NewProjectButton } from "@/components/site/NewProjectButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const projects = user ? await getProjectRepo().listProjects(user.id) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your barns</h1>
            <p className="mt-1 text-sm text-muted">
              Design inside-out or outside-in. Framing, materials, and plan sheets come from the same model.
            </p>
          </div>
          {user ? <NewProjectButton /> : null}
        </div>

        {!user ? (
          <p className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">Sign in to create and save projects.</p>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-panel p-10 text-center">
            <p className="text-base font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted">Start with a 24×36 post-frame default and shape it from there.</p>
            <div className="mt-4 flex justify-center">
              <NewProjectButton />
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="block rounded-lg border border-border bg-panel p-4 transition hover:border-accent">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{p.footprint}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">Updated {new Date(p.updatedAt).toLocaleString()}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <footer className="border-t border-border px-6 py-4 text-xs text-muted">
        Planning and communication aid — not a substitute for an engineer, architect, or your building department.
      </footer>
    </div>
  );
}
