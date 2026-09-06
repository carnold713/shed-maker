"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function NewProjectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
            if (!res.ok) throw new Error(`Create failed (${res.status})`);
            const { project } = (await res.json()) as { project: { id: string } };
            router.push(`/p/${project.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Create failed");
            setBusy(false);
          }
        }}
      >
        {busy ? "Creating…" : "New barn"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
