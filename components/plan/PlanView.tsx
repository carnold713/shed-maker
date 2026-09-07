"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { useDerived } from "@/lib/store/useDerived";
import { wallFrame } from "@/lib/framing/wallFrame";
import { formatFtIn } from "@/lib/units";
import type { Opening, Species, Wall, ZoneType } from "@/lib/model/schema";
import { defaultPenSize, ROOM_PRESETS, snapCoordinate, zoneRect, type Rect } from "@/lib/model/zones";
import { derivePartitions } from "@/lib/interior/partitions";
import { ZoneLayer, resizeByHandle, zoneFill, type Handle } from "./ZoneLayer";
import { ToolPalette } from "./ToolPalette";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { DOOR_PALETTE, WINDOW_PALETTE, needsApron } from "@/lib/model/openings";
import { leanToPolygon } from "@/lib/model/leanTos";

/**
 * Top-down plan in SVG (SPEC §3.4, §21). Plan +y is north and renders UP the
 * screen. Drag the east/north handles to resize the footprint; drag openings
 * along their wall; right-click walls and openings for context menus.
 */
export function PlanView() {
  const model = useProjectStore((s) => s.model);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const setFootprintRect = useProjectStore((s) => s.setFootprintRect);
  const moveOpening = useProjectStore((s) => s.moveOpening);
  const openContextMenu = useViewStore((s) => s.openContextMenu);
  const hovered = useViewStore((s) => s.hovered);
  const setHovered = useViewStore((s) => s.setHovered);
  const tool = useViewStore((s) => s.tool);
  const toolSpecies = useViewStore((s) => s.toolSpecies) as Species;
  const toolRoomType = useViewStore((s) => s.toolRoomType) as ZoneType;
  const autoGrow = useViewStore((s) => s.autoGrow);
  const addZone = useProjectStore((s) => s.addZone);
  const addOpening = useProjectStore((s) => s.addOpening);
  const removeOpening = useProjectStore((s) => s.removeOpening);
  const addLeanTo = useProjectStore((s) => s.addLeanTo);
  const removeLeanTo = useProjectStore((s) => s.removeLeanTo);
  const doorKey = useViewStore((s) => s.toolDoorKey);
  const windowKey = useViewStore((s) => s.toolWindowKey);
  const [wallGhost, setWallGhost] = useState<{ wallId: string; u: number; w: number } | null>(null);
  const moveZoneAction = useProjectStore((s) => s.moveZone);
  const resizeZoneAction = useProjectStore((s) => s.resizeZone);
  const removeZone = useProjectStore((s) => s.removeZone);
  const { framing, report } = useDerived();
  const partitions = useMemo(() => (model ? derivePartitions(model) : []), [model]);
  const problems = useMemo(() => new Set((report?.findings ?? []).filter((f) => f.severity === "error").flatMap((f) => f.entityIds)), [report]);
  const [ghost, setGhost] = useState<Rect | null>(null);
  const [cursorFt, setCursorFt] = useState<{ x: number; y: number } | null>(null);
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

  const margin = 56;
  const scale = useMemo(() => {
    if (!W || !D) return 10;
    return Math.max(0.5, Math.min((size.w - 2 * margin) / W, (size.h - 2 * margin) / D));
  }, [W, D, size]);
  const ox = (size.w - W * scale) / 2;
  const oy = (size.h + D * scale) / 2;
  const px = useCallback((x: number) => ox + x * scale, [ox, scale]);
  const py = useCallback((y: number) => oy - y * scale, [oy, scale]);
  const toPlan = useCallback(
    (e: React.PointerEvent | React.MouseEvent, svg: SVGSVGElement) => {
      const rect = svg.getBoundingClientRect();
      return { x: (e.clientX - rect.left - ox) / scale, y: (oy - (e.clientY - rect.top)) / scale };
    },
    [ox, oy, scale],
  );

  type Drag =
    | { kind: "edge"; edge: "e" | "n" }
    | { kind: "opening"; id: string; wallId: string; grabOffsetFt: number }
    | { kind: "zoneMove"; id: string; grabX: number; grabY: number; w: number; d: number; moved: boolean }
    | { kind: "zoneResize"; id: string; handle: Handle; start: Rect }
    | { kind: "draw"; x0: number; y0: number; moved: boolean };
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const endDrag = useRef<(() => void) | null>(null);

  const beginDrag = (d: Drag) => {
    dragRef.current = d;
    setDrag(d);
    // Coalesce the whole drag into one undo step.
    const start = useProjectStore.getState().model;
    useProjectStore.temporal.getState().pause();
    endDrag.current = () => {
      const st = useProjectStore.getState();
      const end = st.model;
      const temporal = useProjectStore.temporal.getState();
      if (start && end && end !== start) {
        useProjectStore.setState({ model: start });
        temporal.resume();
        useProjectStore.setState({ model: end });
      } else temporal.resume();
      endDrag.current = null;
    };
  };
  const finishDrag = () => {
    const d = dragRef.current;
    if (d?.kind === "draw") {
      commitDraw();
      setGhost(null);
    }
    endDrag.current?.();
    dragRef.current = null;
    setDrag(null);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!model) return;
      const p = toPlan(e, e.currentTarget);
      setCursorFt(p);
      const d = dragRef.current;
      if (!d) {
        if (tool === "door" || tool === "window") {
          const hit = nearestWall(model, p.x, p.y);
          const entry = tool === "door" ? DOOR_PALETTE.find((e) => e.key === doorKey) : WINDOW_PALETTE.find((e) => e.key === windowKey);
          setWallGhost(hit && entry && hit.dist < 3 ? { wallId: hit.wall.id, u: hit.u, w: entry.widthFt } : null);
          return;
        }
        // Hover ghost for stamp tools.
        if (tool === "pen" || tool === "room" || tool === "aisle") {
          const [w, dd] = toolSize();
          setGhost({ x: snapCoordinate(model, "x", p.x - w / 2), y: snapCoordinate(model, "y", p.y - dd / 2), w, d: dd });
        }
        return;
      }
      if (d.kind === "draw") {
        const x0 = Math.min(d.x0, p.x);
        const y0 = Math.min(d.y0, p.y);
        const r: Rect = { x: x0, y: y0, w: Math.abs(p.x - d.x0), d: Math.abs(p.y - d.y0) };
        if (r.w > 0.75 || r.d > 0.75) d.moved = true;
        const [w, dd] = toolSize();
        setGhost(d.moved ? { x: snapCoordinate(model, "x", r.x), y: snapCoordinate(model, "y", r.y), w: Math.max(1, snapCoordinate(model, "x", r.x + r.w) - snapCoordinate(model, "x", r.x)), d: Math.max(1, snapCoordinate(model, "y", r.y + r.d) - snapCoordinate(model, "y", r.y)) } : { x: snapCoordinate(model, "x", d.x0 - w / 2), y: snapCoordinate(model, "y", d.y0 - dd / 2), w, d: dd });
        return;
      }
      if (d.kind === "zoneMove") {
        const nx = p.x - d.grabX;
        const ny = p.y - d.grabY;
        if (Math.abs(nx - (zoneRect(model.zones.find((z) => z.id === d.id)!).x)) > 0.01 || Math.abs(ny - zoneRect(model.zones.find((z) => z.id === d.id)!).y) > 0.01) d.moved = true;
        moveZoneAction(d.id, nx, ny, autoGrow);
        return;
      }
      if (d.kind === "zoneResize") {
        const r = resizeByHandle(d.start, d.handle, p.x, p.y);
        resizeZoneAction(d.id, r, autoGrow);
        return;
      }
      if (d.kind === "edge") {
        if (d.edge === "e") setFootprintRect(Math.round(p.x), D);
        else setFootprintRect(W, Math.round(p.y));
      } else {
        const wall = model.walls.find((w) => w.id === d.wallId);
        if (!wall) return;
        const f = wallFrame(wall);
        const u = (p.x - wall.start.x) * f.dir.x + (p.y - wall.start.y) * f.dir.y;
        const snap = e.shiftKey ? 1 : 1 / 12;
        moveOpening(d.id, Math.round((u - d.grabOffsetFt) / snap) * snap);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, toPlan, setFootprintRect, moveOpening, D, W, tool, toolSpecies, toolRoomType, autoGrow, moveZoneAction, resizeZoneAction, doorKey, windowKey],
  );

  /** Place the active door/window palette entry on the wall under the cursor. */
  function placeOnWall(wallId: string, u: number) {
    const entry = tool === "door" ? DOOR_PALETTE.find((e) => e.key === doorKey) : WINDOW_PALETTE.find((e) => e.key === windowKey);
    if (!entry) return;
    const id = addOpening({ wallId, type: entry.type, centerFt: u, widthFt: entry.widthFt, heightFt: entry.heightFt, sillFt: entry.sillFt, swing: entry.swing, variant: entry.variant });
    if (id) select(id);
  }

  /** Preset size for the active stamp tool, [w, d] feet. */
  function toolSize(): [number, number] {
    if (tool === "pen") return defaultPenSize(toolSpecies);
    if (tool === "aisle") {
      const along = model?.roof.ridgeAxis === "ns" ? D : W;
      return model?.roof.ridgeAxis === "ns" ? [12, along] : [along, 12];
    }
    return ROOM_PRESETS[toolRoomType] ?? [12, 12];
  }

  /** Commit a draw/stamp: uses the ghost rect. */
  function commitDraw() {
    if (!model || !ghost) return;
    const type: ZoneType = tool === "pen" ? "pen" : tool === "aisle" ? "aisle" : toolRoomType;
    const id = addZone({ type, species: tool === "pen" ? toolSpecies : undefined, rect: ghost, autoGrow });
    if (id) select(id);
  }

  if (!model || fp?.kind !== "rect") {
    return <div className="flex h-full items-center justify-center text-sm text-muted">No footprint</div>;
  }

  const wallT = 0.5; // drawn wall thickness in feet (post + girts ≈ 7")
  const gridStep = scale >= 12 ? 1 : scale >= 4 ? 2 : 4;
  const gridLines: number[] = [];
  for (let g = 0; g <= Math.max(W, D); g += gridStep) gridLines.push(g);
  const posts = framing?.posts ?? [];
  const postHalf = (5.5 / 24) * scale;
  const bay = model.frame.bayFt;

  const wallAt = (w: Wall) => ({ f: wallFrame(w), w });

  return (
    <div ref={wrapRef} className={`relative h-full w-full select-none overflow-hidden bg-[#faf8f4] ${tool === "erase" ? "cursor-not-allowed" : tool !== "select" ? "cursor-crosshair" : ""}`}>
      <ToolPalette />
      <svg
        width={size.w}
        height={size.h}
        className="block"
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerLeave={() => {
          finishDrag();
          setGhost(null);
          setCursorFt(null);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !model) return;
          const onEmpty = e.target === e.currentTarget || (e.target as Element).getAttribute("data-plan-bg") === "1";
          if ((tool === "pen" || tool === "room" || tool === "aisle") && onEmpty) {
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = toPlan(e, e.currentTarget);
            beginDrag({ kind: "draw", x0: p.x, y0: p.y, moved: false });
          }
        }}
        onClick={(e) => {
          if (tool !== "select") return; // a stamp just selected its new zone
          if (e.target === e.currentTarget || (e.target as Element).getAttribute("data-plan-bg") === "1") select(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (e.target === e.currentTarget || (e.target as Element).getAttribute("data-plan-bg") === "1") {
            const p = toPlan(e, e.currentTarget);
            openContextMenu({ kind: "empty", x: e.clientX, y: e.clientY, from: "plan", planX: p.x, planY: p.y });
          }
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

        {/* bay lines (post grid) */}
        <g stroke="#d3cfc7" strokeWidth={1} strokeDasharray="2 3">
          {model.roof.ridgeAxis === "ns"
            ? Array.from({ length: Math.ceil(D / bay) - 1 }, (_, i) => (i + 1) * bay).map((y) => <line key={y} x1={px(0)} y1={py(y)} x2={px(W)} y2={py(y)} />)
            : Array.from({ length: Math.ceil(W / bay) - 1 }, (_, i) => (i + 1) * bay).map((x) => <line key={x} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(D)} />)}
        </g>

        {/* slab */}
        <rect x={px(0)} y={py(D)} width={W * scale} height={D * scale} fill={model.foundation.slab.enabled ? "#d9d6cf" : "transparent"} opacity={0.5} data-plan-bg="1" />

        {/* zones (pens, aisles, rooms) and derived partitions */}
        <ZoneLayer
          zones={model.zones}
          partitions={partitions}
          px={px}
          py={py}
          scale={scale}
          selection={selection}
          hovered={hovered}
          problems={problems}
          onPointerDownZone={(z, e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (tool === "erase") {
              removeZone(z.id);
              return;
            }
            if (tool !== "select") return;
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            select(z.id);
            const p = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
            const r = zoneRect(z);
            beginDrag({ kind: "zoneMove", id: z.id, grabX: p.x - r.x, grabY: p.y - r.y, w: r.w, d: r.d, moved: false });
          }}
          onPointerDownHandle={(z, h, e) => {
            e.stopPropagation();
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            beginDrag({ kind: "zoneResize", id: z.id, handle: h, start: zoneRect(z) });
          }}
          onContextMenu={(z, e) => {
            e.preventDefault();
            e.stopPropagation();
            select(z.id);
            openContextMenu({ kind: "zone", id: z.id, x: e.clientX, y: e.clientY, from: "plan" });
          }}
          onHover={setHovered}
          onDoubleClick={(z) => select(z.id)}
        />

        {/* ghost for stamp/draw tools */}
        {ghost && tool !== "select" && tool !== "erase" ? (
          <g pointerEvents="none">
            <rect x={px(ghost.x)} y={py(ghost.y + ghost.d)} width={ghost.w * scale} height={ghost.d * scale} fill={tool === "pen" ? SPECIES_PRESETS[toolSpecies].color : zoneFill({ type: tool === "aisle" ? "aisle" : toolRoomType } as never)} fillOpacity={0.45} stroke="#b5532a" strokeDasharray="4 3" />
            <text x={px(ghost.x + ghost.w / 2)} y={py(ghost.y + ghost.d / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontFamily="ui-monospace, monospace" fill="#1c1b19">
              {formatFtIn(ghost.w)}×{formatFtIn(ghost.d)}
            </text>
          </g>
        ) : null}

        {/* concrete: aprons outside big doors */}
        {model.foundation.slab.enabled && model.foundation.slab.aprons
          ? model.openings.filter((o) => needsApron(o.type)).map((o) => {
              const w = model.walls.find((x) => x.id === o.wallId);
              if (!w) return null;
              const f = wallFrame(w);
              const depth = model.foundation.slab.apronDepthFt;
              const pts = [
                [o.offsetFt - 1, 0],
                [o.offsetFt + o.widthFt + 1, 0],
                [o.offsetFt + o.widthFt + 1, depth],
                [o.offsetFt - 1, depth],
              ].map(([u, n]) => `${px(w.start.x + f.dir.x * u + f.normal.x * n)},${py(w.start.y + f.dir.y * u + f.normal.y * n)}`);
              return <polygon key={`apron_${o.id}`} points={pts.join(" ")} fill="#d9d6cf" fillOpacity={0.6} stroke="#a9a59c" strokeDasharray="3 2" pointerEvents="none" />;
            })
          : null}

        {/* lean-tos */}
        {model.leanTos.map((lt) => {
          const poly = leanToPolygon(model, lt);
          if (poly.length === 0) return null;
          const pts = poly.map((p) => `${px(p.x)},${py(p.y)}`).join(" ");
          const sel = selection === lt.id;
          const mid = { x: (poly[0].x + poly[2].x) / 2, y: (poly[0].y + poly[2].y) / 2 };
          return (
            <g
              key={lt.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (tool === "erase") return removeLeanTo(lt.id);
                select(lt.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                select(lt.id);
                openContextMenu({ kind: "leanTo", id: lt.id, x: e.clientX, y: e.clientY, from: "plan" });
              }}
              data-testid={`plan-leanto-${lt.side}`}
            >
              <polygon points={pts} fill={lt.slab ? "#d9d6cf" : "#eeece6"} fillOpacity={0.7} stroke={sel ? "#b5532a" : "#4a4741"} strokeWidth={sel ? 2 : 1.25} strokeDasharray={lt.enclosed ? undefined : "6 3"} />
              <text x={px(mid.x)} y={py(mid.y)} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#4a4741" pointerEvents="none">
                {lt.enclosed ? "Enclosed lean-to" : "Lean-to"} {lt.depthFt}&apos; · {lt.pitch}:12
              </text>
            </g>
          );
        })}

        {/* ghost for door/window tools on the nearest wall */}
        {wallGhost && (tool === "door" || tool === "window")
          ? (() => {
              const w = model.walls.find((x) => x.id === wallGhost.wallId);
              if (!w) return null;
              const f = wallFrame(w);
              const u0 = wallGhost.u - wallGhost.w / 2;
              const u1 = wallGhost.u + wallGhost.w / 2;
              const P = (u: number, n: number) => `${px(w.start.x + f.dir.x * u + f.normal.x * n)},${py(w.start.y + f.dir.y * u + f.normal.y * n)}`;
              return <polygon points={[P(u0, -0.6), P(u1, -0.6), P(u1, 0.6), P(u0, 0.6)].join(" ")} fill="#b5532a" fillOpacity={0.35} stroke="#b5532a" strokeDasharray="3 2" pointerEvents="none" />;
            })()
          : null}

        {/* exterior walls: thick line inside the plan line, with gaps at openings */}
        {model.walls
          .filter((w) => w.role === "exterior")
          .map((w) => {
            const { f } = wallAt(w);
            const spans = model.openings.filter((o) => o.wallId === w.id).sort((a, b) => a.offsetFt - b.offsetFt);
            const segs: [number, number][] = [];
            let c = 0;
            for (const o of spans) {
              if (o.offsetFt > c) segs.push([c, o.offsetFt]);
              c = o.offsetFt + o.widthFt;
            }
            if (c < f.lengthFt) segs.push([c, f.lengthFt]);
            const inset = -wallT / 2; // wall body sits inside the plan line
            const pt = (u: number) => ({ x: px(w.start.x + f.dir.x * u + f.normal.x * inset), y: py(w.start.y + f.dir.y * u + f.normal.y * inset) });
            const isSel = selection === "footprint" || selection === w.id;
            return (
              <g
                key={w.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const p = toPlan(e, e.currentTarget.ownerSVGElement!);
                  const u = Math.max(0, Math.min(f.lengthFt, (p.x - w.start.x) * f.dir.x + (p.y - w.start.y) * f.dir.y));
                  if (tool === "door" || tool === "window") return placeOnWall(w.id, u);
                  if (tool === "leanTo") {
                    const id = addLeanTo({ side: w.side! });
                    if (id) select(id);
                    return;
                  }
                  select("footprint");
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const p = toPlan(e, e.currentTarget.ownerSVGElement!);
                  const u = (p.x - w.start.x) * f.dir.x + (p.y - w.start.y) * f.dir.y;
                  select("footprint");
                  openContextMenu({ kind: "wall", id: w.id, uFt: Math.max(0, Math.min(f.lengthFt, u)), x: e.clientX, y: e.clientY, from: "plan" });
                }}
                data-testid={`plan-wall-${w.side}`}
              >
                {/* fat invisible hit area (a polygon so it has a real bounding box) */}
                <polygon points={hitBand(w, f, 0, f.lengthFt, Math.max(14, wallT * scale * 2) / scale, px, py)} fill="transparent" />
                {segs.map(([a, b], i) => (
                  <line key={i} x1={pt(a).x} y1={pt(a).y} x2={pt(b).x} y2={pt(b).y} stroke={isSel ? "#b5532a" : "#1c1b19"} strokeWidth={Math.max(2, wallT * scale)} />
                ))}
              </g>
            );
          })}

        {/* posts */}
        <g>
          {posts.map((p) => (
            <rect
              key={p.id}
              x={px(p.x) - postHalf}
              y={py(p.y) - postHalf}
              width={postHalf * 2}
              height={postHalf * 2}
              fill={selection === p.id || hovered === p.id ? "#b5532a" : p.role === "jamb" ? "#7a5a2e" : "#3a3835"}
              stroke="#f6f5f2"
              strokeWidth={0.5}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                select(p.id);
              }}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                select(p.id);
                openContextMenu({ kind: "member", id: p.id, x: e.clientX, y: e.clientY, from: "plan" });
              }}
            >
              <title>{`${p.role} post ${p.nominal} · ${formatFtIn(p.x)}, ${formatFtIn(p.y)}`}</title>
            </rect>
          ))}
        </g>

        {/* openings */}
        {model.openings.map((o) => {
          const w = model.walls.find((x) => x.id === o.wallId);
          if (!w) return null;
          return (
            <OpeningSymbol
              key={o.id}
              o={o}
              w={w}
              px={px}
              py={py}
              scale={scale}
              wallT={wallT}
              selected={selection === o.id}
              hovered={hovered === o.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (tool === "erase") {
                  removeOpening(o.id);
                  return;
                }
                if (tool !== "select") return;
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                select(o.id);
                const p = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
                const f = wallFrame(w);
                const u = (p.x - w.start.x) * f.dir.x + (p.y - w.start.y) * f.dir.y;
                beginDrag({ kind: "opening", id: o.id, wallId: w.id, grabOffsetFt: u - o.offsetFt });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                select(o.id);
                openContextMenu({ kind: "opening", id: o.id, x: e.clientX, y: e.clientY, from: "plan" });
              }}
              onHover={(h) => setHovered(h ? o.id : null)}
            />
          );
        })}

        {/* ridge line */}
        {model.roof.form === "gable" ? (
          model.roof.ridgeAxis === "ns" ? (
            <line x1={px(W / 2)} y1={py(0)} x2={px(W / 2)} y2={py(D)} stroke="#9a9790" strokeDasharray="6 4" pointerEvents="none" />
          ) : (
            <line x1={px(0)} y1={py(D / 2)} x2={px(W)} y2={py(D / 2)} stroke="#9a9790" strokeDasharray="6 4" pointerEvents="none" />
          )
        ) : null}

        {/* dimensions */}
        <Dimension x1={px(0)} y1={py(0) + 26} x2={px(W)} y2={py(0) + 26} label={formatFtIn(W)} />
        <Dimension x1={px(W) + 26} y1={py(0)} x2={px(W) + 26} y2={py(D)} label={formatFtIn(D)} vertical />

        {/* footprint drag handles */}
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
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              select("footprint");
              beginDrag({ kind: "edge", edge: "e" });
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
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              select("footprint");
              beginDrag({ kind: "edge", edge: "n" });
            }}
            data-testid="handle-n"
          />
        </g>

        {/* north arrow */}
        <g transform={`translate(${size.w - 28}, 36) rotate(${-model.site.orientationDeg})`} fill="#1c1b19" pointerEvents="none">
          <polygon points="0,-14 6,6 0,2 -6,6" />
          <text y={20} textAnchor="middle" fontSize={10}>
            N
          </text>
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-muted">
        {formatFtIn(W)} × {formatFtIn(D)} · {W * D} sq ft · {posts.length} posts · {bay}&apos; bays · {model.zones.length} zones
        {cursorFt ? ` · ${formatFtIn(Math.max(0, cursorFt.x))}, ${formatFtIn(Math.max(0, cursorFt.y))}` : ""}
        {drag?.kind === "opening" ? " · Shift = 1' snap" : ""}
      </div>
    </div>
  );
}

function OpeningSymbol({
  o,
  w,
  px,
  py,
  scale,
  wallT,
  selected,
  hovered,
  onPointerDown,
  onContextMenu,
  onHover,
}: {
  o: Opening;
  w: Wall;
  px: (x: number) => number;
  py: (y: number) => number;
  scale: number;
  wallT: number;
  selected: boolean;
  hovered: boolean;
  onPointerDown: (e: React.PointerEvent<SVGGElement>) => void;
  onContextMenu: (e: React.MouseEvent<SVGGElement>) => void;
  onHover: (h: boolean) => void;
}) {
  const f = wallFrame(w);
  const u0 = o.offsetFt;
  const u1 = o.offsetFt + o.widthFt;
  const P = (u: number, n: number) => ({ x: px(w.start.x + f.dir.x * u + f.normal.x * n), y: py(w.start.y + f.dir.y * u + f.normal.y * n) });
  const color = selected ? "#b5532a" : hovered ? "#d98a5f" : "#1c1b19";
  const angleDeg = (-f.angle * 180) / Math.PI; // SVG y is down
  const isWindow = o.type === "window";
  const isSliding = o.type === "slidingDoor" || o.type === "stallDoor";
  const isOverhead = o.type === "overheadDoor" || o.type === "rollUpDoor";
  const swingOut = o.swing === "out";
  const inset = -wallT / 2;

  return (
    <g className="cursor-grab" onPointerDown={onPointerDown} onContextMenu={onContextMenu} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} data-testid={`plan-opening-${o.type}`}>
      {/* hit area across the opening */}
      <polygon points={hitBand(w, f, u0, u1, Math.max(16, wallT * scale * 2) / scale, px, py)} fill="transparent" />
      {isWindow ? (
        <g stroke={color} strokeWidth={1.5}>
          <line x1={P(u0, 0).x} y1={P(u0, 0).y} x2={P(u1, 0).x} y2={P(u1, 0).y} />
          <line x1={P(u0, -wallT).x} y1={P(u0, -wallT).y} x2={P(u1, -wallT).x} y2={P(u1, -wallT).y} />
          <line x1={P(u0, inset).x} y1={P(u0, inset).y} x2={P(u1, inset).x} y2={P(u1, inset).y} strokeWidth={1} />
        </g>
      ) : isSliding ? (
        <g>
          {/* leaf outside the wall, wider than the opening; arrow shows slide direction */}
          {(() => {
            const ov = 0.5;
            const dir = o.swing === "slideLeft" ? -1 : 1;
            const l0 = o.swing === "biParting" ? u0 - ov : u0 - ov;
            const l1 = u1 + ov;
            const n0 = 0.25;
            const n1 = 0.25 + 0.15;
            const c = [P(l0, n0), P(l1, n0), P(l1, n1), P(l0, n1)];
            const mid = P((u0 + u1) / 2, n0 + 0.075);
            const arrowLen = Math.min(o.widthFt * 0.3, 2) * scale * dir;
            return (
              <>
                <polygon points={c.map((p) => `${p.x},${p.y}`).join(" ")} fill="#fff" stroke={color} strokeWidth={1.5} />
                <g transform={`translate(${mid.x} ${mid.y}) rotate(${angleDeg})`}>
                  {o.swing === "biParting" ? (
                    <>
                      <path d={`M 0 0 L ${-arrowLen} 0`} stroke={color} strokeWidth={1.5} markerEnd="url(#arrow)" />
                      <path d={`M 0 0 L ${arrowLen} 0`} stroke={color} strokeWidth={1.5} markerEnd="url(#arrow)" />
                    </>
                  ) : (
                    <path d={`M ${-arrowLen} 0 L ${arrowLen} 0`} stroke={color} strokeWidth={1.5} markerEnd="url(#arrow)" />
                  )}
                </g>
              </>
            );
          })()}
        </g>
      ) : isOverhead ? (
        <g stroke={color} strokeWidth={3}>
          <line x1={P(u0, inset).x} y1={P(u0, inset).y} x2={P(u1, inset).x} y2={P(u1, inset).y} strokeDasharray="6 3" />
        </g>
      ) : (
        <g stroke={color} strokeWidth={1.5} fill="none">
          {/* leaf + swing arc; double doors get two half leaves */}
          {(() => {
            const leaves = o.type === "doubleDoor" ? 2 : 1;
            const leafW = o.widthFt / leaves;
            const side = swingOut ? 1 : -1; // outward normal is +n
            const out: React.ReactNode[] = [];
            for (let i = 0; i < leaves; i++) {
              const hinge = i === 0 ? u0 : u1;
              const dirU = i === 0 ? 1 : -1;
              const tip = P(hinge, side * leafW);
              const h = P(hinge, 0);
              const end = P(hinge + dirU * leafW, 0);
              const sweep = (side > 0 ? 1 : 0) ^ (dirU > 0 ? 0 : 1);
              out.push(
                <g key={i}>
                  <line x1={h.x} y1={h.y} x2={tip.x} y2={tip.y} />
                  <path d={`M ${tip.x} ${tip.y} A ${leafW * scale} ${leafW * scale} 0 0 ${sweep} ${end.x} ${end.y}`} strokeWidth={0.8} strokeDasharray="3 2" />
                </g>,
              );
            }
            return out;
          })()}
        </g>
      )}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <title>{`${o.type} ${formatFtIn(o.widthFt)} × ${formatFtIn(o.heightFt)} @ ${formatFtIn(o.offsetFt)}`}</title>
    </g>
  );
}

/** Nearest exterior wall to a plan point, with the distance and the position along it. */
function nearestWall(model: NonNullable<ReturnType<typeof useProjectStore.getState>["model"]>, x: number, y: number) {
  let best: { wall: Wall; u: number; dist: number } | null = null;
  for (const w of model.walls) {
    if (w.role !== "exterior") continue;
    const f = wallFrame(w);
    const u = Math.max(0, Math.min(f.lengthFt, (x - w.start.x) * f.dir.x + (y - w.start.y) * f.dir.y));
    const cx = w.start.x + f.dir.x * u;
    const cy = w.start.y + f.dir.y * u;
    const dist = Math.hypot(x - cx, y - cy);
    if (!best || dist < best.dist) best = { wall: w, u, dist };
  }
  return best;
}

/** Rectangle of plan-space half-width `halfFt` around the wall segment [u0,u1], as SVG points. */
function hitBand(w: Wall, f: ReturnType<typeof wallFrame>, u0: number, u1: number, widthFt: number, px: (x: number) => number, py: (y: number) => number): string {
  const h = widthFt / 2;
  const P = (u: number, n: number) => `${px(w.start.x + f.dir.x * u + f.normal.x * n)},${py(w.start.y + f.dir.y * u + f.normal.y * n)}`;
  return [P(u0, -h), P(u1, -h), P(u1, h), P(u0, h)].join(" ");
}

function Dimension({ x1, y1, x2, y2, label, vertical = false }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tick = 5;
  return (
    <g stroke="#6b6963" strokeWidth={1} fill="none" pointerEvents="none">
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
      <text x={mx} y={my} fill="#1c1b19" stroke="none" fontSize={11} fontFamily="ui-monospace, monospace" textAnchor="middle" dominantBaseline="middle" transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined} style={{ paintOrder: "stroke" }}>
        <tspan stroke="#ffffff" strokeWidth={4}>
          {label}
        </tspan>
      </text>
    </g>
  );
}
