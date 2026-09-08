"use client";

import type { BuildingModel, Run } from "@/lib/model/schema";
import { FENCE_PRESETS, runArea, runEdges, runSqFtPerHead, runGuidanceFor } from "@/lib/model/runs";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import type { Handle } from "./ZoneLayer";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Outdoor runs on the plan: grass tiles, fence lines, gates, and resize handles on the selected run (ADR-0017). */
export function RunLayer({
  model,
  px,
  py,
  scale,
  selection,
  hovered,
  problems,
  showHandles,
  onPointerDown,
  onPointerDownHandle,
  onContextMenu,
  onHover,
}: {
  model: BuildingModel;
  px: (x: number) => number;
  py: (y: number) => number;
  scale: number;
  selection: string | null;
  hovered: string | null;
  problems: Set<string>;
  showHandles: boolean;
  onPointerDown: (r: Run, e: React.PointerEvent<SVGGElement>) => void;
  onPointerDownHandle: (r: Run, h: Handle, e: React.PointerEvent<SVGRectElement>) => void;
  onContextMenu: (r: Run, e: React.MouseEvent<SVGGElement>) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <g data-testid="run-layer">
      {model.runs.map((r) => {
        const sel = selection === r.id;
        const hov = hovered === r.id;
        const warn = problems.has(r.id);
        const x = px(r.rect.x);
        const y = py(r.rect.y + r.rect.d);
        const w = r.rect.w * scale;
        const h = r.rect.d * scale;
        const edges = runEdges(model, r);
        const stroke = sel ? "#b5532a" : warn ? "#c2410c" : hov ? "#4f7a3a" : "#3f6b2e";
        const g = runGuidanceFor(r.species);
        const perHead = Math.round(runSqFtPerHead(r));
        const short = perHead < g.minSqFtPerHead;
        const animal = r.species ? SPECIES_PRESETS[r.species].label.split(" /")[0] : null;
        return (
          <g key={r.id} className="cursor-move" onPointerDown={(e) => onPointerDown(r, e)} onContextMenu={(e) => onContextMenu(r, e)} onMouseEnter={() => onHover(r.id)} onMouseLeave={() => onHover(null)} data-testid="plan-run" data-run-id={r.id}>
            <rect x={x} y={y} width={w} height={h} fill={sel ? "#a9c98c" : hov ? "#b7d29c" : "#c3d9ab"} fillOpacity={0.85} stroke="none" />
            {/* fence lines: dashed on the free sides, none along the barn wall */}
            {edges.map((e) =>
              e.onBuilding ? null : (
                <line key={e.side} x1={px(e.x0)} y1={py(e.y0)} x2={px(e.x1)} y2={py(e.y1)} stroke={stroke} strokeWidth={sel ? 2.2 : 1.6} strokeDasharray={FENCE_PRESETS[r.fence.kind].material === "board" ? undefined : "6 3"} strokeLinecap="round" data-testid={`plan-fence-${e.side}`} />
              ),
            )}
            {/* fence posts as ticks */}
            {edges.flatMap((e) => {
              if (e.onBuilding) return [];
              const spacing = FENCE_PRESETS[r.fence.kind].postSpacingFt;
              const n = Math.max(1, Math.ceil(e.lengthFt / spacing));
              const horizontal = e.side === "n" || e.side === "s";
              const x0 = Math.min(e.x0, e.x1);
              const y0 = Math.min(e.y0, e.y1);
              return Array.from({ length: n + 1 }, (_, i) => {
                const u = (i * e.lengthFt) / n;
                const cx = horizontal ? px(x0 + u) : px(x0);
                const cy = horizontal ? py(y0) : py(y0 + u);
                return <circle key={`${e.side}${i}`} cx={cx} cy={cy} r={Math.max(1.2, Math.min(2.4, scale * 0.18))} fill={stroke} />;
              });
            })}
            {/* gates */}
            {r.gates.map((gt) => {
              const horizontal = gt.side === "n" || gt.side === "s";
              const gx0 = horizontal ? r.rect.x + gt.offsetFt : gt.side === "w" ? r.rect.x : r.rect.x + r.rect.w;
              const gy0 = horizontal ? (gt.side === "s" ? r.rect.y : r.rect.y + r.rect.d) : r.rect.y + gt.offsetFt;
              const gx1 = horizontal ? gx0 + gt.widthFt : gx0;
              const gy1 = horizontal ? gy0 : gy0 + gt.widthFt;
              // Swing arc into the run.
              const inward = gt.side === "s" ? 1 : gt.side === "n" ? -1 : gt.side === "w" ? 1 : -1;
              const len = gt.widthFt * scale;
              const ax = px(gx0);
              const ay = py(gy0);
              const ex = horizontal ? ax : ax + inward * len;
              const ey = horizontal ? ay - inward * len : ay;
              const sweep = horizontal ? (inward > 0 ? 1 : 0) : inward > 0 ? 0 : 1;
              return (
                <g key={gt.id} data-testid="plan-gate">
                  <line x1={px(gx0)} y1={py(gy0)} x2={px(gx1)} y2={py(gy1)} stroke="#f3f0ea" strokeWidth={sel ? 5 : 4} />
                  <line x1={ax} y1={ay} x2={ex} y2={ey} stroke={stroke} strokeWidth={1.4} />
                  <path d={`M ${ex} ${ey} A ${len} ${len} 0 0 ${sweep} ${px(gx1)} ${py(gy1)}`} fill="none" stroke={stroke} strokeWidth={0.8} strokeDasharray="2 2" />
                </g>
              );
            })}
            <text x={x + w / 2} y={y + h / 2 - 5} textAnchor="middle" fontSize={Math.max(9, Math.min(12, scale * 0.9))} fontWeight={600} fill="#2f4a22" pointerEvents="none">
              {r.name}
            </text>
            <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" fontSize={Math.max(8, Math.min(10.5, scale * 0.75))} fill={short ? "#b5532a" : "#3f6b2e"} pointerEvents="none">
              {r.rect.w}′ × {r.rect.d}′ · {runArea(r).toLocaleString()} sq ft{animal ? ` · ${perHead} per ${animal.toLowerCase()}` : ""}
            </text>
          </g>
        );
      })}
      {/* resize handles on the selected run */}
      {model.runs
        .filter((r) => showHandles && r.id === selection)
        .map((r) => {
          const rr = r.rect;
          const hx = (hh: Handle) => (hh.includes("w") ? px(rr.x) : hh.includes("e") ? px(rr.x + rr.w) : px(rr.x + rr.w / 2));
          const hy = (hh: Handle) => (hh.includes("n") ? py(rr.y + rr.d) : hh.includes("s") ? py(rr.y) : py(rr.y + rr.d / 2));
          const cursor: Record<Handle, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
          return (
            <g key={`rh_${r.id}`}>
              {HANDLES.map((hh) => (
                <rect key={hh} x={hx(hh) - 5} y={hy(hh) - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#b5532a" strokeWidth={1.5} style={{ cursor: cursor[hh] }} onPointerDown={(e) => onPointerDownHandle(r, hh, e)} data-testid={`run-handle-${hh}`} />
              ))}
            </g>
          );
        })}
    </g>
  );
}
