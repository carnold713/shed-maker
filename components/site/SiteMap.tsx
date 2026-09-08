"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { planToLatLng, siteFrame, type LatLng } from "@/lib/site/geo";
import { leanToPolygon } from "@/lib/model/leanTos";
import { wallFrame } from "@/lib/framing/wallFrame";
import { runArea } from "@/lib/model/runs";
import { siteExtent } from "@/lib/model/runs";

const US_CENTER: LatLng = { lat: 39.5, lng: -98.35 };

interface Meta {
  provider: "google" | "esri";
  attribution: string;
  maxNativeZoom: number;
}

/**
 * The barn and its runs on satellite imagery, to scale (ADR-0017). Leaflet
 * draws the tiles (through /api/tiles so the imagery key stays on the
 * server); the shapes are an SVG laid over the map and re-projected on every
 * move. Drag the barn to move it, the round handle to turn it.
 */
export function SiteMap() {
  const model = useProjectStore((s) => s.model)!;
  const setSite = useProjectStore((s) => s.setSite);
  const select = useProjectStore((s) => s.select);
  const selection = useProjectStore((s) => s.selection);
  const setHint = useViewStore((s) => s.setHint);
  const fitNonce = useViewStore((s) => s.fitNonce);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [tick, setTick] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const frame = siteFrame(model);
  const located = !!frame;

  // ---- Map lifecycle
  useEffect(() => {
    const el = mapEl.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { zoomControl: true, attributionControl: true, zoomSnap: 0.25, wheelPxPerZoomLevel: 90 });
    map.attributionControl.setPrefix("");
    L.control.scale({ imperial: true, metric: false, position: "bottomleft" }).addTo(map);
    const tiles = L.tileLayer("/api/tiles/{z}/{x}/{y}", { maxZoom: 22, maxNativeZoom: 19, tileSize: 256, crossOrigin: false });
    tiles.addTo(map);
    const bump = () => setTick((t) => t + 1);
    map.on("move zoom zoomanim resize viewreset", bump);
    map.setView(US_CENTER, 4);
    mapRef.current = map;
    fetch("/api/tiles/meta")
      .then((r) => r.json())
      .then((m: Meta) => {
        setMeta(m);
        tiles.options.maxNativeZoom = m.maxNativeZoom;
        map.attributionControl.addAttribution(m.attribution);
      })
      .catch(() => {});
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.off("move zoom zoomanim resize viewreset", bump);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to the site when the location is first set or changes from outside a drag.
  const lastLoc = useRef<string>("");
  const dragging = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!frame) {
      lastLoc.current = "";
      return;
    }
    const key = `${frame.origin.lat.toFixed(6)},${frame.origin.lng.toFixed(6)}`;
    if (key === lastLoc.current || dragging.current) return;
    lastLoc.current = key;
    map.setView(frame.origin, Math.max(map.getZoom(), 18), { animate: false });
    // Fit the barn and its runs.
    const ext = siteExtent(model);
    const corners = [
      planToLatLng(frame, { x: ext.x, y: ext.y }),
      planToLatLng(frame, { x: ext.x + ext.w, y: ext.y }),
      planToLatLng(frame, { x: ext.x, y: ext.y + ext.d }),
      planToLatLng(frame, { x: ext.x + ext.w, y: ext.y + ext.d }),
    ];
    map.fitBounds(L.latLngBounds(corners.map((c) => L.latLng(c.lat, c.lng))), { padding: [80, 80], maxZoom: 20, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.origin.lat, frame?.origin.lng, located]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !frame || fitNonce === 0) return;
    const ext = siteExtent(model);
    const corners = [
      planToLatLng(frame, { x: ext.x, y: ext.y }),
      planToLatLng(frame, { x: ext.x + ext.w, y: ext.y }),
      planToLatLng(frame, { x: ext.x, y: ext.y + ext.d }),
      planToLatLng(frame, { x: ext.x + ext.w, y: ext.y + ext.d }),
    ];
    map.fitBounds(L.latLngBounds(corners.map((c) => L.latLng(c.lat, c.lng))), { padding: [80, 80], maxZoom: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  // Click the map to put the barn there when it has no location yet.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      if (located) return;
      setSite({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [located, setSite]);

  // ---- Projection helpers
  const toPx = useCallback(
    (p: { x: number; y: number }) => {
      const map = mapRef.current;
      if (!map || !frame) return { x: 0, y: 0 };
      const ll = planToLatLng(frame, p);
      const pt = map.latLngToContainerPoint(L.latLng(ll.lat, ll.lng));
      return { x: pt.x, y: pt.y };
    },
    [frame],
  );
  const poly = (pts: { x: number; y: number }[]) => pts.map((p) => { const q = toPx(p); return `${q.x},${q.y}`; }).join(" ");

  // ---- Drag the barn; drag the handle to turn it.
  const onBarnDown = (e: React.PointerEvent<SVGElement>) => {
    const map = mapRef.current;
    if (!map || !frame || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    map.dragging.disable();
    dragging.current = true;
    const startPt = map.latLngToContainerPoint(L.latLng(frame.origin.lat, frame.origin.lng));
    const sx = e.clientX;
    const sy = e.clientY;
    useProjectStore.temporal.getState().pause();
    const move = (ev: PointerEvent) => {
      const ll = map.containerPointToLatLng(L.point(startPt.x + ev.clientX - sx, startPt.y + ev.clientY - sy));
      setSite({ lat: ll.lat, lng: ll.lng });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      map.dragging.enable();
      dragging.current = false;
      useProjectStore.temporal.getState().resume();
      lastLoc.current = `${useProjectStore.getState().model?.site.lat?.toFixed(6)},${useProjectStore.getState().model?.site.lng?.toFixed(6)}`;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onRotateDown = (e: React.PointerEvent<SVGElement>) => {
    const map = mapRef.current;
    if (!map || !frame || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    map.dragging.disable();
    const c = map.latLngToContainerPoint(L.latLng(frame.origin.lat, frame.origin.lng));
    const rect = mapEl.current!.getBoundingClientRect();
    useProjectStore.temporal.getState().pause();
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - rect.left - c.x;
      const dy = ev.clientY - rect.top - c.y;
      let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      deg = ev.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
      setSite({ orientationDeg: ((deg % 360) + 360) % 360 });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      map.dragging.enable();
      useProjectStore.temporal.getState().resume();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ---- Shapes
  const fp = model.footprint.kind === "rect" ? model.footprint : null;
  const shapes = useMemo(() => {
    void tick;
    if (!frame || !fp) return null;
    const W = fp.wFt;
    const D = fp.dFt;
    const footprint = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }];
    const leanTos = model.leanTos.map((lt) => ({ id: lt.id, pts: leanToPolygon(model, lt) }));
    const doors = model.openings
      .filter((o) => o.type !== "window")
      .map((o) => {
        const w = model.walls.find((x) => x.id === o.wallId);
        if (!w) return null;
        const f = wallFrame(w);
        const a = { x: w.start.x + f.dir.x * o.offsetFt, y: w.start.y + f.dir.y * o.offsetFt };
        const b = { x: w.start.x + f.dir.x * (o.offsetFt + o.widthFt), y: w.start.y + f.dir.y * (o.offsetFt + o.widthFt) };
        return { id: o.id, a, b };
      })
      .filter((d): d is NonNullable<typeof d> => !!d);
    const runs = model.runs.map((r) => ({ id: r.id, name: r.name, area: runArea(r), pts: [{ x: r.rect.x, y: r.rect.y }, { x: r.rect.x + r.rect.w, y: r.rect.y }, { x: r.rect.x + r.rect.w, y: r.rect.y + r.rect.d }, { x: r.rect.x, y: r.rect.y + r.rect.d }], center: { x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.d / 2 }, gates: r.gates.map((g) => {
      const horizontal = g.side === "n" || g.side === "s";
      const x0 = horizontal ? r.rect.x + g.offsetFt : g.side === "w" ? r.rect.x : r.rect.x + r.rect.w;
      const y0 = horizontal ? (g.side === "s" ? r.rect.y : r.rect.y + r.rect.d) : r.rect.y + g.offsetFt;
      return { id: g.id, a: { x: x0, y: y0 }, b: horizontal ? { x: x0 + g.widthFt, y: y0 } : { x: x0, y: y0 + g.widthFt } };
    }) }));
    const ridge = model.roof.ridgeAxis === "ns" ? [{ x: W / 2, y: 0 }, { x: W / 2, y: D }] : [{ x: 0, y: D / 2 }, { x: W, y: D / 2 }];
    return { footprint, leanTos, doors, runs, ridge, center: { x: W / 2, y: D / 2 }, north: { x: W / 2, y: D + Math.max(12, D * 0.35) } };
  }, [frame, fp, model, tick]);

  const px = shapes ? { c: toPx(shapes.center), n: toPx(shapes.north) } : null;
  const ftPerPx = (() => {
    const map = mapRef.current;
    if (!map || !frame) return 0;
    const a = map.latLngToContainerPoint(L.latLng(frame.origin.lat, frame.origin.lng));
    const b = map.latLngToContainerPoint(L.latLng(frame.origin.lat, frame.origin.lng + 0.0001));
    const mPerDegLng = 111320 * Math.cos((frame.origin.lat * Math.PI) / 180);
    return (0.0001 * mPerDegLng) / 0.3048 / Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y));
  })();

  return (
    <div className="absolute inset-0" data-testid="site-map" data-located={located ? "1" : "0"} data-provider={meta?.provider ?? ""}>
      <div ref={mapEl} className="absolute inset-0 bg-[#dfe6d8]" />
      {shapes ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" data-testid="site-overlay">
          {/* runs */}
          {shapes.runs.map((r) => {
            const c = toPx(r.center);
            const sel = selection === r.id;
            return (
              <g key={r.id} className="pointer-events-auto cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); select(r.id); }} data-testid="map-run">
                <polygon points={poly(r.pts)} fill="#9ccc65" fillOpacity={sel ? 0.5 : 0.35} stroke={sel ? "#b5532a" : "#f4ffe8"} strokeWidth={sel ? 3 : 2} strokeDasharray={sel ? undefined : "8 4"} />
                {r.gates.map((g) => { const a = toPx(g.a); const b = toPx(g.b); return <line key={g.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth={5} />; })}
                <text x={c.x} y={c.y} textAnchor="middle" fontSize={12} fontWeight={600} fill="#fff" stroke="#2f4a22" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
                  {r.name} · {r.area.toLocaleString()} sq ft
                </text>
              </g>
            );
          })}
          {/* lean-tos */}
          {shapes.leanTos.map((lt) => (
            <polygon key={lt.id} points={poly(lt.pts)} fill="#d9d6cf" fillOpacity={0.6} stroke="#f7f4ee" strokeWidth={1.5} strokeDasharray="6 3" />
          ))}
          {/* barn */}
          <g className="pointer-events-auto cursor-move" onPointerDown={onBarnDown} data-testid="map-barn">
            <polygon points={poly(shapes.footprint)} fill={model.materials.roofColor ?? "#b5532a"} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
            <polyline points={poly(shapes.ridge)} fill="none" stroke="#fff" strokeWidth={1} strokeOpacity={0.8} />
            {shapes.doors.map((d) => { const a = toPx(d.a); const b = toPx(d.b); return <line key={d.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffe9c9" strokeWidth={4} />; })}
            {px ? (
              <text x={px.c.x} y={px.c.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" stroke="#3a2a1f" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
                {fp ? `${fp.wFt}′ × ${fp.dFt}′` : ""}
              </text>
            ) : null}
          </g>
          {/* rotate handle on the plan's north side */}
          {px ? (
            <g className="pointer-events-auto cursor-grab" onPointerDown={onRotateDown} data-testid="map-rotate">
              <line x1={px.c.x} y1={px.c.y} x2={px.n.x} y2={px.n.y} stroke="#fff" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />
              <circle cx={px.n.x} cy={px.n.y} r={9} fill="#fff" stroke="#b5532a" strokeWidth={2} />
              <text x={px.n.x} y={px.n.y + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#b5532a" pointerEvents="none">
                ↻
              </text>
            </g>
          ) : null}
        </svg>
      ) : null}
      {/* north arrow, scale hint, and the empty-state prompt */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-center rounded-full bg-white/85 px-2 py-1 text-[11px] font-semibold text-foreground shadow">
        <span>N</span>
        <span className="-mt-1 text-base leading-none">↑</span>
      </div>
      {!located ? (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-[12px] text-foreground shadow" data-testid="site-map-prompt">
          Search your address in the panel, or click the map where the barn goes.
        </div>
      ) : (
        <div className="pointer-events-none absolute left-1/2 bottom-3 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] text-foreground/80 shadow" onMouseEnter={() => setHint("Drag the barn to move it · drag the round handle to turn it · scroll to zoom")}>
          {ftPerPx > 0 ? `${(ftPerPx * 100).toFixed(0)}' per 100 px · ${Math.round(model.site.orientationDeg)}° from north` : ""}
        </div>
      )}
    </div>
  );
}
