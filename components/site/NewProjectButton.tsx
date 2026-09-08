import Link from "next/link";

/** Primary call to action: the wizard lives at /new. */
export function NewProjectButton() {
  return (
    <Link href="/new" className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_6px_16px_-8px_rgba(238,125,43,0.8)] transition hover:brightness-105 active:translate-y-px" data-testid="new-barn">
      New barn
    </Link>
  );
}
