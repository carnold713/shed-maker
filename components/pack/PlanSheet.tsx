"use client";

import type { BuildingModel } from "@/lib/model/schema";
import type { FramingSet } from "@/lib/framing/types";
import type { Partition } from "@/lib/interior/partitions";
import type { ElectricalDerived } from "@/lib/electrical/derive";
import { wallFrame } from "@/lib/framing/wallFrame";
import { zoneRect } from "@/lib/model/zones";
import { leanToPolygon } from "@/lib/model/leanTos";
import { needsApron } from "@/lib/model/openings";
import { formatFtIn } from "@/lib/units";
import { FixtureLayer } from "@/components/plan/FixtureLayer";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";

export type PlanMode = "floor" | "foundation" | "roof" | "electrical";

/** Grid bubbles from the post lines: numbers along the ridge, letters across. */
export function gridLines(model: BuildingModel, framing: FramingSet): { xs: { x: number; label: string }[]; ys: { y: number; label: string }[] } {
  const ns = model.roof.ridgeAxis === "ns";
  const xs = [...new Set(framing.posts.filter((p) => !p.id.startsWith("ltpost")).map((p) => +p.x.toFixed(2)))].sort((a, b) => a - b);
  const ys = [...new Set(framing.posts.filter((p) => !p.id.startsWith("ltpost")).map((p) => +p.y.toFixed(2)))].sort((a, b) => a - b);
  const letters = (i: number) => String.fromCharCode(65 + (i % 26));
  return ns
    ? { xs: xs.map((x, i) => ({ x, label: letters(i) })), ys: ys.map((y, i) => ({ y, label: String(i + 1) })) }
    : { xs: xs.map((x, i) => ({ x, label: String(i + 1) })), ys: ys.map((y, i) => ({ y, label: letters(i) })) };
}

/** Opening tags D1…, W1… by wall (S, E, N, W) then position. */
export function openingTags(model: BuildingModel): Map<string, string> {
  const order = ["wall_ext_s", "wall_ext_e", "wall_ext_n", "wall_ext_w"];
  const sorted = [...model.openings].sort((a, b) => order.indexOf(a.wallId) - order.indexOf(b.wallId) || a.offsetFt - b.offsetFt);
  const tags = new Map<string, string>();
  let d = 0;
  let w = 0;
  for (const o of sorted) tags.set(o.id, o.type === "window" ? `W${++w}` : `D${++d}`);
  return tags;
}

/**
 * Static plan drawing for the sheets (no interaction). Mode picks what is
 * drawn: the floor plan, the foundation/post plan, the roof framing, or the
 * electrical layout — all from the same model and derived data.
 */
export function PlanSheet({ model, framing, partitions, electrical, mode, widthPx, heightPx }: { model: BuildingModel; framing: FramingSet; partitions: Partition[]; electrical: ElectricalDerived | null; mode: PlanMode; widthPx: number; heightPx: number }) {
  if (model.footprint.kind !== "rect") return null;
  const { wFt: W, dFt: D } = model.footprint;
  // Include lean-tos in the extents.
  let minX = 0;
  let minY = 0;
  let maxX = W;
  let maxY = D;
  for (const lt of model.leanTos) for (const p of leanToPolygon(model, lt)) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const margin = 66;
  const scale = Math.min((widthPx - 2 * margin) / (maxX - minX), (heightPx - 2 * margin) / (maxY - minY));
  const ox = margin + ((widthPx - 2 * margin) - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = heightPx - margin - ((heightPx - 2 * margin) - (maxY - minY) * scale) / 2 + minY * scale;
  const px = (x: number) => ox + x * scale;
  const py = (y: number) => oy - y * scale;
  const grid = gridLines(model, framing);
  const tags = openingTags(model);
  const ns = model.roof.ridgeAxis === "ns";
  const fs = Math.max(7, Math.min(11, scale * 0.7));
  const postHalf = (5.5 / 24) * scale;
  const posts = framing.posts;
  const bay = model.frame.bayFt;
  const trussSp = model.frame.trusses.spacingIn / 12;
  const ov = model.roof.overhangEaveIn / 12;
  const ovG = model.roof.overhangGableIn / 12;

  return (
    <svg width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} className="sheet-svg" data-testid={`plan-sheet-${mode}`}>
      {/* grid bubbles */}
      <g fontSize={fs} fontFamily="ui-sans-serif, system-ui" fill="#1c1b19" stroke="#1c1b19">
        {grid.xs.map((g) => (
          <g key={`gx${g.label}`}>
            <line x1={px(g.x)} y1={py(minY) + 10} x2={px(g.x)} y2={py(maxY) - 10} strokeWidth={0.5} strokeDasharray="6 4" opacity={0.5} />
            <circle cx={px(g.x)} cy={py(maxY) - 22} r={9} fill="#fff" strokeWidth={0.8} />
            <text x={px(g.x)} y={py(maxY) - 18.5} textAnchor="middle" stroke="none">
              {g.label}
            </text>
          </g>
        ))}
        {grid.ys.map((g) => (
          <g key={`gy${g.label}`}>
            <line x1={px(minX) - 10} y1={py(g.y)} x2={px(maxX) + 10} y2={py(g.y)} strokeWidth={0.5} strokeDasharray="6 4" opacity={0.5} />
            <circle cx={px(minX) - 22} cy={py(g.y)} r={9} fill="#fff" strokeWidth={0.8} />
            <text x={px(minX) - 22} y={py(g.y) + 3.5} textAnchor="middle" stroke="none">
              {g.label}
            </text>
          </g>
        ))}
      </g>

      {/* slab / aprons on the foundation and floor plans */}
      {(mode === "foundation" || mode === "floor") && model.foundation.slab.enabled ? (
        <g>
          <rect x={px(0)} y={py(D)} width={W * scale} height={D * scale} fill={mode === "foundation" ? "#eeebe4" : "#f7f5f0"} stroke="#9a9790" strokeWidth={0.6} />
          {model.foundation.slab.aprons
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
                return <polygon key={o.id} points={pts.join(" ")} fill="#eeebe4" stroke="#9a9790" strokeWidth={0.6} strokeDasharray="3 2" />;
              })
            : null}
          {model.leanTos.filter((lt) => lt.slab).map((lt) => (
            <polygon key={lt.id} points={leanToPolygon(model, lt).map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} fill="#eeebe4" stroke="#9a9790" strokeWidth={0.6} />
          ))}
        </g>
      ) : null}

      {/* lean-to outlines */}
      {model.leanTos.map((lt) => (
        <g key={lt.id}>
          <polygon points={leanToPolygon(model, lt).map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} fill="none" stroke="#4a4741" strokeWidth={1} strokeDasharray={lt.enclosed ? undefined : "6 3"} />
          {mode === "roof" ? <text x={px((leanToPolygon(model, lt)[0].x + leanToPolygon(model, lt)[2].x) / 2)} y={py((leanToPolygon(model, lt)[0].y + leanToPolygon(model, lt)[2].y) / 2)} textAnchor="middle" fontSize={fs} fill="#4a4741">{`lean-to ${lt.pitch}:12`}</text> : null}
        </g>
      ))}

      {/* zones + partitions + interior doors on the floor plan */}
      {mode === "floor" || mode === "electrical"
        ? model.zones.map((z) => {
            const r = zoneRect(z);
            return (
              <g key={z.id}>
                <rect x={px(r.x)} y={py(r.y + r.d)} width={r.w * scale} height={r.d * scale} fill={mode === "floor" ? (z.type === "aisle" ? "#faf8f3" : "#f1ede4") : "none"} stroke="#7a756c" strokeWidth={0.5} strokeDasharray={z.type === "aisle" ? "4 3" : undefined} />
                {mode === "floor" && r.w * scale > 40 ? (
                  <>
                    <text x={px(r.x + r.w / 2)} y={py(r.y + r.d / 2) - 2} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#1c1b19">
                      {z.name}
                    </text>
                    <text x={px(r.x + r.w / 2)} y={py(r.y + r.d / 2) + fs} textAnchor="middle" fontSize={fs - 1} fill="#4a4741" fontFamily="ui-monospace, monospace">
                      {formatFtIn(r.w)} × {formatFtIn(r.d)}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })
        : null}
      {mode === "floor"
        ? partitions.map((p) => (
            <g key={p.id}>
              <line x1={px(p.x0)} y1={py(p.y0)} x2={px(p.x1)} y2={py(p.y1)} stroke="#2b2925" strokeWidth={p.kind === "full" ? Math.max(1.5, 0.375 * scale) : Math.max(1, 0.125 * scale)} />
              {p.doors.map((d) => {
                const vertical = Math.abs(p.x1 - p.x0) < 1e-9;
                const n = -d.zoneSide;
                const off = 0.35;
                return (
                  <g key={d.id}>
                    <line x1={px(d.x0)} y1={py(d.y0)} x2={px(d.x1)} y2={py(d.y1)} stroke="#fff" strokeWidth={Math.max(2, 0.4 * scale)} />
                    {INTERIOR_DOOR_PRESETS[d.type].leaf !== "none" ? <line x1={px(d.x0 + (vertical ? n * off : 0))} y1={py(d.y0 + (vertical ? 0 : n * off))} x2={px(d.x1 + (vertical ? n * off : 0))} y2={py(d.y1 + (vertical ? 0 : n * off))} stroke="#1c1b19" strokeWidth={1.2} /> : null}
                    <text x={px((d.x0 + d.x1) / 2 + (vertical ? n * 1.2 : 0))} y={py((d.y0 + d.y1) / 2 + (vertical ? 0 : n * 1.2)) + 3} textAnchor="middle" fontSize={fs - 2} fill="#1c1b19">
                      {formatFtIn(d.widthFt)} {d.type === "stallSlide" ? "sl" : d.type === "cased" ? "open" : "hng"}
                    </text>
                  </g>
                );
              })}
            </g>
          ))
        : null}

      {/* exterior walls */}
      {model.walls
        .filter((w) => w.role === "exterior")
        .map((w) => {
          const f = wallFrame(w);
          const spans = model.openings.filter((o) => o.wallId === w.id).sort((a, b) => a.offsetFt - b.offsetFt);
          const segs: [number, number][] = [];
          let c = 0;
          for (const o of spans) {
            if (o.offsetFt > c) segs.push([c, o.offsetFt]);
            c = o.offsetFt + o.widthFt;
          }
          if (c < f.lengthFt) segs.push([c, f.lengthFt]);
          const t = 0.5;
          const pt = (u: number) => ({ x: px(w.start.x + f.dir.x * u - f.normal.x * t / 2), y: py(w.start.y + f.dir.y * u - f.normal.y * t / 2) });
          return (
            <g key={w.id}>
              {(mode === "roof" ? [[0, f.lengthFt] as [number, number]] : segs).map(([a, b], i) => (
                <line key={i} x1={pt(a).x} y1={pt(a).y} x2={pt(b).x} y2={pt(b).y} stroke="#1c1b19" strokeWidth={Math.max(2, t * scale)} />
              ))}
              {mode !== "roof"
                ? spans.map((o) => {
                    const mid = o.offsetFt + o.widthFt / 2;
                    const lp = { x: px(w.start.x + f.dir.x * mid + f.normal.x * 1.6), y: py(w.start.y + f.dir.y * mid + f.normal.y * 1.6) };
                    return (
                      <g key={o.id}>
                        <line x1={pt(o.offsetFt).x} y1={pt(o.offsetFt).y} x2={pt(o.offsetFt + o.widthFt).x} y2={pt(o.offsetFt + o.widthFt).y} stroke={o.type === "window" ? "#1c1b19" : "#fff"} strokeWidth={o.type === "window" ? 1 : Math.max(2, t * scale)} />
                        <rect x={lp.x - 10} y={lp.y - 6.5} width={20} height={13} rx={2} fill="#fff" stroke="#1c1b19" strokeWidth={0.6} />
                        <text x={lp.x} y={lp.y + 3.5} textAnchor="middle" fontSize={fs - 1} fontWeight={600} fill="#1c1b19">
                          {tags.get(o.id)}
                        </text>
                      </g>
                    );
                  })
                : null}
            </g>
          );
        })}

      {/* posts */}
      {mode !== "roof"
        ? posts.map((p) => (
            <rect key={p.id} x={px(p.x) - postHalf} y={py(p.y) - postHalf} width={postHalf * 2} height={postHalf * 2} fill={mode === "foundation" ? "#1c1b19" : "#3a3835"} />
          ))
        : null}
      {mode === "foundation"
        ? posts
            .filter((p) => p.holeDepthIn > 0)
            .map((p) => <circle key={`h${p.id}`} cx={px(p.x)} cy={py(p.y)} r={(p.holeDiaIn / 24) * scale} fill="none" stroke="#1c1b19" strokeWidth={0.6} strokeDasharray="2 2" />)
        : null}

      {/* roof framing: trusses and purlins */}
      {mode === "roof" && framing.trussSpec
        ? (() => {
            const along = ns ? D : W;
            const count = framing.trussSpec.count;
            const lines: React.ReactNode[] = [];
            for (let i = 0; i < count; i++) {
              const a = Math.min(along, i * trussSp);
              const pos = i === count - 1 ? along : a;
              lines.push(ns ? <line key={`t${i}`} x1={px(-ov)} y1={py(pos)} x2={px(W + ov)} y2={py(pos)} stroke="#1c1b19" strokeWidth={1.5} /> : <line key={`t${i}`} x1={px(pos)} y1={py(-ov)} x2={px(pos)} y2={py(D + ov)} stroke="#1c1b19" strokeWidth={1.5} />);
            }
            const purlinSp = model.frame.purlins.spacingIn / 12;
            const span = ns ? W : D;
            const half = span / 2;
            for (let s = purlinSp / 2; s < half + ov; s += purlinSp) {
              for (const side of [-1, 1]) {
                const c = half + side * s;
                if (c < -ov || c > span + ov) continue;
                lines.push(ns ? <line key={`p${side}${s}`} x1={px(c)} y1={py(-ovG)} x2={px(c)} y2={py(D + ovG)} stroke="#7a756c" strokeWidth={0.5} /> : <line key={`p${side}${s}`} x1={px(-ovG)} y1={py(c)} x2={px(W + ovG)} y2={py(c)} stroke="#7a756c" strokeWidth={0.5} />);
              }
            }
            lines.push(ns ? <line key="ridge" x1={px(W / 2)} y1={py(-ovG)} x2={px(W / 2)} y2={py(D + ovG)} stroke="#1c1b19" strokeWidth={1} strokeDasharray="8 4" /> : <line key="ridge" x1={px(-ovG)} y1={py(D / 2)} x2={px(W + ovG)} y2={py(D / 2)} stroke="#1c1b19" strokeWidth={1} strokeDasharray="8 4" />);
            lines.push(<rect key="ov" x={px(ns ? -ov : -ovG)} y={py(ns ? D + ovG : D + ov)} width={(W + 2 * (ns ? ov : ovG)) * scale} height={(D + 2 * (ns ? ovG : ov)) * scale} fill="none" stroke="#7a756c" strokeWidth={0.6} strokeDasharray="3 3" />);
            return <g>{lines}</g>;
          })()
        : null}

      {/* electrical */}
      {mode === "electrical" && electrical ? (
        <FixtureLayer fixtures={model.electrical.fixtures} derived={electrical} px={px} py={py} scale={scale} selection={null} hovered={null} onPointerDown={() => {}} onContextMenu={() => {}} onHover={() => {}} showRoutes />
      ) : null}
      {mode === "electrical" && electrical
        ? electrical.routes.map((r) => {
            const c = electrical.circuits.find((x) => x.id === r.circuitId);
            const last = r.points[r.points.length - 1];
            return last ? (
              <text key={r.circuitId} x={px(last.x) + 8} y={py(last.y) - 6} fontSize={fs - 1} fontWeight={600} fill="#1c1b19">
                {c?.label}
              </text>
            ) : null;
          })
        : null}

      {/* dimensions */}
      <g stroke="#1c1b19" strokeWidth={0.6} fontSize={fs} fontFamily="ui-monospace, monospace" fill="#1c1b19">
        <line x1={px(0)} y1={py(minY) + 52} x2={px(W)} y2={py(minY) + 52} />
        <line x1={px(0)} y1={py(minY) + 46} x2={px(0)} y2={py(minY) + 58} />
        <line x1={px(W)} y1={py(minY) + 46} x2={px(W)} y2={py(minY) + 58} />
        <text x={px(W / 2)} y={py(minY) + 49} textAnchor="middle" stroke="none">
          {formatFtIn(W)}
        </text>
        <line x1={px(maxX) + 52} y1={py(0)} x2={px(maxX) + 52} y2={py(D)} />
        <line x1={px(maxX) + 46} y1={py(0)} x2={px(maxX) + 58} y2={py(0)} />
        <line x1={px(maxX) + 46} y1={py(D)} x2={px(maxX) + 58} y2={py(D)} />
        <text x={px(maxX) + 60} y={py(D / 2) + 3} stroke="none" transform={`rotate(-90 ${px(maxX) + 60} ${py(D / 2) + 3})`} textAnchor="middle">
          {formatFtIn(D)}
        </text>
        {/* bay dims along the bearing walls */}
        {(ns ? grid.ys.map((g) => g.y) : grid.xs.map((g) => g.x)).slice(0, -1).map((v, i, arr) => {
          const next = (ns ? grid.ys.map((g) => g.y) : grid.xs.map((g) => g.x))[i + 1];
          void arr;
          return ns ? (
            <text key={`b${i}`} x={px(maxX) + 38} y={py((v + next) / 2) + 3} stroke="none" fontSize={fs - 2} textAnchor="middle" transform={`rotate(-90 ${px(maxX) + 38} ${py((v + next) / 2) + 3})`}>
              {formatFtIn(next - v)}
            </text>
          ) : (
            <text key={`b${i}`} x={px((v + next) / 2)} y={py(minY) + 38} stroke="none" fontSize={fs - 2} textAnchor="middle">
              {formatFtIn(next - v)}
            </text>
          );
        })}
      </g>
      {/* north arrow */}
      <g transform={`translate(${widthPx - 26}, 30) rotate(${-model.site.orientationDeg})`} fill="#1c1b19">
        <polygon points="0,-12 5,5 0,2 -5,5" />
        <text y={17} textAnchor="middle" fontSize={9}>
          N
        </text>
      </g>
      <text x={8} y={heightPx - 8} fontSize={8} fill="#6f6a62">
        1 square = {bay}&apos; post spacing · ridge runs {ns ? "north–south" : "east–west"} · scale 1&quot; ≈ {formatFtIn(96 / scale)}
      </text>
    </svg>
  );
}
