"use client";

import type { Zone } from "@/lib/model/schema";
import { zoneRect, ZONE_COLORS, ZONE_TYPE_LABEL, type Rect } from "@/lib/model/zones";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { formatFtIn } from "@/lib/units";
import type { Partition } from "@/lib/interior/partitions";

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function zoneFill(z: Zone) {
  return z.type === "pen" && z.species ? SPECIES_PRESETS[z.species].color : ZONE_COLORS[z.type];
}

/** Zones as tiles, partitions as lines, selection handles (RCT-style plan editing, SPEC §21). */
export function ZoneLayer({
  zones,
  partitions,
  px,
  py,
  scale,
  selection,
  hovered,
  problems,
  onPointerDownZone,
  onPointerDownHandle,
  onContextMenu,
  onHover,
  onDoubleClick,
}: {
  zones: Zone[];
  partitions: Partition[];
  px: (x: number) => number;
  py: (y: number) => number;
  scale: number;
  selection: string | null;
  hovered: string | null;
  problems: Set<string>;
  onPointerDownZone: (z: Zone, e: React.PointerEvent<SVGGElement>) => void;
  onPointerDownHandle: (z: Zone, h: Handle, e: React.PointerEvent<SVGRectElement>) => void;
  onContextMenu: (z: Zone, e: React.MouseEvent<SVGGElement>) => void;
  onHover: (id: string | null) => void;
  onDoubleClick: (z: Zone) => void;
}) {
  return (
    <g data-testid="zone-layer">
      {zones.map((z) => {
        const r = zoneRect(z);
        const sel = selection === z.id;
        const hov = hovered === z.id;
        const bad = problems.has(z.id);
        const x = px(r.x);
        const y = py(r.y + r.d);
        const w = r.w * scale;
        const h = r.d * scale;
        const label = z.name;
        const sub = `${formatFtIn(r.w)}×${formatFtIn(r.d)}${z.headCount ? ` · ${z.headCount} hd` : ""}`;
        const fontSize = Math.max(9, Math.min(13, scale * 0.9));
        return (
          <g
            key={z.id}
            className="cursor-move"
            onPointerDown={(e) => onPointerDownZone(z, e)}
            onContextMenu={(e) => onContextMenu(z, e)}
            onMouseEnter={() => onHover(z.id)}
            onMouseLeave={() => onHover(null)}
            onDoubleClick={() => onDoubleClick(z)}
            data-testid={`plan-zone-${z.type}`}
            data-zone-id={z.id}
          >
            <rect x={x} y={y} width={w} height={h} fill={zoneFill(z)} fillOpacity={z.type === "aisle" ? 0.55 : 0.75} stroke={bad ? "#c0392b" : sel ? "#b5532a" : hov ? "#d98a5f" : "#7a756c"} strokeWidth={bad || sel ? 2 : 1} strokeDasharray={z.type === "aisle" ? "5 3" : undefined} rx={1} />
            {w > 30 && h > 22 ? (
              <>
                <text x={x + w / 2} y={y + h / 2 - (h > 40 ? 5 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill="#1c1b19" style={{ pointerEvents: "none", fontWeight: 600 }}>
                  {label}
                </text>
                {h > 40 ? (
                  <text x={x + w / 2} y={y + h / 2 + fontSize} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize - 2} fill="#4a4741" fontFamily="ui-monospace, monospace" style={{ pointerEvents: "none" }}>
                    {sub}
                  </text>
                ) : null}
              </>
            ) : null}
            {z.outsideAccess ? <title>{`${label} · ${ZONE_TYPE_LABEL[z.type]} · outside access`}</title> : <title>{`${label} · ${ZONE_TYPE_LABEL[z.type]} · ${sub}`}</title>}
          </g>
        );
      })}

      {/* partitions + stall doors */}
      <g pointerEvents="none">
        {partitions.map((p) => {
          const x0 = px(p.x0);
          const y0 = py(p.y0);
          const x1 = px(p.x1);
          const y1 = py(p.y1);
          const vertical = Math.abs(p.x1 - p.x0) < 1e-9;
          const sw = p.kind === "full" ? Math.max(2, 0.375 * scale) : Math.max(1.5, 0.125 * scale);
          return (
            <g key={p.id}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#2b2925" strokeWidth={sw} />
              {p.doors.map((d, i) => {
                const a = d.u;
                const b = d.u + d.widthFt;
                const dx0 = vertical ? x0 : px(p.x0 + a);
                const dy0 = vertical ? py(p.y0 + a) : y0;
                const dx1 = vertical ? x0 : px(p.x0 + b);
                const dy1 = vertical ? py(p.y0 + b) : y0;
                // Gap in the wall + leaf drawn beside it (sliding).
                const off = 0.3 * scale;
                return (
                  <g key={i}>
                    <line x1={dx0} y1={dy0} x2={dx1} y2={dy1} stroke="#f6f5f2" strokeWidth={sw + 1} />
                    <line x1={vertical ? dx0 + off : dx0} y1={vertical ? dy0 : dy0 + off} x2={vertical ? dx1 + off : dx1} y2={vertical ? dy1 : dy1 + off} stroke="#b5532a" strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>

      {/* resize handles on the selected zone */}
      {zones
        .filter((z) => z.id === selection)
        .map((z) => {
          const r = zoneRect(z);
          const hx = (hh: Handle) => (hh.includes("w") ? px(r.x) : hh.includes("e") ? px(r.x + r.w) : px(r.x + r.w / 2));
          const hy = (hh: Handle) => (hh.includes("n") ? py(r.y + r.d) : hh.includes("s") ? py(r.y) : py(r.y + r.d / 2));
          const cursor: Record<Handle, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
          return (
            <g key={`h_${z.id}`}>
              {HANDLES.map((hh) => (
                <rect key={hh} x={hx(hh) - 5} y={hy(hh) - 5} width={10} height={10} rx={2} fill="#ffffff" stroke="#b5532a" strokeWidth={1.5} style={{ cursor: cursor[hh] }} onPointerDown={(e) => onPointerDownHandle(z, hh, e)} data-testid={`zone-handle-${hh}`} />
              ))}
            </g>
          );
        })}
    </g>
  );
}

/** Apply a handle drag to a rect. */
export function resizeByHandle(r: Rect, h: Handle, x: number, y: number): Rect {
  let { x: x0, y: y0 } = r;
  let x1 = r.x + r.w;
  let y1 = r.y + r.d;
  if (h.includes("w")) x0 = Math.min(x, x1 - 1);
  if (h.includes("e")) x1 = Math.max(x, x0 + 1);
  if (h.includes("s")) y0 = Math.min(y, y1 - 1);
  if (h.includes("n")) y1 = Math.max(y, y0 + 1);
  return { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
}
