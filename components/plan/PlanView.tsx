"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { formatFtIn } from "@/lib/units";

/**
 * Top-down plan in SVG. Plan +y is north and renders UP the screen.
 * Drag the east or north edge handle to resize the footprint (snaps to 1').
 */
export function PlanView() {
  const model = useProjectStore((s) => s.model);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const setFootprintRect = useProjectStore((s) => s.setFootprintRect);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fp = model?.footprint;
  const W = fp?.kind === "rect" ? fp.wFt : 0;
  const D = fp?.kind === "rect" ? fp.dFt : 0;

  // Fit the footprint with margin for dimension strings.
  const margin = 48;
  const scale = useMemo(() => {
    if (!W || !D) return 10;
    return Math.max(0.5, Math.min((size.w - 2 * margin) / W, (size.h - 2 * margin) / D));
  }, [W, D, size]);
  const ox = (size.w - W * scale) / 2;
  const oy = (size.h + D * scale) / 2; // plan y=0 at the bottom
  const px = (x: number) => ox + x * scale;
  const py = (y: number) => oy - y * scale;

  const [drag, setDrag] = useState<null | { edge: "e" | "n" }>(null);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drag || !model) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left - ox) / scale;
      const y = (oy - (e.clientY - rect.top)) / scale;
      const snap = (v: number) => Math.round(v);
      if (drag.edge === "e") setFootprintRect(snap(x), D);
      else setFootprintRect(W, snap(y));
    },
    [drag, model, ox, oy, scale, D, W, setFootprintRect],
  );

  if (!model || fp?.kind !== "rect") {
    return <div className="flex h-full items-center justify-center text-sm text-muted">No footprint</div>;
  }

  const wallT = (model.walls[0]?.thicknessIn ?? 5.5) / 12;
  const gridStep = scale >= 12 ? 1 : scale >= 4 ? 2 : 4;
  const gridLines: number[] = [];
  for (let g = 0; g <= Math.max(W, D); g += gridStep) gridLines.push(g);

  return (
    <div ref={wrapRef} className="relative h-full w-full select-none overflow-hidden">
      <svg
        width={size.w}
        height={size.h}
        className="block"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) select(null);
        }}
        data-testid="plan-svg"
      >
        {/* grid */}
        <g stroke="#e8e6e1" strokeWidth={1}>
          {gridLines.map((g) => (
            <g key={g}>
              {g <= W ? <line x1={px(g)} y1={py(0)} x2={px(g)} y2={py(D)} /> : null}
              {g <= D ? <line x1={px(0)} y1={py(g)} x2={px(W)} y2={py(g)} /> : null}
            </g>
          ))}
        </g>

        {/* slab */}
        {model.foundation.slab.enabled ? (
          <rect x={px(0)} y={py(D)} width={W * scale} height={D * scale} fill="#d9d6cf" opacity={0.5} />
        ) : null}

        {/* exterior walls (double line) */}
        <g
          onClick={() => select("footprint")}
          className="cursor-pointer"
          stroke={selection === "footprint" ? "#b5532a" : "#1c1b19"}
          strokeWidth={Math.max(1.5, wallT * scale)}
          fill="none"
        >
          <rect x={px(0)} y={py(D)} width={W * scale} height={D * scale} />
        </g>

        {/* ridge line */}
        {model.roof.form === "gable" ? (
          model.roof.ridgeAxis === "ns" ? (
            <line x1={px(W / 2)} y1={py(0)} x2={px(W / 2)} y2={py(D)} stroke="#9a9790" strokeDasharray="6 4" />
          ) : (
            <line x1={px(0)} y1={py(D / 2)} x2={px(W)} y2={py(D / 2)} stroke="#9a9790" strokeDasharray="6 4" />
          )
        ) : null}

        {/* dimensions */}
        <Dimension x1={px(0)} y1={py(0) + 22} x2={px(W)} y2={py(0) + 22} label={formatFtIn(W)} />
        <Dimension x1={px(W) + 22} y1={py(0)} x2={px(W) + 22} y2={py(D)} label={formatFtIn(D)} vertical />

        {/* drag handles */}
        <g>
          <rect
            x={px(W) - 5}
            y={py(D / 2) - 14}
            width={10}
            height={28}
            rx={3}
            fill="#b5532a"
            className="cursor-ew-resize"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ edge: "e" });
              select("footprint");
            }}
            data-testid="handle-e"
          />
          <rect
            x={px(W / 2) - 14}
            y={py(D) - 5}
            width={28}
            height={10}
            rx={3}
            fill="#b5532a"
            className="cursor-ns-resize"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ edge: "n" });
              select("footprint");
            }}
            data-testid="handle-n"
          />
        </g>

        {/* north arrow */}
        <g transform={`translate(${size.w - 28}, 36) rotate(${-model.site.orientationDeg})`} fill="#1c1b19">
          <polygon points="0,-14 6,6 0,2 -6,6" />
          <text y={20} textAnchor="middle" fontSize={10}>
            N
          </text>
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-muted">
        {formatFtIn(W)} × {formatFtIn(D)} · {W * D} sq ft · 1 grid = {gridStep}&apos;
      </div>
    </div>
  );
}

function Dimension({ x1, y1, x2, y2, label, vertical = false }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tick = 5;
  return (
    <g stroke="#6b6963" strokeWidth={1} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} />
        </>
      )}
      <text
        x={mx}
        y={my}
        fill="#1c1b19"
        stroke="none"
        fontSize={11}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}
        style={{ paintOrder: "stroke" }}
      >
        <tspan stroke="#ffffff" strokeWidth={4}>{label}</tspan>
      </text>
    </g>
  );
}
