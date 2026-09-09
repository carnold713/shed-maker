"use client";

import type { ElectricalFixture } from "@/lib/model/schema";
import type { ElectricalDerived } from "@/lib/electrical/derive";
import { FIXTURE_PRESETS } from "@/lib/model/electrical";

const CIRCUIT_COLOR: Record<string, string> = { lighting: "#c47a1c", receptacle: "#2d7dd2", fan: "#3f9142", waterer: "#1f9e9e", dedicated: "#b03a3a" };

/** Electrical symbols and circuit runs on the plan (ADR-0013). */
export function FixtureLayer({
  fixtures,
  derived,
  px,
  py,
  scale,
  selection,
  hovered,
  onPointerDown,
  onContextMenu,
  onHover,
  showRoutes,
}: {
  fixtures: ElectricalFixture[];
  derived: ElectricalDerived;
  px: (x: number) => number;
  py: (y: number) => number;
  scale: number;
  selection: string | null;
  hovered: string | null;
  onPointerDown: (f: ElectricalFixture, e: React.PointerEvent<SVGGElement>) => void;
  onContextMenu: (f: ElectricalFixture, e: React.MouseEvent<SVGGElement>) => void;
  onHover: (f: ElectricalFixture | null) => void;
  showRoutes: boolean;
}) {
  const r = Math.max(5, Math.min(9, scale * 0.6));
  return (
    <g data-testid="fixture-layer">
      {showRoutes
        ? derived.routes.map((route, i) => {
            const c = derived.circuits.find((x) => x.id === route.circuitId);
            const pts = route.points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
            if (route.kind === "switchLeg") {
              // Switched run: from the switch out to only the lights it controls.
              return <polyline key={`${route.circuitId}_${route.switchId}_${i}`} points={pts} fill="none" stroke="#7a5aa6" strokeWidth={1.1} strokeDasharray="2 3" opacity={0.85} pointerEvents="none" data-testid="plan-switch-leg" />;
            }
            const color = CIRCUIT_COLOR[c?.kind ?? "lighting"];
            return <polyline key={`${route.circuitId}_feed`} points={pts} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray="5 3" opacity={0.75} pointerEvents="none" data-testid="plan-circuit-feed" />;
          })
        : null}
      {fixtures.map((f) => {
        const cx = px(f.x);
        const cy = py(f.y);
        const rot = f.kind === "light" ? f.rotationDeg : f.facing === "y" || (f.wallId === "wall_ext_e" || f.wallId === "wall_ext_w") ? 90 : 0;
        const sel = selection === f.id;
        const hov = hovered === f.id;
        const stroke = sel ? "#b5532a" : hov ? "#d98a5f" : "#1c1b19";
        const circuit = derived.circuits.find((c) => c.fixtureIds.includes(f.id));
        return (
          <g key={f.id} className="cursor-pointer" onPointerDown={(e) => onPointerDown(f, e)} onContextMenu={(e) => onContextMenu(f, e)} onMouseEnter={() => onHover(f)} onMouseLeave={() => onHover(null)} data-testid={`plan-fixture-${f.kind}`}>
            <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
            <g transform={rot ? `rotate(${-rot} ${cx} ${cy})` : undefined}>
              <Symbol kind={f.kind} cx={cx} cy={cy} r={r} stroke={stroke} scale={scale} />
            </g>
            {sel ? <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#b5532a" strokeWidth={1.5} strokeDasharray="3 2" /> : null}
            <title>{`${f.label ?? FIXTURE_PRESETS[f.kind].label} · ${f.mountFt}' up${circuit ? ` · circuit ${circuit.label}` : ""}`}</title>
          </g>
        );
      })}
    </g>
  );
}

function Symbol({ kind, cx, cy, r, stroke, scale }: { kind: ElectricalFixture["kind"]; cx: number; cy: number; r: number; stroke: string; scale: number }) {
  const fill = "#fffdf8";
  switch (kind) {
    case "light": {
      // 4' strip: a rounded bar with a circle-cross at the centre.
      const half = Math.max(r, 2 * scale);
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={fill}>
          <rect x={cx - half} y={cy - r * 0.45} width={half * 2} height={r * 0.9} rx={r * 0.45} />
          <line x1={cx - r * 0.5} y1={cy - r * 0.5} x2={cx + r * 0.5} y2={cy + r * 0.5} />
          <line x1={cx - r * 0.5} y1={cy + r * 0.5} x2={cx + r * 0.5} y2={cy - r * 0.5} />
        </g>
      );
    }
    case "gooseneck":
    case "lantern":
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={fill}>
          <circle cx={cx} cy={cy} r={r * 0.75} />
          <line x1={cx} y1={cy - r * 0.75} x2={cx} y2={cy - r * 1.5} />
          <path d={`M ${cx - r * 0.7} ${cy - r * 1.5} h ${r * 1.4}`} />
          {kind === "lantern" ? <rect x={cx - r * 0.3} y={cy - r * 0.3} width={r * 0.6} height={r * 0.6} fill={stroke} stroke="none" opacity={0.6} /> : null}
        </g>
      );
    case "floodlight":
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={fill}>
          <circle cx={cx} cy={cy} r={r * 0.8} />
          <path d={`M ${cx - r} ${cy - r} l ${r * 0.4} ${r * 0.4} M ${cx + r} ${cy - r} l ${-r * 0.4} ${r * 0.4} M ${cx} ${cy - r * 1.3} v ${r * 0.5}`} />
        </g>
      );
    case "outlet":
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={fill}>
          <rect x={cx - r * 0.5} y={cy - r * 0.25} width={r} height={r * 0.5} fill={stroke} stroke="none" opacity={0.35} />
          <circle cx={cx} cy={cy} r={r * 0.8} />
          <line x1={cx - r * 1.2} y1={cy} x2={cx + r * 1.2} y2={cy} />
          <line x1={cx - r * 0.3} y1={cy - r * 0.35} x2={cx - r * 0.3} y2={cy + r * 0.35} />
          <line x1={cx + r * 0.3} y1={cy - r * 0.35} x2={cx + r * 0.3} y2={cy + r * 0.35} />
        </g>
      );
    case "switch":
      return (
        <g>
          <rect x={cx - r * 0.55} y={cy - r * 0.2} width={r * 1.1} height={r * 0.4} fill={stroke} stroke="none" opacity={0.35} />
          <circle cx={cx} cy={cy} r={r * 0.8} fill={fill} stroke={stroke} strokeWidth={1.5} />
          <text x={cx} y={cy + r * 0.4} textAnchor="middle" fontSize={r * 1.2} fontWeight={600} fill={stroke} fontFamily="ui-sans-serif, system-ui">
            S
          </text>
        </g>
      );
    case "panel":
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={stroke}>
          <rect x={cx - r * 0.7} y={cy - r * 1.1} width={r * 1.4} height={r * 2.2} rx={1.5} />
          <text x={cx} y={cy + r * 0.4} textAnchor="middle" fontSize={r * 1.1} fontWeight={700} fill="#fff" stroke="none" fontFamily="ui-sans-serif, system-ui">
            P
          </text>
        </g>
      );
    case "fan":
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={fill}>
          <circle cx={cx} cy={cy} r={r} />
          <path d={`M ${cx} ${cy} q ${r * 0.9} ${-r * 0.9} ${r * 0.2} ${-r * 0.9} M ${cx} ${cy} q ${-r * 0.9} ${r * 0.9} ${-r * 0.2} ${r * 0.9} M ${cx} ${cy} q ${r * 0.9} ${r * 0.9} ${r * 0.9} ${r * 0.2} M ${cx} ${cy} q ${-r * 0.9} ${-r * 0.9} ${-r * 0.9} ${-r * 0.2}`} fill="none" />
        </g>
      );
    case "waterer":
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={fill}>
          <rect x={cx - r * 0.9} y={cy - r * 0.9} width={r * 1.8} height={r * 1.8} rx={2} />
          <text x={cx} y={cy + r * 0.4} textAnchor="middle" fontSize={r * 1.1} fontWeight={600} fill={stroke} stroke="none" fontFamily="ui-sans-serif, system-ui">
            W
          </text>
        </g>
      );
    case "heater":
      return (
        <g stroke={stroke} strokeWidth={1.5} fill={fill}>
          <rect x={cx - r} y={cy - r * 0.7} width={r * 2} height={r * 1.4} rx={2} />
          <text x={cx} y={cy + r * 0.4} textAnchor="middle" fontSize={r * 1.1} fontWeight={600} fill={stroke} stroke="none" fontFamily="ui-sans-serif, system-ui">
            H
          </text>
        </g>
      );
  }
}
