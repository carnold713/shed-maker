"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { useDerived } from "@/lib/store/useDerived";
import { wallFrame } from "@/lib/framing/wallFrame";
import { formatFtIn } from "@/lib/units";
import type { FixtureKind, InteriorDoorType, Opening, Species, Wall, ZoneType } from "@/lib/model/schema";
import { defaultPenSize, ROOM_PRESETS, snapCoordinate, zoneRect, ZONE_TYPE_LABEL, type Rect } from "@/lib/model/zones";
import { derivePartitions, type Partition } from "@/lib/interior/partitions";
import { ZoneLayer, resizeByHandle, zoneFill, type Handle } from "./ZoneLayer";
import { FixtureLayer } from "./FixtureLayer";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { DOOR_PALETTE, WINDOW_PALETTE, OPENING_PRESETS, needsApron } from "@/lib/model/openings";
import { leanToPolygon } from "@/lib/model/leanTos";
import { INTERIOR_DOOR_PRESETS, defaultInteriorDoorSize, defaultInteriorDoorType, defaultExteriorDoorSpec, type ExteriorDoorSpec } from "@/lib/model/interiorDoors";
import { FIXTURE_PRESETS } from "@/lib/model/electrical";
import { deriveElectrical } from "@/lib/electrical/derive";
import { deriveDrainage } from "@/lib/plumbing/drainage";
import { DrainLayer } from "./DrainLayer";
import { RunLayer } from "./RunLayer";
import { runGhostAt, siteExtent, FENCE_PRESETS, type RunGhost } from "@/lib/model/runs";
import { FenceLayer } from "./FenceLayer";
import { fenceAreaSqFt, fenceLengthFt, formatArea, type Pt } from "@/lib/model/fences";
import { addDraftPoint, finishDraft, snapDraftPoint, FENCE_TOOL_HINT } from "@/lib/site/fenceDraft";
import { DRAIN_PRESETS, OUTLET_ID, zoneAt } from "@/lib/model/drainage";

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
  const setTool = useViewStore((s) => s.setTool);
  const setHint = useViewStore((s) => s.setHint);
  const step = useViewStore((s) => s.step);
  const toolInteriorDoorType = useViewStore((s) => s.toolInteriorDoorType) as InteriorDoorType;
  const toolFixtureKind = useViewStore((s) => s.toolFixtureKind) as FixtureKind;
  const addInteriorDoor = useProjectStore((s) => s.addInteriorDoor);
  const removeInteriorDoor = useProjectStore((s) => s.removeInteriorDoor);
  const moveInteriorDoor = useProjectStore((s) => s.moveInteriorDoor);
  const setAutoDoor = useProjectStore((s) => s.setAutoDoor);
  const addFixture = useProjectStore((s) => s.addFixture);
  const removeFixture = useProjectStore((s) => s.removeFixture);
  const moveFixture = useProjectStore((s) => s.moveFixture);
  const [wallGhost, setWallGhost] = useState<{ wallId: string; u: number; w: number; spec?: ExteriorDoorSpec } | null>(null);
  const [runGhost, setRunGhost] = useState<RunGhost | null>(null);
  const fenceDraft = useViewStore((s) => s.fenceDraft);
  const [fenceHover, setFenceHover] = useState<Pt | null>(null);
  const [doorGhost, setDoorGhost] = useState<{ partition: Partition; u: number; w: number; zoneId: string; side: "n" | "s" | "e" | "w"; offsetFt: number; type: InteriorDoorType } | null>(null);
  const doorToolOn = tool === "interiorDoor" || tool === "door";
  const [fixtureGhost, setFixtureGhost] = useState<{ x: number; y: number; onWall: boolean } | null>(null);
  const electrical = useMemo(() => (model ? deriveElectrical(model) : null), [model]);
  const toolDrainKind = useViewStore((s) => s.toolDrainKind);
  const addDrain = useProjectStore((s) => s.addDrain);
  const removeDrain = useProjectStore((s) => s.removeDrain);
  const moveDrain = useProjectStore((s) => s.moveDrain);
  const addRun = useProjectStore((s) => s.addRun);
  const moveFencePoint = useProjectStore((s) => s.moveFencePoint);
  const moveFence = useProjectStore((s) => s.moveFence);
  const removeFence = useProjectStore((s) => s.removeFence);
  const moveRun = useProjectStore((s) => s.moveRun);
  const resizeRun = useProjectStore((s) => s.resizeRun);
  const removeRun = useProjectStore((s) => s.removeRun);
  const setOutlet = useProjectStore((s) => s.setOutlet);
  const removeOutlet = useProjectStore((s) => s.removeOutlet);
  const drainage = useMemo(() => (model && model.drainage.drains.length ? deriveDrainage(model) : null), [model]);
  const [drainGhost, setDrainGhost] = useState<{ x: number; y: number; onWall: boolean } | null>(null);
  const showElectrical = step === "electrical" || (model?.electrical.fixtures.length ?? 0) > 0;
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

  const margin = 64;
  // Fit the barn with its lean-tos and runs (plan feet; runs sit outside the footprint).
  const ext = useMemo(() => (model && fp?.kind === "rect" ? siteExtent(model) : { x: 0, y: 0, w: W || 24, d: D || 36 }), [model, fp, W, D]);
  const baseScale = useMemo(() => {
    if (!ext.w || !ext.d) return 10;
    return Math.max(0.5, Math.min((size.w - 2 * margin) / ext.w, (size.h - 2 * margin) / ext.d));
  }, [ext, size]);
  // Zoom (1 = fit) and pan (px) on top of the fitted view; F / Fit resets both.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const fitNonce = useViewStore((s) => s.fitNonce);
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [fitNonce]);
  const scale = baseScale * zoom;
  const ox = (size.w - ext.w * scale) / 2 - ext.x * scale + pan.x;
  const oy = (size.h + ext.d * scale) / 2 + ext.y * scale + pan.y;
  const navRef = useRef({ zoom, pan, size, ext, baseScale });
  navRef.current = { zoom, pan, size, ext, baseScale };
  /** Zoom by a factor about a wrapper-relative pixel, keeping the plan point under it fixed. */
  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const n = navRef.current;
    const z1 = Math.min(8, Math.max(0.25, n.zoom * factor));
    if (z1 === n.zoom) return;
    const s0 = n.baseScale * n.zoom;
    const s1 = n.baseScale * z1;
    const ox0 = (n.size.w - n.ext.w * s0) / 2 - n.ext.x * s0 + n.pan.x;
    const oy0 = (n.size.h + n.ext.d * s0) / 2 + n.ext.y * s0 + n.pan.y;
    const x = (cx - ox0) / s0;
    const y = (oy0 - cy) / s0;
    setZoom(z1);
    setPan({ x: cx - x * s1 - (n.size.w - n.ext.w * s1) / 2 + n.ext.x * s1, y: cy + y * s1 - (n.size.h + n.ext.d * s1) / 2 - n.ext.y * s1 });
  }, []);
  // Wheel: two-finger scroll pans, pinch / Ctrl+wheel zooms (design-tool convention). Non-passive so the page never scrolls.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0025));
      else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);
  // Space + drag pans with any tool armed.
  const [spaceHeld, setSpaceHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === " " && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  const justPanned = useRef(false);
  /** A placement tool just added something on bare floor: the click that follows must not deselect it. */
  const justPlaced = useRef(false);
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
    | { kind: "draw"; x0: number; y0: number; moved: boolean }
    | { kind: "doorMove"; id: string; vertical: boolean; origin: number; grabFt: number }
    | { kind: "fixtureMove"; id: string; grabX: number; grabY: number }
    | { kind: "pan"; startX: number; startY: number; panX: number; panY: number; moved: boolean }
    | { kind: "drainMove"; id: string; grabX: number; grabY: number }
    | { kind: "runMove"; id: string; grabX: number; grabY: number }
    | { kind: "runResize"; id: string; handle: Handle; start: Rect }
    | { kind: "fenceVertex"; id: string; index: number }
    | { kind: "fenceMove"; id: string; lastX: number; lastY: number }
    | { kind: "outletMove" };
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
    if (d?.kind === "pan") justPanned.current = d.moved;
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
      if (d?.kind === "pan") {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        setPan({ x: d.panX + dx, y: d.panY + dy });
        return;
      }
      if (!d) {
        if (tool === "interiorDoor" || tool === "door") {
          // One Door tool: a partition within 2' gets an interior door, an outside wall within 3' gets an opening.
          const g = doorGhostAt(model, partitions, p.x, p.y, tool === "interiorDoor" ? toolInteriorDoorType : null);
          const hit = nearestWall(model, p.x, p.y);
          const useInterior = !!g && (!hit || hit.dist > 3 || g.dist <= hit.dist);
          if (useInterior && g) {
            setDoorGhost(g);
            setWallGhost(null);
            setHint(`Click to add a ${INTERIOR_DOOR_PRESETS[g.type].label.toLowerCase()} to ${model.zones.find((z) => z.id === g.zoneId)?.name ?? "this stall"} here`);
            return;
          }
          setDoorGhost(null);
          if (hit && hit.dist <= 3) {
            const ex = exteriorGhostAt(model, hit, tool === "door" ? DOOR_PALETTE.find((e) => e.key === doorKey) : undefined);
            setWallGhost({ wallId: hit.wall.id, u: hit.u, w: ex.spec.widthFt, spec: ex.spec });
            setHint(`Click to add a ${ex.label} on the ${SIDE_NAME[hit.wall.side ?? "s"]} wall${ex.zoneName ? ` for ${ex.zoneName}` : ""}`);
          } else {
            setWallGhost(null);
            setHint("Hover a stall or room wall for an inside door, or an outside wall for a sliding, Dutch or entry door");
          }
          return;
        }
        if (tool === "run") {
          const g = runGhostAt(model, p);
          setRunGhost(g);
          const inside = p.x > 0 && p.x < W && p.y > 0 && p.y < D;
          setHint(g ? g.hint : inside ? "Runs go outside the walls — move the pointer beside an outside wall" : null);
          return;
        }
        if (tool === "fence") {
          setFenceHover(snapDraftPoint(p));
          setHint(FENCE_TOOL_HINT);
          return;
        }
        if (tool === "drain") {
          if (toolDrainKind === "outlet") {
            const hit = nearestWall(model, p.x, p.y);
            if (hit) {
              const f = wallFrame(hit.wall);
              const u = Math.round(hit.u * 2) / 2;
              setDrainGhost({ x: hit.wall.start.x + f.dir.x * u, y: hit.wall.start.y + f.dir.y * u, onWall: true });
            }
          } else setDrainGhost({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2, onWall: false });
          return;
        }
        if (tool === "fixture") {
          const preset = FIXTURE_PRESETS[toolFixtureKind];
          const hit = preset.wall ? nearestWall(model, p.x, p.y) : null;
          if (hit && hit.dist <= 3) {
            const f = wallFrame(hit.wall);
            const u = Math.round(hit.u * 2) / 2;
            setFixtureGhost({ x: hit.wall.start.x + f.dir.x * u, y: hit.wall.start.y + f.dir.y * u, onWall: true });
          } else setFixtureGhost({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2, onWall: false });
          return;
        }
        if (tool === "window") {
          const hit = nearestWall(model, p.x, p.y);
          const entry = WINDOW_PALETTE.find((e) => e.key === windowKey);
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
      if (d.kind === "doorMove") {
        const along = d.vertical ? p.y : p.x;
        moveInteriorDoor(d.id, along - d.origin - d.grabFt);
        return;
      }
      if (d.kind === "fixtureMove") {
        moveFixture(d.id, p.x - d.grabX, p.y - d.grabY);
        return;
      }
      if (d.kind === "drainMove") {
        moveDrain(d.id, p.x - d.grabX, p.y - d.grabY);
        return;
      }
      if (d.kind === "runMove") {
        moveRun(d.id, p.x - d.grabX, p.y - d.grabY);
        return;
      }
      if (d.kind === "runResize") {
        resizeRun(d.id, resizeByHandle(d.start, d.handle, p.x, p.y));
        return;
      }
      if (d.kind === "fenceVertex") {
        moveFencePoint(d.id, d.index, snapDraftPoint(p));
        return;
      }
      if (d.kind === "fenceMove") {
        const dx = Math.round((p.x - d.lastX) * 2) / 2;
        const dy = Math.round((p.y - d.lastY) * 2) / 2;
        if (dx || dy) {
          moveFence(d.id, dx, dy);
          d.lastX += dx;
          d.lastY += dy;
        }
        return;
      }
      if (d.kind === "outletMove") {
        setOutlet({ x: p.x, y: p.y });
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
    [model, toPlan, setFootprintRect, moveOpening, D, W, tool, toolSpecies, toolRoomType, autoGrow, moveZoneAction, resizeZoneAction, doorKey, windowKey, partitions, toolInteriorDoorType, toolFixtureKind, moveInteriorDoor, moveFixture, toolDrainKind, moveDrain, setOutlet],
  );

  /** Place the active door/window palette entry on the wall under the cursor; one placement returns to Select (UX audit §3.7). */
  function placeOnWall(wallId: string, u: number) {
    let entry: { type: Opening["type"]; widthFt: number; heightFt: number; sillFt?: number; swing?: Opening["swing"]; variant?: string } | undefined;
    if (tool === "window") entry = WINDOW_PALETTE.find((e) => e.key === windowKey);
    else if (wallGhost?.spec && wallGhost.wallId === wallId) entry = wallGhost.spec;
    else if (tool === "door") entry = DOOR_PALETTE.find((e) => e.key === doorKey);
    else {
      const w = model?.walls.find((x) => x.id === wallId);
      if (model && w) entry = exteriorGhostAt(model, { wall: w, u, dist: 0 }).spec;
    }
    if (!entry) return;
    const id = addOpening({ wallId, type: entry.type, centerFt: u, widthFt: entry.widthFt, heightFt: entry.heightFt, sillFt: entry.sillFt, swing: entry.swing, variant: entry.variant });
    if (id) {
      select(id);
      setTool("select");
      setWallGhost(null);
      justPlaced.current = true;
    }
  }

  /** Put a fixture at a plan point (wall devices snap in the command). */
  function placeFixture(x: number, y: number, wallId?: string) {
    const id = addFixture({ kind: toolFixtureKind, x, y, wallId });
    if (id) {
      select(id);
      setTool("select");
      setFixtureGhost(null);
      justPlaced.current = true;
    }
  }

  /** Put a drain (or the outlet) where the ghost is. */
  function placeDrain(x: number, y: number) {
    if (toolDrainKind === "outlet") {
      setOutlet({ x, y });
      select(OUTLET_ID);
    } else {
      const id = addDrain({ kind: toolDrainKind, x, y });
      if (id) select(id);
    }
    setTool("select");
    setDrainGhost(null);
    justPlaced.current = true;
  }

  /** Add the ghosted interior door. */
  function placeInteriorDoor() {
    if (!doorGhost) return;
    const id = addInteriorDoor({ zoneId: doorGhost.zoneId, side: doorGhost.side, offsetFt: doorGhost.offsetFt, type: doorGhost.type, widthFt: doorGhost.w });
    if (id) {
      select(id);
      setTool("select");
      setDoorGhost(null);
      justPlaced.current = true;
    }
  }

  /** Hover line for the status bar: noun · fact · verb (UX audit §3.8). */
  const PLAN_HINT = "Drag empty space to move the plan · scroll to move · Ctrl+scroll to zoom · F to fit";
  const hover = (text: string | null) => setHint(text ?? (tool === "select" ? PLAN_HINT : null));

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
    <div
      ref={wrapRef}
      className={`relative h-full w-full select-none overflow-hidden bg-[#faf8f4] ${drag?.kind === "pan" ? "cursor-grabbing" : spaceHeld ? "cursor-grab" : tool === "erase" ? "cursor-not-allowed" : tool !== "select" ? "cursor-crosshair" : ""}`}
      onPointerEnter={() => setHint(tool === "select" ? PLAN_HINT : null)}
      onPointerLeave={() => setHint(null)}
      data-testid="plan-wrap"
      data-zoom={Math.round(zoom * 100)}
    >
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
          if (!model) return;
          const onEmpty = e.target === e.currentTarget || (e.target as Element).getAttribute("data-plan-bg") === "1";
          if (e.button === 1 || (e.button === 0 && (spaceHeld || (tool === "select" && onEmpty)))) {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            beginDrag({ kind: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false });
            return;
          }
          if (e.button !== 0) return;
          if (tool === "fixture" && (onEmpty || (e.target as Element).closest("[data-zone-id]"))) {
            const p = toPlan(e, e.currentTarget);
            if (fixtureGhost) placeFixture(fixtureGhost.x, fixtureGhost.y);
            else placeFixture(p.x, p.y);
            return;
          }
          if (tool === "interiorDoor" || tool === "door") {
            if (doorGhost) placeInteriorDoor();
            else if (wallGhost) placeOnWall(wallGhost.wallId, wallGhost.u);
            return;
          }
          if (tool === "fence") {
            const p = toPlan(e, e.currentTarget);
            const made = addDraftPoint(p);
            if (made) {
              setFenceHover(null);
              justPlaced.current = true;
            }
            return;
          }
          if (tool === "run") {
            if (runGhost) {
              const id = runGhost.zoneId ? addRun({ zoneId: runGhost.zoneId }) : addRun({ side: runGhost.side, offsetFt: runGhost.u, widthFt: runGhost.rect.w, depthFt: runGhost.rect.d });
              if (id) {
                select(id);
                setTool("select");
                setRunGhost(null);
                justPlaced.current = true;
              }
            }
            return;
          }
          if (tool === "drain") {
            const p = toPlan(e, e.currentTarget);
            if (drainGhost) placeDrain(drainGhost.x, drainGhost.y);
            else if (toolDrainKind !== "outlet") placeDrain(p.x, p.y);
            return;
          }
          if ((tool === "pen" || tool === "room" || tool === "aisle") && onEmpty) {
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = toPlan(e, e.currentTarget);
            beginDrag({ kind: "draw", x0: p.x, y0: p.y, moved: false });
          }
        }}
        onDoubleClick={(e) => {
          if (tool === "fence") {
            e.preventDefault();
            finishDraft(false);
            setFenceHover(null);
          }
        }}
        onClick={(e) => {
          if (justPanned.current || justPlaced.current) {
            justPanned.current = false;
            justPlaced.current = false;
            return;
          }
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

        {/* outdoor runs (outside the walls) */}
        <RunLayer
          model={model}
          px={px}
          py={py}
          scale={scale}
          selection={selection}
          hovered={hovered}
          problems={problems}
          showHandles={tool === "select"}
          onPointerDown={(r, e) => {
            if (e.button !== 0) return;
            if (tool !== "select" && tool !== "erase") return;
            e.stopPropagation();
            if (tool === "erase") {
              removeRun(r.id);
              return;
            }
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            select(r.id);
            const p = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
            beginDrag({ kind: "runMove", id: r.id, grabX: p.x - r.rect.x, grabY: p.y - r.rect.y });
          }}
          onPointerDownHandle={(r, h, e) => {
            e.stopPropagation();
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            beginDrag({ kind: "runResize", id: r.id, handle: h, start: { x: r.rect.x, y: r.rect.y, w: r.rect.w, d: r.rect.d } });
          }}
          onContextMenu={(r, e) => {
            e.preventDefault();
            e.stopPropagation();
            select(r.id);
            openContextMenu({ kind: "run", id: r.id, x: e.clientX, y: e.clientY, from: "plan" });
          }}
          onHover={(id) => {
            setHovered(id);
            const r = id ? model.runs.find((x) => x.id === id) : null;
            hover(r ? `${r.name} · ${r.rect.w}' × ${r.rect.d}' · ${FENCE_LABEL(r.fence.kind)} ${r.fence.heightFt}' · drag to move · right-click for more` : null);
          }}
        />
        {runGhost && tool === "run" ? (
          <g pointerEvents="none" data-testid="run-ghost">
            <rect x={px(runGhost.rect.x)} y={py(runGhost.rect.y + runGhost.rect.d)} width={runGhost.rect.w * scale} height={runGhost.rect.d * scale} fill="#9ccc65" fillOpacity={0.35} stroke="#3f6b2e" strokeDasharray="6 3" strokeWidth={1.5} />
            <text x={px(runGhost.rect.x + runGhost.rect.w / 2)} y={py(runGhost.rect.y + runGhost.rect.d / 2)} textAnchor="middle" fontSize={11} fill="#2f4a22">
              {runGhost.label} · {runGhost.rect.w}′ × {runGhost.rect.d}′
            </text>
          </g>
        ) : null}

        {/* free fence lines and the one being drawn */}
        <FenceLayer
          model={model}
          px={px}
          py={py}
          scale={scale}
          selection={selection}
          hovered={hovered}
          draft={fenceDraft}
          draftHover={tool === "fence" ? fenceHover : null}
          showHandles={tool === "select"}
          onPointerDown={(f, e) => {
            if (e.button !== 0) return;
            if (tool !== "select" && tool !== "erase") return;
            e.stopPropagation();
            if (tool === "erase") {
              removeFence(f.id);
              return;
            }
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            select(f.id);
            const p = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
            beginDrag({ kind: "fenceMove", id: f.id, lastX: p.x, lastY: p.y });
          }}
          onPointerDownVertex={(f, i, e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            beginDrag({ kind: "fenceVertex", id: f.id, index: i });
          }}
          onContextMenu={(f, e) => {
            e.preventDefault();
            e.stopPropagation();
            select(f.id);
            const p = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
            openContextMenu({ kind: "fence", id: f.id, x: e.clientX, y: e.clientY, from: "plan", planX: p.x, planY: p.y });
          }}
          onContextMenuVertex={(f, i, e) => {
            e.preventDefault();
            e.stopPropagation();
            select(f.id);
            openContextMenu({ kind: "fenceVertex", id: f.id, index: i, x: e.clientX, y: e.clientY, from: "plan" });
          }}
          onHover={(id) => {
            setHovered(id);
            const f = id ? model.fences.find((x) => x.id === id) : null;
            hover(f ? `${f.name} · ${Math.round(fenceLengthFt(f))}' of ${FENCE_PRESETS[f.kind].label.toLowerCase()} ${f.heightFt}'${f.closed ? ` · ${formatArea(fenceAreaSqFt(f))} inside` : ""} · drag a corner to move it · right-click for more` : null);
          }}
        />

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
            // Placement tools (door, fixture, stamps) must reach the plan's own handler: don't swallow the click here.
            if (tool !== "select" && tool !== "erase") return;
            e.stopPropagation();
            if (tool === "erase") {
              removeZone(z.id);
              return;
            }
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            select(z.id);
            const p = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
            const r = zoneRect(z);
            beginDrag({ kind: "zoneMove", id: z.id, grabX: p.x - r.x, grabY: p.y - r.y, w: r.w, d: r.d, moved: false });
          }}
          showHandles={tool === "select"}
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
          onHover={(id) => {
            setHovered(id);
            const z = id ? model.zones.find((zz) => zz.id === id) : null;
            hover(z ? `${z.name} · ${ZONE_TYPE_LABEL[z.type]} · ${formatFtIn(zoneRect(z).w)} × ${formatFtIn(zoneRect(z).d)} · drag to move · right-click for more` : null);
          }}
          onDoubleClick={(z) => select(z.id)}
          onPointerDownDoor={(p, d, e) => {
            if (e.button !== 0) return;
            if (tool !== "select" && tool !== "erase") return; // let the door / fixture tools place beside an existing door
            e.stopPropagation();
            if (tool === "erase") {
              if (d.auto) setAutoDoor(d.zoneId, false);
              else removeInteriorDoor(d.id);
              return;
            }
            if (tool !== "select") return;
            if (d.auto) {
              // The default door has no record yet: make it real so it can be moved and edited.
              const vertical = Math.abs(p.x1 - p.x0) < 1e-9;
              const z = model.zones.find((zz) => zz.id === d.zoneId)!;
              const r = zoneRect(z);
              const side = vertical ? (d.zoneSide === -1 ? "e" : "w") : d.zoneSide === -1 ? "n" : "s";
              const id = addInteriorDoor({ zoneId: z.id, side, offsetFt: d.u + (vertical ? p.y0 - r.y : p.x0 - r.x), type: d.type, widthFt: d.widthFt, heightFt: d.heightFt });
              if (id) select(id);
              return;
            }
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            select(d.id);
            const pt = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
            const vertical = Math.abs(p.x1 - p.x0) < 1e-9;
            const z = model.zones.find((zz) => zz.id === d.zoneId)!;
            const r = zoneRect(z);
            const origin = vertical ? r.y : r.x;
            const doorStart = vertical ? d.y0 : d.x0;
            beginDrag({ kind: "doorMove", id: d.id, vertical, origin, grabFt: (vertical ? pt.y : pt.x) - doorStart });
          }}
          onContextMenuDoor={(p, d, e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!d.auto) select(d.id);
            openContextMenu({ kind: "interiorDoor", id: d.auto ? d.zoneId : d.id, x: e.clientX, y: e.clientY, from: "plan", planX: d.auto ? 1 : 0 });
          }}
          onHoverDoor={(p, d) => {
            setHovered(d && !d.auto ? d.id : null);
            hover(d ? `${INTERIOR_DOOR_PRESETS[d.type].label} · ${formatFtIn(d.widthFt)} wide${d.auto ? " · default door — click to make it editable" : " · drag along the wall · right-click for more"}` : null);
          }}
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
        {wallGhost && (doorToolOn || tool === "window")
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
                  if (tool === "window") return placeOnWall(w.id, u);
                  if (doorToolOn) {
                    // Door placement happened on pointerdown (with the ghost); this click is its tail.
                    if (justPlaced.current) justPlaced.current = false;
                    else placeOnWall(w.id, u);
                    return;
                  }
                  if (tool === "fixture") {
                    const snapped = Math.round(u * 2) / 2;
                    return placeFixture(w.start.x + f.dir.x * snapped, w.start.y + f.dir.y * snapped, w.id);
                  }
                  if (tool === "drain" && toolDrainKind === "outlet") return placeDrain(w.start.x + f.dir.x * u, w.start.y + f.dir.y * u);
                  if (tool === "leanTo") {
                    const id = addLeanTo({ side: w.side! });
                    if (id) {
                      select(id);
                      setTool("select");
                    }
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
                onMouseEnter={() => hover(`${{ n: "North", s: "South", e: "East", w: "West" }[w.side ?? "s"]} wall · ${formatFtIn(f.lengthFt)} · right-click to add a door or window`)}
                onMouseLeave={() => hover(null)}
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

        {/* interior door ghost */}
        {doorGhost && doorToolOn
          ? (() => {
              const pp = doorGhost.partition;
              const vertical = Math.abs(pp.x1 - pp.x0) < 1e-9;
              const a = vertical ? { x: pp.x0, y: pp.y0 + doorGhost.u } : { x: pp.x0 + doorGhost.u, y: pp.y0 };
              const b = vertical ? { x: pp.x0, y: pp.y0 + doorGhost.u + doorGhost.w } : { x: pp.x0 + doorGhost.u + doorGhost.w, y: pp.y0 };
              return <line x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} stroke="#b5532a" strokeWidth={Math.max(6, 0.6 * scale)} strokeLinecap="round" opacity={0.6} pointerEvents="none" />;
            })()
          : null}

        {/* fixture ghost */}
        {fixtureGhost && tool === "fixture" ? <circle cx={px(fixtureGhost.x)} cy={py(fixtureGhost.y)} r={Math.max(6, scale * 0.6)} fill="#b5532a" fillOpacity={0.35} stroke="#b5532a" strokeDasharray="3 2" pointerEvents="none" /> : null}

        {/* drain ghost */}
        {drainGhost && tool === "drain" ? <circle cx={px(drainGhost.x)} cy={py(drainGhost.y)} r={Math.max(6, scale * 0.5)} fill="#3d7ea6" fillOpacity={0.3} stroke="#3d7ea6" strokeDasharray="3 2" pointerEvents="none" /> : null}

        {/* drainage */}
        {drainage ? (
          <DrainLayer
            derived={drainage}
            px={px}
            py={py}
            scale={scale}
            selection={selection}
            hovered={hovered}
            emphasis={step === "building" || model.drainage.drains.some((d) => d.id === selection) || selection === OUTLET_ID}
            onPointerDown={(d, e) => {
              if (e.button !== 0) return;
              if (tool !== "select" && tool !== "erase") return;
              e.stopPropagation();
              if (tool === "erase") {
                removeDrain(d.id);
                return;
              }
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              select(d.id);
              const pt = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
              beginDrag({ kind: "drainMove", id: d.id, grabX: pt.x - d.x, grabY: pt.y - d.y });
            }}
            onContextMenu={(d, e) => {
              e.preventDefault();
              e.stopPropagation();
              select(d.id);
              openContextMenu({ kind: "drain", id: d.id, x: e.clientX, y: e.clientY, from: "plan" });
            }}
            onHover={(d) => {
              setHovered(d ? d.id : null);
              hover(d ? `${d.label ?? DRAIN_PRESETS[d.kind].short} · drag to move · right-click for more` : null);
            }}
            onPointerDownOutlet={(e) => {
              if (e.button !== 0) return;
              if (tool !== "select" && tool !== "erase") return;
              e.stopPropagation();
              if (tool === "erase") {
                removeOutlet();
                return;
              }
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              select(OUTLET_ID);
              beginDrag({ kind: "outletMove" });
            }}
            onContextMenuOutlet={(e) => {
              e.preventDefault();
              e.stopPropagation();
              select(OUTLET_ID);
              openContextMenu({ kind: "drainOutlet", id: OUTLET_ID, x: e.clientX, y: e.clientY, from: "plan" });
            }}
          />
        ) : null}

        {/* electrical */}
        {showElectrical && electrical ? (
          <FixtureLayer
            fixtures={model.electrical.fixtures}
            derived={electrical}
            px={px}
            py={py}
            scale={scale}
            selection={selection}
            hovered={hovered}
            showRoutes={step === "electrical" || model.electrical.fixtures.some((f) => f.id === selection)}
            onPointerDown={(f, e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              if (tool === "erase") {
                removeFixture(f.id);
                return;
              }
              if (tool !== "select") return;
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              select(f.id);
              const pt = toPlan(e, (e.currentTarget as SVGElement).ownerSVGElement!);
              beginDrag({ kind: "fixtureMove", id: f.id, grabX: pt.x - f.x, grabY: pt.y - f.y });
            }}
            onContextMenu={(f, e) => {
              e.preventDefault();
              e.stopPropagation();
              select(f.id);
              openContextMenu({ kind: "fixture", id: f.id, x: e.clientX, y: e.clientY, from: "plan" });
            }}
            onHover={(f) => {
              setHovered(f ? f.id : null);
              hover(f ? `${f.label ?? FIXTURE_PRESETS[f.kind].short} · ${f.mountFt}' up${f.watts ? ` · ${f.watts} W` : ""} · drag to move · right-click for more` : null);
            }}
          />
        ) : null}

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
              onHover={(h) => {
                setHovered(h ? o.id : null);
                hover(h ? `${OPENING_PRESETS[o.type].label} · ${formatFtIn(o.widthFt)} × ${formatFtIn(o.heightFt)} · drag along the wall · right-click for more` : null);
              }}
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

        {/* footprint drag handles (hidden while a placement tool is armed so they never steal the click) */}
        <g style={{ display: tool === "select" ? undefined : "none" }}>
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
      <div className="glass absolute bottom-2 left-2 flex items-center gap-0.5 p-0.5 text-[11px]" data-testid="plan-nav">
        <button className="chip px-2" onClick={() => zoomAt(size.w / 2, size.h / 2, 0.8)} title="Zoom out (Ctrl+scroll)" aria-label="Zoom out" data-testid="plan-zoom-out">
          −
        </button>
        <span className="w-10 text-center font-mono text-muted" data-testid="plan-zoom">
          {Math.round(zoom * 100)}%
        </span>
        <button className="chip px-2" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.25)} title="Zoom in (Ctrl+scroll)" aria-label="Zoom in" data-testid="plan-zoom-in">
          +
        </button>
        <button
          className="chip px-2"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          title="Fit the plan (F)"
          data-testid="plan-fit"
        >
          Fit
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-1.5 right-3 font-mono text-[10.5px] text-muted/80">
        {cursorFt ? `${formatFtIn(Math.max(0, cursorFt.x))}, ${formatFtIn(Math.max(0, cursorFt.y))}` : ""}
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
      {o.awning ? (
        <polygon points={[P(u0 - 1, 0.02), P(u1 + 1, 0.02), P(u1 + 1, o.awning.depthFt), P(u0 - 1, o.awning.depthFt)].map((q) => `${q.x},${q.y}`).join(" ")} fill="#d9d6cf" fillOpacity={0.45} stroke={color} strokeWidth={0.9} strokeDasharray="3 2" pointerEvents="none" data-testid="plan-awning" />
      ) : null}
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

/** Where an interior door would land: nearest partition within 2', snapped to 6", serving the stall/room (not the aisle). */
function doorGhostAt(model: NonNullable<ReturnType<typeof useProjectStore.getState>["model"]>, partitions: Partition[], x: number, y: number, wanted: InteriorDoorType | null) {
  let best: { p: Partition; u: number; dist: number; sideSign: -1 | 1 } | null = null;
  for (const p of partitions) {
    const vertical = Math.abs(p.x1 - p.x0) < 1e-9;
    const u = vertical ? Math.max(0, Math.min(p.lengthFt, y - p.y0)) : Math.max(0, Math.min(p.lengthFt, x - p.x0));
    const dist = vertical ? Math.abs(x - p.x0) : Math.abs(y - p.y0);
    const sideSign: -1 | 1 = (vertical ? x - p.x0 : y - p.y0) >= 0 ? 1 : -1;
    if (dist <= 2 && (!best || dist < best.dist)) best = { p, u, dist, sideSign };
  }
  if (!best) return null;
  const { p, sideSign } = best;
  const [lower, upper] = p.zones;
  const isServed = (z: typeof lower) => !!z && z.type !== "aisle" && z.type !== "open";
  let zone = isServed(lower) && isServed(upper) ? (sideSign === -1 ? lower : upper) : isServed(lower) ? lower : isServed(upper) ? upper : null;
  if (!zone) zone = lower ?? upper;
  if (!zone) return null;
  const vertical = Math.abs(p.x1 - p.x0) < 1e-9;
  const zoneSide: -1 | 1 = lower?.id === zone.id ? -1 : 1;
  const side = vertical ? (zoneSide === -1 ? "e" : "w") : zoneSide === -1 ? "n" : "s";
  const type = wanted ?? defaultInteriorDoorType(zone);
  const w = Math.min(defaultInteriorDoorSize(type, zone.species, p.lengthFt).widthFt, Math.max(1.5, p.lengthFt - 0.5));
  const u = Math.round((best.u - w / 2) * 2) / 2;
  const uc = Math.max(0.25, Math.min(p.lengthFt - w - 0.25, u));
  const r = zoneRect(zone);
  const offsetFt = uc + (vertical ? p.y0 - r.y : p.x0 - r.x);
  return { partition: p, u: uc, w, zoneId: zone.id, side: side as "n" | "s" | "e" | "w", offsetFt, type, dist: best.dist };
}

const SIDE_NAME = { n: "north", s: "south", e: "east", w: "west" } as const;

/**
 * Outside door the Door tool would place at a wall hit: the picked palette entry
 * when one is armed, otherwise a door sized for the space just inside the wall
 * (sliding for aisles, Dutch for stalls, entry door for rooms).
 */
function exteriorGhostAt(model: NonNullable<ReturnType<typeof useProjectStore.getState>["model"]>, hit: { wall: Wall; u: number; dist: number }, picked?: { type: Opening["type"]; widthFt: number; heightFt: number; sillFt?: number; swing?: Opening["swing"]; variant?: string; label: string }): { spec: ExteriorDoorSpec & { sillFt?: number }; label: string; zoneName?: string } {
  const f = wallFrame(hit.wall);
  const inside = { x: hit.wall.start.x + f.dir.x * hit.u - f.normal.x * 0.5, y: hit.wall.start.y + f.dir.y * hit.u - f.normal.y * 0.5 };
  const zone = zoneAt(model, inside.x, inside.y);
  if (picked) return { spec: { type: picked.type, widthFt: picked.widthFt, heightFt: picked.heightFt, sillFt: picked.sillFt, swing: picked.swing, variant: picked.variant }, label: picked.label.toLowerCase(), zoneName: zone?.name };
  const r = zone ? zoneRect(zone) : null;
  const edgeLen = r ? (f.dir.x !== 0 ? r.w : r.d) : f.lengthFt;
  const spec = defaultExteriorDoorSpec(model, zone ?? { type: "open" }, edgeLen);
  const label = `${OPENING_PRESETS[spec.type].label.toLowerCase()} ${formatFtIn(spec.widthFt)} × ${formatFtIn(spec.heightFt)}`;
  return { spec, label, zoneName: zone?.name };
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

function FENCE_LABEL(kind: keyof typeof FENCE_PRESETS): string {
  return FENCE_PRESETS[kind].label.toLowerCase();
}
