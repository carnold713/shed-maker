/**
 * Drawing a fence line point by point (ADR-0017 addendum). The draft lives in
 * the view store so the plan and the site map share it; finishing it adds a
 * fence to the model. Used by PlanView and SiteMap.
 */
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { snapFencePoint, type Pt } from "@/lib/model/fences";

/** Snap a pointer position for the fence tool: nearby corners, then the half-foot grid. */
export function snapDraftPoint(p: Pt): Pt {
  const model = useProjectStore.getState().model;
  const draft = useViewStore.getState().fenceDraft;
  return model ? snapFencePoint(model, p, draft) : p;
}

/** Is `p` on the draft's first point (closing the loop)? */
export function closesDraft(p: Pt, withinFt: number): boolean {
  const draft = useViewStore.getState().fenceDraft;
  if (draft.length < 3) return false;
  return Math.hypot(draft[0].x - p.x, draft[0].y - p.y) <= withinFt;
}

/** Add a point; clicking the first point again closes the fence. Returns the new fence id when one was made. */
export function addDraftPoint(p: Pt, closeWithinFt = 1.5): string | null {
  const vs = useViewStore.getState();
  if (closesDraft(p, closeWithinFt)) return finishDraft(true);
  const q = snapDraftPoint(p);
  const last = vs.fenceDraft[vs.fenceDraft.length - 1];
  if (last && Math.abs(last.x - q.x) < 1e-6 && Math.abs(last.y - q.y) < 1e-6) return null;
  vs.setFenceDraft([...vs.fenceDraft, q]);
  return null;
}

export function undoDraftPoint() {
  const vs = useViewStore.getState();
  vs.setFenceDraft(vs.fenceDraft.slice(0, -1));
}

/** Turn the draft into a fence (needs 2 points; 3 to close). Returns the id or null. */
export function finishDraft(closed: boolean): string | null {
  const vs = useViewStore.getState();
  const ps = useProjectStore.getState();
  const pts = vs.fenceDraft;
  vs.setFenceDraft([]);
  if (pts.length < 2) return null;
  const id = ps.addFence({ points: pts, closed: closed && pts.length >= 3 });
  if (id) ps.select(id);
  return id;
}

export function cancelDraft() {
  useViewStore.getState().setFenceDraft([]);
}

export const FENCE_TOOL_HINT = "Click to start a fence · click each corner · click the first corner again to close it around a paddock · double-click or Enter to finish a line · Backspace undoes a corner · Esc cancels";
