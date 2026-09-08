"use client";

import type { Zone } from "@/lib/model/schema";
import { zoneRect, ZONE_COLORS, ZONE_TYPE_LABEL, type Rect } from "@/lib/model/zones";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { formatFtIn } from "@/lib/units";
import type { Partition, PartitionDoor } from "@/lib/interior/partitions";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";

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
  onPointerDownDoor,
  onContextMenuDoor,
  onHoverDoor,
  showHandles = true,
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
  /** Hidden while a placement tool is armed so a handle never steals the click meant for a door or fixture. */
  showHandles?: boolean;
  onContextMenu: (z: Zone, e: React.MouseEvent<SVGGElement>) => void;
  onHover: (id: string | null) => void;
  onDoubleClick: (z: Zone) => void;
  onPointerDownDoor?: (p: Partition, d: PartitionDoor, e: React.PointerEvent<SVGGElement>) => void;
  onContextMenuDoor?: (p: Partition, d: PartitionDoor, e: React.MouseEvent<SVGGElement>) => void;
  onHoverDoor?: (p: Partition, d: PartitionDoor | null) => void;
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

      {/* partitions */}
      <g pointerEvents="none">
        {partitions.map((p) => {
          const sw = p.kind === "full" ? Math.max(2, 0.375 * scale) : Math.max(1.5, 0.125 * scale);
          return (
            <g key={p.id}>
              <line x1={px(p.x0)} y1={py(p.y0)} x2={px(p.x1)} y2={py(p.y1)} stroke="#2b2925" strokeWidth={sw} />
              {p.doors.map((d) => (
                <line key={d.id} x1={px(d.x0)} y1={py(d.y0)} x2={px(d.x1)} y2={py(d.y1)} stroke="#f6f5f2" strokeWidth={sw + 1} />
              ))}
            </g>
          );
        })}
      </g>

      {/* doors in partitions: symbol by type, clickable */}
      <g data-testid="door-layer">
        {partitions.flatMap((p) =>
          p.doors.map((d) => {
            const id = d.auto ? d.zoneId : d.id;
            const sel = selection === d.id;
            const hov = hovered === d.id;
            return (
              <g
                key={d.id}
                className="cursor-pointer"
                onPointerDown={(e) => onPointerDownDoor?.(p, d, e)}
                onContextMenu={(e) => onContextMenuDoor?.(p, d, e)}
                onMouseEnter={() => onHoverDoor?.(p, d)}
                onMouseLeave={() => onHoverDoor?.(p, null)}
                data-testid={`plan-door-${d.type}`}
                data-door-id={id}
              >
                <DoorSymbol p={p} d={d} px={px} py={py} scale={scale} color={sel ? "#b5532a" : hov ? "#d98a5f" : "#8a3f1e"} />
                <title>{`${INTERIOR_DOOR_PRESETS[d.type].label} ${formatFtIn(d.widthFt)} × ${formatFtIn(d.heightFt)}${d.auto ? " (default)" : ""}`}</title>
              </g>
            );
          }),
        )}
      </g>

      {/* resize handles on the selected zone */}
      {zones
        .filter((z) => showHandles && z.id === selection)
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

/** Architectural door symbol in a partition: leaf line + swing arc for hinged, offset leaf for sliders, gap only for cased openings. */
function DoorSymbol({ p, d, px, py, scale, color }: { p: Partition; d: PartitionDoor; px: (x: number) => number; py: (y: number) => number; scale: number; color: string }) {
  const vertical = Math.abs(p.x1 - p.x0) < 1e-9;
  const preset = INTERIOR_DOOR_PRESETS[d.type];
  // Local frame along the door: A = start jamb, B = end jamb; n = unit normal toward the served zone's opposite side (the aisle).
  const A = { x: d.x0, y: d.y0 };
  const B = { x: d.x1, y: d.y1 };
  const aisleSign = -d.zoneSide; // +1 = higher coordinate side
  const n = vertical ? { x: aisleSign, y: 0 } : { x: 0, y: aisleSign };
  const P = (pt: { x: number; y: number }) => ({ x: px(pt.x), y: py(pt.y) });
  const w = d.widthFt;
  // Wide invisible hit band across the opening.
  const band = 0.9;
  const hit = [
    { x: A.x - n.x * band, y: A.y - n.y * band },
    { x: B.x - n.x * band, y: B.y - n.y * band },
    { x: B.x + n.x * band, y: B.y + n.y * band },
    { x: A.x + n.x * band, y: A.y + n.y * band },
  ]
    .map((q) => `${px(q.x)},${py(q.y)}`)
    .join(" ");
  if (preset.leaf === "none") {
    return (
      <g>
        <polygon points={hit} fill="transparent" />
        <line x1={P(A).x} y1={P(A).y} x2={P(B).x} y2={P(B).y} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
      </g>
    );
  }
  if (!preset.hinged) {
    // Sliding: leaf offset to the aisle side, extended past the jamb in the slide direction.
    const off = 0.32;
    const dir = d.swing === "slideLeft" ? -1 : 1;
    const along = vertical ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const ext = Math.min(w, 1.5);
    const L0 = dir > 0 ? A : { x: A.x - along.x * ext, y: A.y - along.y * ext };
    const L1 = dir > 0 ? { x: B.x + along.x * ext, y: B.y + along.y * ext } : B;
    const l0 = P({ x: L0.x + n.x * off, y: L0.y + n.y * off });
    const l1 = P({ x: L1.x + n.x * off, y: L1.y + n.y * off });
    const mid = P({ x: (A.x + B.x) / 2 + n.x * off * 1.9, y: (A.y + B.y) / 2 + n.y * off * 1.9 });
    const ah = Math.min(w * 0.35, 1.5) * scale;
    const ax = vertical ? 0 : dir * ah;
    const ay = vertical ? -dir * ah : 0;
    return (
      <g>
        <polygon points={hit} fill="transparent" />
        <line x1={l0.x} y1={l0.y} x2={l1.x} y2={l1.y} stroke={color} strokeWidth={2.2} />
        <path d={`M ${mid.x - ax} ${mid.y - ay} L ${mid.x + ax} ${mid.y + ay}`} stroke={color} strokeWidth={1} fill="none" />
        <path d={`M ${mid.x + ax} ${mid.y + ay} l ${vertical ? -3 : -Math.sign(dir) * 4} ${vertical ? Math.sign(dir) * 4 : -3} M ${mid.x + ax} ${mid.y + ay} l ${vertical ? 3 : -Math.sign(dir) * 4} ${vertical ? Math.sign(dir) * 4 : 3}`} stroke={color} strokeWidth={1} fill="none" />
      </g>
    );
  }
  // Hinged (stall, Dutch, wood, steel): leaf perpendicular from the hinge jamb + quarter arc.
  const side = d.swing === "in" ? -aisleSign : aisleSign; // swing side relative to +n... "out" = into the aisle
  const hingeAtA = d.hinge === "left";
  const H = hingeAtA ? A : B;
  const E = hingeAtA ? B : A;
  const tip = { x: H.x + n.x * side * w, y: H.y + n.y * side * w };
  const h = P(H);
  const t = P(tip);
  const e = P(E);
  const r = w * scale;
  // Sweep flag: choose the arc that stays on the swing side (try both and pick the shorter one by midpoint distance).
  const sweep = ((side > 0 ? 1 : 0) ^ (hingeAtA ? 0 : 1) ^ (vertical ? 1 : 0)) as 0 | 1;
  return (
    <g>
      <polygon points={hit} fill="transparent" />
      <line x1={h.x} y1={h.y} x2={t.x} y2={t.y} stroke={color} strokeWidth={2} />
      <path d={`M ${t.x} ${t.y} A ${r} ${r} 0 0 ${sweep} ${e.x} ${e.y}`} stroke={color} strokeWidth={0.9} strokeDasharray="3 2" fill="none" />
      {d.type === "dutch" ? <line x1={h.x} y1={h.y} x2={(h.x + t.x) / 2} y2={(h.y + t.y) / 2} stroke="#fff" strokeWidth={0.8} strokeDasharray="2 2" /> : null}
    </g>
  );
}
