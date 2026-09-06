import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Project not found</h1>
      <p className="text-sm text-muted">It may have been deleted, or it belongs to another account.</p>
      <Link href="/" className="text-sm text-accent underline">
        Back to your barns
      </Link>
    </main>
  );
}
