"use client";

import type { Drain } from "@/lib/model/schema";
import type { DrainageDerived } from "@/lib/plumbing/drainage";

const PIPE = "#3d7ea6";

/** Drains, slope arrows, under-slab pipe runs and the outlet on the plan (ADR-0016). */
export function DrainLayer({
  derived,
  px,
  py,
  scale,
  selection,
  hovered,
  emphasis,
  onPointerDown,
  onContextMenu,
  onHover,
  onPointerDownOutlet,
  onContextMenuOutlet,
}: {
  derived: DrainageDerived;
  px: (x: number) => number;
  py: (y: number) => number;
  scale: number;
  selection: string | null;
  hovered: string | null;
  /** Full drawing (slope arrows, cleanouts) vs. just the drains. */
  emphasis: boolean;
  onPointerDown: (d: Drain, e: React.PointerEvent<SVGGElement>) => void;
  onContextMenu: (d: Drain, e: React.MouseEvent<SVGGElement>) => void;
  onHover: (d: Drain | null) => void;
  onPointerDownOutlet: (e: React.PointerEvent<SVGGElement>) => void;
  onContextMenuOutlet: (e: React.MouseEvent<SVGGElement>) => void;
}) {
  const r = Math.max(5, Math.min(9, scale * 0.45));
  return (
    <g data-testid="drain-layer">
      {/* slope arrows: from the catchment edges toward the drain */}
      {emphasis
        ? derived.drains.map((dd) => {
            const c = dd.catchment;
            const d = dd.drain;
            const arrows: React.ReactNode[] = [];
            const targets: { x: number; y: number }[] = [
              { x: c.x + c.w * 0.2, y: c.y + c.d * 0.2 },
              { x: c.x + c.w * 0.8, y: c.y + c.d * 0.2 },
              { x: c.x + c.w * 0.2, y: c.y + c.d * 0.8 },
              { x: c.x + c.w * 0.8, y: c.y + c.d * 0.8 },
            ];
            for (const [i, t] of targets.entries()) {
              const tx = d.kind === "trench" && d.axis === "x" ? Math.max(d.x - d.lengthFt / 2, Math.min(d.x + d.lengthFt / 2, t.x)) : d.kind === "trench" ? d.x : d.x;
              const ty = d.kind === "trench" && d.axis === "y" ? Math.max(d.y - d.lengthFt / 2, Math.min(d.y + d.lengthFt / 2, t.y)) : d.y;
              const dx = tx - t.x;
              const dy = ty - t.y;
              const L = Math.hypot(dx, dy);
              if (L < 1.5) continue;
              const ux = dx / L;
              const uy = dy / L;
              const a = { x: px(t.x), y: py(t.y) };
              const b = { x: px(t.x + ux * Math.min(L - 1, 3)), y: py(t.y + uy * Math.min(L - 1, 3)) };
              arrows.push(
                <g key={i} stroke={PIPE} strokeWidth={1} opacity={0.55} fill="none" pointerEvents="none">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <polyline points={`${b.x - (ux * 5 - uy * 3)},${b.y + (uy * 5 + ux * 3)} ${b.x},${b.y} ${b.x - (ux * 5 + uy * 3)},${b.y + (uy * 5 - ux * 3)}`} />
                </g>,
              );
            }
            return <g key={`sl${d.id}`}>{arrows}</g>;
          })
        : null}
      {/* pipe runs */}
      {derived.segments.map((s, i) => (
        <line key={i} x1={px(s.a.x)} y1={py(s.a.y)} x2={px(s.b.x)} y2={py(s.b.y)} stroke={PIPE} strokeWidth={emphasis ? 2 : 1.2} strokeDasharray="8 3 2 3" opacity={emphasis ? 0.9 : 0.5} pointerEvents="none" />
      ))}
      {emphasis
        ? derived.cleanouts.map((c, i) => (
            <g key={`co${i}`} pointerEvents="none">
              <circle cx={px(c.x)} cy={py(c.y)} r={r * 0.55} fill="#fff" stroke={PIPE} strokeWidth={1.2} />
              <text x={px(c.x)} y={py(c.y) + r * 0.35} textAnchor="middle" fontSize={r * 0.9} fill={PIPE} fontFamily="ui-sans-serif, system-ui">
                CO
              </text>
            </g>
          ))
        : null}
      {/* drains */}
      {derived.drains.map(({ drain: d }) => {
        const sel = selection === d.id;
        const hov = hovered === d.id;
        const stroke = sel ? "#b5532a" : hov ? "#d98a5f" : "#1c1b19";
        const cx = px(d.x);
        const cy = py(d.y);
        return (
          <g key={d.id} className="cursor-pointer" onPointerDown={(e) => onPointerDown(d, e)} onContextMenu={(e) => onContextMenu(d, e)} onMouseEnter={() => onHover(d)} onMouseLeave={() => onHover(null)} data-testid={`plan-drain-${d.kind}`}>
            {d.kind === "trench" ? (
              (() => {
                const w = d.axis === "x" ? d.lengthFt * scale : Math.max(6, 0.6 * scale);
                const h = d.axis === "y" ? d.lengthFt * scale : Math.max(6, 0.6 * scale);
                return (
                  <>
                    <rect x={cx - w / 2 - 6} y={cy - h / 2 - 6} width={w + 12} height={h + 12} fill="transparent" />
                    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="#dfe8ee" stroke={stroke} strokeWidth={sel ? 2 : 1.2} />
                    {Array.from({ length: Math.max(1, Math.floor((d.axis === "x" ? w : h) / 6)) }, (_, i) =>
                      d.axis === "x" ? <line key={i} x1={cx - w / 2 + 3 + i * 6} y1={cy - h / 2} x2={cx - w / 2 + 3 + i * 6} y2={cy + h / 2} stroke={stroke} strokeWidth={0.6} /> : <line key={i} x1={cx - w / 2} y1={cy - h / 2 + 3 + i * 6} x2={cx + w / 2} y2={cy - h / 2 + 3 + i * 6} stroke={stroke} strokeWidth={0.6} />,
                    )}
                  </>
                );
              })()
            ) : (
              <>
                <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
                <circle cx={cx} cy={cy} r={r} fill="#dfe8ee" stroke={stroke} strokeWidth={sel ? 2 : 1.2} />
                <line x1={cx - r * 0.7} y1={cy} x2={cx + r * 0.7} y2={cy} stroke={stroke} strokeWidth={0.8} />
                <line x1={cx} y1={cy - r * 0.7} x2={cx} y2={cy + r * 0.7} stroke={stroke} strokeWidth={0.8} />
                <circle cx={cx} cy={cy} r={r * 0.45} fill="none" stroke={stroke} strokeWidth={0.8} />
              </>
            )}
            <title>{`${d.label ?? (d.kind === "trench" ? "Trench drain" : "Floor drain")}`}</title>
          </g>
        );
      })}
      {/* outlet */}
      {derived.outlet
        ? (() => {
            const o = derived.outlet;
            const sel = selection === "drain_outlet";
            const stroke = sel ? "#b5532a" : hovered === "drain_outlet" ? "#d98a5f" : PIPE;
            const dirX = o.wallId === "wall_ext_e" ? 1 : o.wallId === "wall_ext_w" ? -1 : 0;
            const dirY = o.wallId === "wall_ext_n" ? 1 : o.wallId === "wall_ext_s" ? -1 : 0;
            const ax = px(o.x);
            const ay = py(o.y);
            const bx = px(o.x + dirX * 2.5);
            const by = py(o.y + dirY * 2.5);
            return (
              <g className="cursor-pointer" onPointerDown={onPointerDownOutlet} onContextMenu={onContextMenuOutlet} data-testid="plan-drain-outlet">
                <circle cx={ax} cy={ay} r={r + 8} fill="transparent" />
                <line x1={ax} y1={ay} x2={bx} y2={by} stroke={stroke} strokeWidth={2.5} />
                <polygon points={`${bx + dirX * 6 - dirY * 5},${by - dirY * 6 - dirX * 5} ${bx + dirX * 6 + dirY * 5},${by - dirY * 6 + dirX * 5} ${bx + dirX * 12},${by - dirY * 12}`} fill={stroke} />
                <text x={bx + dirX * 16} y={by - dirY * 16 + 4} textAnchor={dirX > 0 ? "start" : dirX < 0 ? "end" : "middle"} fontSize={10} fill={stroke} fontFamily="ui-sans-serif, system-ui">
                  {o.kind === "daylight" ? `to daylight ${o.daylightOk ? "" : "⚠"}` : o.kind === "dryWell" ? "to dry well" : o.kind === "septic" ? "to septic" : "to storm"}
                </text>
                <title>{`Outlet · ${o.invertIn}" below the floor`}</title>
              </g>
            );
          })()
        : null}
    </g>
  );
}
