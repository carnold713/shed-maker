"use client";

import { useMemo, useRef } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { derivePartitions } from "@/lib/interior/partitions";
import { zoneRect } from "@/lib/model/zones";
import { siteExtent } from "@/lib/model/runs";
import { zoneFill } from "@/components/plan/ZoneLayer";
import { Icon } from "@/components/ui/Icon";

const W_PX = 236;
const H_PX = 180;

/**
 * Miniature overhead plan in the corner of the 3D view (street-view style).
 * Click anywhere to drop in at that spot at eye height; drag the person to
 * move; the cone shows where the camera looks. Eye height is a person's.
 */
export function MiniMap() {
  const model = useProjectStore((s) => s.model)!;
  const partitions = useMemo(() => derivePartitions(model), [model]);
  const walk = useViewStore((s) => s.walk);
  const startWalk = useViewStore((s) => s.startWalk);
  const stopWalk = useViewStore((s) => s.stopWalk);
  const setWalk = useViewStore((s) => s.setWalk);
  const svgRef = useRef<SVGSVGElement>(null);

  const ext = useMemo(() => {
    const e = siteExtent(model);
    // Keep the barn readable: cap the map at the barn plus 40' around it when runs sprawl.
    const fp = model.footprint.kind === "rect" ? model.footprint : { wFt: 24, dFt: 36 };
    const x0 = Math.max(e.x, -40);
    const y0 = Math.max(e.y, -40);
    const x1 = Math.min(e.x + e.w, fp.wFt + 40);
    const y1 = Math.min(e.y + e.d, fp.dFt + 40);
    return { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
  }, [model]);
  const pad = 8;
  const scale = Math.min((W_PX - 2 * pad) / ext.w, (H_PX - 2 * pad) / ext.d);
  const ox = pad + ((W_PX - 2 * pad) - ext.w * scale) / 2 - ext.x * scale;
  const oy = H_PX - pad - ((H_PX - 2 * pad) - ext.d * scale) / 2 + ext.y * scale;
  const px = (x: number) => ox + x * scale;
  const py = (y: number) => oy - y * scale;
  const toPlan = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: Math.round(((e.clientX - r.left - ox) / scale) * 2) / 2, y: Math.round(((oy - (e.clientY - r.top)) / scale) * 2) / 2 };
  };
  const fp = model.footprint.kind === "rect" ? model.footprint : null;
  const yaw = (walk.yawDeg * Math.PI) / 180;
  const coneFt = Math.max(6, Math.min(14, ext.w * 0.25));
  const half = ((walk.fovDeg / 2) * Math.PI) / 180;
  const cone = [
    [walk.x, walk.y],
    [walk.x + Math.sin(yaw - half) * coneFt, walk.y + Math.cos(yaw - half) * coneFt],
    [walk.x + Math.sin(yaw) * coneFt * 1.15, walk.y + Math.cos(yaw) * coneFt * 1.15],
    [walk.x + Math.sin(yaw + half) * coneFt, walk.y + Math.cos(yaw + half) * coneFt],
  ]
    .map(([x, y]) => `${px(x)},${py(y)}`)
    .join(" ");

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = toPlan(e);
    startWalk(p.x, p.y);
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const q = toPlan(ev);
      setWalk({ x: q.x, y: q.y });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  return (
    <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 rounded-xl border border-border/70 bg-white/92 p-1.5 shadow-lg backdrop-blur" data-testid="mini-map" data-walk-on={walk.on ? "1" : "0"} data-walk-x={walk.x} data-walk-y={walk.y} data-walk-yaw={Math.round(walk.yawDeg)} data-walk-eye={walk.eyeFt}>
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-semibold text-foreground/80">{walk.on ? "Walking inside" : "Click to stand here"}</span>
        <label className="flex items-center gap-1 text-[11px] text-muted" title="Eye height above the floor">
          Eyes
          <input type="number" min={1} max={12} step={0.5} value={walk.eyeFt} onChange={(e) => setWalk({ eyeFt: Number(e.target.value) || 6 })} className="w-12 rounded border border-border/70 bg-white px-1 py-0.5 text-right font-mono text-[11px]" data-testid="walk-eye" />
          ft
        </label>
      </div>
      <svg ref={svgRef} width={W_PX} height={H_PX} className="cursor-crosshair rounded-lg bg-[#f3f0ea]" onPointerDown={onDown} onContextMenu={(e) => e.preventDefault()} data-testid="mini-map-svg">
        {/* runs and fences */}
        {model.runs.map((r) => (
          <rect key={r.id} x={px(r.rect.x)} y={py(r.rect.y + r.rect.d)} width={r.rect.w * scale} height={r.rect.d * scale} fill="#c3d9ab" stroke="#3f6b2e" strokeWidth={0.8} strokeDasharray="3 2" />
        ))}
        {model.fences.map((f) => {
          const pts = f.points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
          return f.closed ? <polygon key={f.id} points={pts} fill="#c3d9ab" fillOpacity={0.5} stroke="#3f6b2e" strokeWidth={0.8} strokeDasharray="3 2" /> : <polyline key={f.id} points={pts} fill="none" stroke="#3f6b2e" strokeWidth={0.8} strokeDasharray="3 2" />;
        })}
        {/* barn */}
        {fp ? <rect x={px(0)} y={py(fp.dFt)} width={fp.wFt * scale} height={fp.dFt * scale} fill="#ffffff" stroke="#1c1b19" strokeWidth={1.4} /> : null}
        {model.zones.map((z) => {
          const r = zoneRect(z);
          return <rect key={z.id} x={px(r.x)} y={py(r.y + r.d)} width={r.w * scale} height={r.d * scale} fill={zoneFill(z)} fillOpacity={0.7} stroke="none" />;
        })}
        {partitions.map((p) => <line key={p.id} x1={px(p.x0)} y1={py(p.y0)} x2={px(p.x1)} y2={py(p.y1)} stroke="#4a4741" strokeWidth={0.9} />)}
        {/* doors as gaps in the outline */}
        {model.openings.filter((o) => o.type !== "window").map((o) => {
          const w = model.walls.find((x) => x.id === o.wallId);
          if (!w) return null;
          const dx = w.end.x - w.start.x;
          const dy = w.end.y - w.start.y;
          const len = Math.hypot(dx, dy) || 1;
          const a = { x: w.start.x + (dx / len) * o.offsetFt, y: w.start.y + (dy / len) * o.offsetFt };
          const b = { x: w.start.x + (dx / len) * (o.offsetFt + o.widthFt), y: w.start.y + (dy / len) * (o.offsetFt + o.widthFt) };
          return <line key={o.id} x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} stroke="#f3f0ea" strokeWidth={2.4} />;
        })}
        {/* the person and where they look */}
        {walk.on ? (
          <g pointerEvents="none">
            <polygon points={cone} fill="#b5532a" fillOpacity={0.25} stroke="#b5532a" strokeWidth={0.8} />
            <circle cx={px(walk.x)} cy={py(walk.y)} r={4.5} fill="#b5532a" stroke="#fff" strokeWidth={1.5} />
          </g>
        ) : null}
        <text x={W_PX - 6} y={12} textAnchor="end" fontSize={9} fill="#6f6a62">
          N ↑
        </text>
      </svg>
      <div className="flex items-center justify-between px-1">
        <span className="text-[10.5px] text-muted">{walk.on ? "Drag the view to look · W A S D to walk" : "or drag the person"}</span>
        {walk.on ? (
          <button className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10" onClick={stopWalk} data-testid="walk-exit">
            <Icon name="back" size={12} /> Back to orbit
          </button>
        ) : (
          <button className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10" onClick={() => { const c = model.zones.find((z) => z.type === "aisle"); const r = c ? zoneRect(c) : null; startWalk(r ? r.x + r.w / 2 : (fp?.wFt ?? 24) / 2, r ? r.y + Math.min(4, r.d / 2) : 3); }} data-testid="walk-start">
            <Icon name="walk" size={12} /> Walk inside
          </button>
        )}
      </div>
    </div>
  );
}
