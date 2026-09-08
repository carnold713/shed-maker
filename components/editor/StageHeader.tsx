"use client";

import { useState } from "react";
import { useProjectStore, useTemporal } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { formatFtIn } from "@/lib/units";

function Icon({ d }: { d: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Action({ label, d, onClick, testId }: { label: string; d: string; onClick: () => void; testId?: string }) {
  return (
    <button onClick={onClick} data-testid={testId} className="glass flex h-14 w-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-foreground transition hover:-translate-y-px">
      <Icon d={d} />
      {label}
    </button>
  );
}

/** Hero title over the stage with Share / Download / More (reference layout). */
export function StageHeader() {
  const model = useProjectStore((s) => s.model)!;
  const { undo, redo, canUndo, canRedo } = useTemporal();
  const openContextMenu = useViewStore((s) => s.openContextMenu);
  const [toast, setToast] = useState<string | null>(null);
  const fp = model.footprint.kind === "rect" ? model.footprint : null;
  const pens = model.zones.filter((z) => z.type === "pen").length;
  const subtitle = [
    fp ? `${formatFtIn(fp.wFt)} × ${formatFtIn(fp.dFt)} ${model.frame.system === "postFrame" ? "post-frame" : "stick-frame"}` : "",
    fp ? `${fp.wFt * fp.dFt} sq ft` : "",
    pens ? `${pens} ${pens === 1 ? "stall" : "stalls"}` : "",
    model.openings.length ? `${model.openings.length} openings` : "",
    model.leanTos.length ? `${model.leanTos.length} lean-to${model.leanTos.length > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Link copied — share links with builder access arrive in M4");
    } catch {
      setToast(window.location.href);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-5">
      <div className="pointer-events-auto max-w-[60%]">
        <h1 className="truncate text-[2.2rem] font-semibold leading-none tracking-[-0.02em] text-foreground" data-testid="stage-title">
          {model.meta.name}
        </h1>
        <p className="mt-2 text-sm text-muted">{model.meta.notes?.split("\n")[0] || subtitle}</p>
        {model.meta.notes ? <p className="text-xs text-muted/80">{subtitle}</p> : null}
        <div className="mt-3 flex items-center gap-1">
          <button onClick={() => undo()} disabled={!canUndo} className="chip glass !rounded-xl px-2.5 text-xs disabled:opacity-40" aria-label="Undo" title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button onClick={() => redo()} disabled={!canRedo} className="chip glass !rounded-xl px-2.5 text-xs disabled:opacity-40" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
            ↷ Redo
          </button>
        </div>
      </div>
      <div className="pointer-events-auto flex items-start gap-2">
        <Action label="Share" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" onClick={share} testId="action-share" />
        <Action label="Download" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" onClick={() => (window as unknown as { __barnScreenshot?: () => void }).__barnScreenshot?.()} testId="action-download" />
        <Action label="More" d="M5 12h.01M12 12h.01M19 12h.01" onClick={(e?: unknown) => { const ev = e as MouseEvent | undefined; openContextMenu({ kind: "viewport", x: ev?.clientX ?? window.innerWidth - 120, y: ev?.clientY ?? 90, from: "3d" }); }} testId="action-more" />
      </div>
      {toast ? <div className="glass pointer-events-auto absolute right-5 top-24 px-3 py-2 text-xs">{toast}</div> : null}
    </div>
  );
}
