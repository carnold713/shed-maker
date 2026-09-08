"use client";

import type { BuildingModel } from "@/lib/model/schema";
import type { FramingMember, FramingSet } from "@/lib/framing/types";
import { wallFrame } from "@/lib/framing/wallFrame";
import { formatFtIn } from "@/lib/units";
import { openingTags } from "./PlanSheet";

const SIDE = { s: "South", e: "East", n: "North", w: "West" } as const;
const FILL: Partial<Record<FramingMember["kind"], string>> = { post: "#3a3835", carrier: "#8a6b3f", girt: "#c9b48c", skirt: "#7a5a2e", header: "#8a6b3f", jamb: "#b59a6a", plate: "#8a6b3f", stud: "#c9b48c", kneeBrace: "#a8894f" };

/** One wall's framing seen from outside: posts, skirt, girts, carrier, headers, jambs, openings with tags. */
export function WallElevation({ model, framing, wallId, widthPx, heightPx }: { model: BuildingModel; framing: FramingSet; wallId: string; widthPx: number; heightPx: number }) {
  const wall = model.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const f = wallFrame(wall);
  const H = wall.heightFt;
  const embed = model.frame.post.foundation === "embedded" ? model.frame.post.embedIn / 12 : 0;
  const margin = 40;
  const right = 92; // room for the eave / floor labels
  const scale = Math.min((widthPx - margin - right) / f.lengthFt, (heightPx - 2 * margin) / (H + embed + 1));
  const ox = margin + ((widthPx - margin - right) - f.lengthFt * scale) / 2;
  const oy = heightPx - margin - ((heightPx - 2 * margin) - (H + embed + 1) * scale) / 2 - embed * scale;
  const px = (u: number) => ox + u * scale;
  const py = (h: number) => oy - h * scale;
  const tags = openingTags(model);
  // Members that belong to this wall, in wall-local (u, h).
  const members = framing.members
    .filter((m) => m.entityId === wallId && m.kind !== "footing" && m.kind !== "kneeBrace")
    .map((m) => {
      const cx = m.center[0];
      const cy = m.center[2] * -1; // plan y
      const u = (cx - wall.start.x) * f.dir.x + (cy - wall.start.y) * f.dir.y;
      const h = m.center[1];
      const along = m.kind === "post" || m.kind === "jamb" || m.kind === "stud" ? m.size[0] : m.size[0];
      const tall = m.size[1];
      return { m, u, h, along, tall };
    });
  const order: FramingMember["kind"][] = ["skirt", "girt", "carrier", "plate", "header", "jamb", "stud", "post"];
  members.sort((a, b) => order.indexOf(a.m.kind) - order.indexOf(b.m.kind));
  const fs = 9;
  const girtRows = [...new Set(members.filter((x) => x.m.kind === "girt").map((x) => +x.h.toFixed(3)))].sort((a, b) => a - b);

  return (
    <svg width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} className="sheet-svg" data-testid={`elevation-${wall.side}`}>
      <text x={8} y={14} fontSize={11} fontWeight={600} fill="#1c1b19">
        {SIDE[wall.side ?? "s"]} wall · {formatFtIn(f.lengthFt)} long · {formatFtIn(H)} to the eave
      </text>
      {/* grade and floor lines */}
      <line x1={px(0) - 10} y1={py(0)} x2={px(f.lengthFt) + 10} y2={py(0)} stroke="#1c1b19" strokeWidth={0.8} />
      <text x={px(f.lengthFt) + 12} y={py(0) + 3} fontSize={fs - 1} fill="#4a4741">
        floor 0
      </text>
      {embed ? (
        <>
          <line x1={px(0) - 10} y1={py(-embed)} x2={px(f.lengthFt) + 10} y2={py(-embed)} stroke="#9a9790" strokeWidth={0.6} strokeDasharray="4 3" />
          <text x={px(f.lengthFt) + 12} y={py(-embed) + 3} fontSize={fs - 1} fill="#4a4741">
            post bottom −{formatFtIn(embed)}
          </text>
        </>
      ) : null}
      <line x1={px(0) - 10} y1={py(H)} x2={px(f.lengthFt) + 10} y2={py(H)} stroke="#9a9790" strokeWidth={0.6} strokeDasharray="4 3" />
      <text x={px(f.lengthFt) + 12} y={py(H) + 3} fontSize={fs - 1} fill="#4a4741">
        eave {formatFtIn(H)}
      </text>
      {/* openings as white boxes with tags */}
      {model.openings
        .filter((o) => o.wallId === wallId)
        .map((o) => (
          <g key={o.id}>
            <rect x={px(o.offsetFt)} y={py(o.sillFt + o.heightFt)} width={o.widthFt * scale} height={o.heightFt * scale} fill="#fff" stroke="#1c1b19" strokeWidth={0.8} />
            <text x={px(o.offsetFt + o.widthFt / 2)} y={py(o.sillFt + o.heightFt / 2) + 3} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#1c1b19">
              {tags.get(o.id)} · {formatFtIn(o.widthFt)} × {formatFtIn(o.heightFt)}
            </text>
          </g>
        ))}
      {/* members */}
      {members.map(({ m, u, h, along, tall }) => (
        <rect key={m.id} x={px(u - along / 2)} y={py(h + tall / 2)} width={Math.max(1, along * scale)} height={Math.max(1, tall * scale)} fill={FILL[m.kind] ?? "#c9b48c"} stroke="#1c1b19" strokeWidth={0.3} opacity={m.kind === "header" || m.kind === "jamb" ? 0.9 : 1}>
          <title>{`${m.kind} ${m.nominal} ${formatFtIn(m.lengthFt)}`}</title>
        </rect>
      ))}
      {/* girt row heights */}
      {girtRows
        .filter((h, i, arr) => i === 0 || py(arr[i - 1]) - py(h) >= 9)
        .map((h, i) => (
          <text key={i} x={px(0) - 4} y={py(h) + 3} textAnchor="end" fontSize={fs - 2} fill="#4a4741" fontFamily="ui-monospace, monospace">
            {formatFtIn(h)}
          </text>
        ))}
      {/* post positions along the bottom (skip labels that would overlap) */}
      {members
        .filter((x) => x.m.kind === "post")
        .sort((a, b) => a.u - b.u)
        .filter((x, i, arr) => i === 0 || px(x.u) - px(arr[i - 1].u) >= 34)
        .map(({ m, u }) => (
          <text key={`pu${m.id}`} x={px(u)} y={py(-embed) + 12} textAnchor="middle" fontSize={fs - 2} fill="#4a4741" fontFamily="ui-monospace, monospace">
            {formatFtIn(u)}
          </text>
        ))}
    </svg>
  );
}
