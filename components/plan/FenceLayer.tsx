"use client";

import type { BuildingModel, Fence } from "@/lib/model/schema";
import { FENCE_PRESETS } from "@/lib/model/runs";
import { fenceAreaSqFt, fenceLengthFt, fenceSegments, formatArea, pointOnFence, type Pt } from "@/lib/model/fences";

/** Free fence lines on the plan: the lines with post ticks and gates, the one being drawn, and corner handles on the selected fence. */
export function FenceLayer({
  model,
  px,
  py,
  scale,
  selection,
  hovered,
  draft,
  draftHover,
  onPointerDown,
  onPointerDownVertex,
  onContextMenu,
  onContextMenuVertex,
  onHover,
  showHandles,
}: {
  model: BuildingModel;
  px: (x: number) => number;
  py: (y: number) => number;
  scale: number;
  selection: string | null;
  hovered: string | null;
  /** Fence being drawn, plan feet. */
  draft: Pt[];
  /** Snapped pointer position while drawing. */
  draftHover: Pt | null;
  onPointerDown: (f: Fence, e: React.PointerEvent<SVGGElement>) => void;
  onPointerDownVertex: (f: Fence, index: number, e: React.PointerEvent<SVGCircleElement>) => void;
  onContextMenu: (f: Fence, e: React.MouseEvent<SVGGElement>) => void;
  onContextMenuVertex: (f: Fence, index: number, e: React.MouseEvent<SVGCircleElement>) => void;
  onHover: (id: string | null) => void;
  showHandles: boolean;
}) {
  const tick = Math.max(1.2, Math.min(2.4, scale * 0.18));
  return (
    <g data-testid="fence-layer">
      {model.fences.map((f) => {
        const sel = selection === f.id;
        const hov = hovered === f.id;
        const stroke = sel ? "#b5532a" : hov ? "#4f7a3a" : "#3f6b2e";
        const segs = fenceSegments(f);
        const pts = f.points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
        const area = fenceAreaSqFt(f);
        const cx = f.points.reduce((s, p) => s + p.x, 0) / f.points.length;
        const cy = f.points.reduce((s, p) => s + p.y, 0) / f.points.length;
        const preset = FENCE_PRESETS[f.kind];
        return (
          <g key={f.id} className="cursor-pointer" onPointerDown={(e) => onPointerDown(f, e)} onContextMenu={(e) => onContextMenu(f, e)} onMouseEnter={() => onHover(f.id)} onMouseLeave={() => onHover(null)} data-testid="plan-fence" data-fence-id={f.id}>
            {f.closed ? <polygon points={pts} fill="#c3d9ab" fillOpacity={sel ? 0.5 : 0.3} stroke="none" /> : null}
            {/* fat invisible hit line */}
            {f.closed ? <polygon points={pts} fill="none" stroke="transparent" strokeWidth={10} /> : <polyline points={pts} fill="none" stroke="transparent" strokeWidth={10} />}
            {f.closed ? <polygon points={pts} fill="none" stroke={stroke} strokeWidth={sel ? 2.2 : 1.6} strokeDasharray={preset.material === "board" ? undefined : "6 3"} strokeLinejoin="round" /> : <polyline points={pts} fill="none" stroke={stroke} strokeWidth={sel ? 2.2 : 1.6} strokeDasharray={preset.material === "board" ? undefined : "6 3"} strokeLinejoin="round" />}
            {/* post ticks along each straight */}
            {segs.flatMap((s) => {
              const n = Math.max(1, Math.ceil(s.lengthFt / preset.postSpacingFt));
              return Array.from({ length: n + 1 }, (_, i) => {
                const t = i / n;
                return <circle key={`${s.i}_${i}`} cx={px(s.a.x + (s.b.x - s.a.x) * t)} cy={py(s.a.y + (s.b.y - s.a.y) * t)} r={tick} fill={stroke} />;
              });
            })}
            {/* gates */}
            {f.gates.map((g) => {
              const a = pointOnFence(f, g.seg, g.offsetFt);
              const b = pointOnFence(f, g.seg, g.offsetFt + g.widthFt);
              if (!a || !b) return null;
              return (
                <g key={g.id} data-testid="plan-fence-gate">
                  <line x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} stroke="#f3f0ea" strokeWidth={sel ? 5 : 4} />
                  <line x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} stroke={stroke} strokeWidth={1.2} strokeDasharray="2 2" />
                </g>
              );
            })}
            <text x={px(cx)} y={py(cy) - 4} textAnchor="middle" fontSize={Math.max(9, Math.min(12, scale * 0.9))} fontWeight={600} fill="#2f4a22" pointerEvents="none">
              {f.name}
            </text>
            <text x={px(cx)} y={py(cy) + 9} textAnchor="middle" fontSize={Math.max(8, Math.min(10.5, scale * 0.75))} fill="#3f6b2e" pointerEvents="none">
              {Math.round(fenceLengthFt(f)).toLocaleString()}′ of fence{area ? ` · ${formatArea(area)}` : ""}
            </text>
          </g>
        );
      })}
      {/* corner handles on the selected fence */}
      {model.fences
        .filter((f) => showHandles && f.id === selection)
        .map((f) => (
          <g key={`fh_${f.id}`}>
            {f.points.map((p, i) => (
              <circle key={i} cx={px(p.x)} cy={py(p.y)} r={5.5} fill="#ffffff" stroke="#b5532a" strokeWidth={1.5} style={{ cursor: "move" }} onPointerDown={(e) => onPointerDownVertex(f, i, e)} onContextMenu={(e) => onContextMenuVertex(f, i, e)} data-testid="fence-vertex" />
            ))}
          </g>
        ))}
      {/* the fence being drawn */}
      {draft.length ? (
        <g pointerEvents="none" data-testid="fence-draft">
          <polyline points={[...draft, ...(draftHover ? [draftHover] : [])].map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} fill="none" stroke="#b5532a" strokeWidth={1.8} strokeDasharray="6 3" />
          {draft.map((p, i) => (
            <circle key={i} cx={px(p.x)} cy={py(p.y)} r={i === 0 ? 6 : 3.5} fill={i === 0 ? "#fff" : "#b5532a"} stroke="#b5532a" strokeWidth={1.5} />
          ))}
          {draftHover && draft.length ? (
            <text x={px(draftHover.x) + 8} y={py(draftHover.y) - 8} fontSize={10} fill="#b5532a">
              {Math.round(Math.hypot(draftHover.x - draft[draft.length - 1].x, draftHover.y - draft[draft.length - 1].y))}′
            </text>
          ) : null}
        </g>
      ) : draftHover ? (
        <circle cx={px(draftHover.x)} cy={py(draftHover.y)} r={4} fill="none" stroke="#b5532a" strokeWidth={1.5} pointerEvents="none" />
      ) : null}
    </g>
  );
}
