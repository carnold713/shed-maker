"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { BuildingModel } from "@/lib/model/schema";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";
import { derivePartitions, interiorDoors } from "@/lib/interior/partitions";
import { deriveElectrical } from "@/lib/electrical/derive";
import { estimateMaterials, formatUsd } from "@/lib/bom/estimate";
import { cutList } from "@/lib/bom/cutlist";
import { hardwareSchedule } from "@/lib/bom/hardware";
import { buildSequence } from "@/lib/bom/sequence";
import { quickQuantities } from "@/lib/bom/quick";
import { runRules } from "@/rules";
import { zoneRect, ZONE_TYPE_LABEL } from "@/lib/model/zones";
import { OPENING_PRESETS } from "@/lib/model/openings";
import { INTERIOR_DOOR_PRESETS } from "@/lib/model/interiorDoors";
import { FIXTURE_PRESETS } from "@/lib/model/electrical";
import { SPECIES_PRESETS } from "@/rules/animals/presets";
import { formatFtIn } from "@/lib/units";
import { TREATMENT_LABEL } from "@/rules/materials/lumber";
import { Sheet, Table, Notes, KeyValue } from "./sheets";
import { PlanSheet, gridLines, openingTags } from "./PlanSheet";
import { WallElevation } from "./WallElevations";
import { Icon } from "@/components/ui/Icon";

const SIDE = { s: "South", e: "East", n: "North", w: "West" } as const;
const SW = 1000; // drawing width, px
const SH = 560;

/** The blueprint pack: printable sheets derived from the model (SPEC §9, ADR-0015). */
export function PackView({ projectId, model }: { projectId: string; model: BuildingModel }) {
  const d = useMemo(() => {
    const framing = deriveFraming(model);
    const geometry = deriveGeometry(model);
    const partitions = derivePartitions(model);
    const electrical = model.electrical.fixtures.length ? deriveElectrical(model) : null;
    return {
      framing,
      geometry,
      partitions,
      electrical,
      estimate: estimateMaterials(model, framing, geometry),
      cuts: cutList(model, framing),
      hardware: hardwareSchedule(model, framing, geometry),
      sequence: buildSequence(model, framing),
      quick: quickQuantities(model, framing, geometry),
      report: runRules(model),
      tags: openingTags(model),
      grid: gridLines(model, framing),
      doors: interiorDoors(model),
    };
  }, [model]);
  if (model.footprint.kind !== "rect") return null;
  const { wFt: W, dFt: D } = model.footprint;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const name = model.meta.name;
  const walls = model.walls.filter((w) => w.role === "exterior");
  const sheets = ["G0", "A1", "S1", "S2", "S3", ...(d.electrical ? ["E1"] : []), "A2", "M1", "M2", "M3", "M4"];
  const total = sheets.length;
  const n = (code: string) => sheets.indexOf(code) + 1;
  const stalls = model.zones.filter((z) => z.type === "pen");
  const gridLabel = (x: number, y: number) => {
    const gx = d.grid.xs.reduce((best, g) => (Math.abs(g.x - x) < Math.abs(best.x - x) ? g : best), d.grid.xs[0]);
    const gy = d.grid.ys.reduce((best, g) => (Math.abs(g.y - y) < Math.abs(best.y - y) ? g : best), d.grid.ys[0]);
    return model.roof.ridgeAxis === "ns" ? `${gx?.label ?? "?"}${gy?.label ?? "?"}` : `${gy?.label ?? "?"}${gx?.label ?? "?"}`;
  };

  return (
    <div className="pack" data-testid="pack">
      <div className="pack-toolbar print:hidden">
        <Link href={`/p/${projectId}`} className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <Icon name="back" size={16} /> Back to the editor
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{total} sheets · Letter landscape · use your browser&apos;s &ldquo;Save as PDF&rdquo;</span>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_6px_16px_-8px_rgba(238,125,43,0.8)] hover:brightness-105" data-testid="print-pack">
            <Icon name="print" size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* G0 cover */}
      <Sheet n={n("G0")} total={total} code="G0" title="Cover & index" project={name} date={date}>
        <div className="grid grid-cols-[1.3fr_1fr] gap-6">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {formatFtIn(W)} × {formatFtIn(D)} {model.frame.system === "postFrame" ? "pole barn" : "stick-framed barn"} · {(W * D).toLocaleString()} sq ft · {formatFtIn(model.eaveHeightFt)} walls · {model.roof.form === "gable" ? "gable" : "single-slope"} roof {model.roof.pitch}:12
            </p>
            {model.meta.notes ? <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed">{model.meta.notes}</p> : null}
            <div className="mt-4">
              <PlanSheet model={model} framing={d.framing} partitions={d.partitions} electrical={null} mode="floor" widthPx={560} heightPx={330} />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <KeyValue
              items={[
                ["Stalls", stalls.length ? `${stalls.length} · ${[...new Set(stalls.map((z) => SPECIES_PRESETS[z.species ?? "generic"].label))].join(", ")}` : "none"],
                ["Rooms", model.zones.filter((z) => z.type !== "pen" && z.type !== "aisle" && z.type !== "kidding").map((z) => z.name).join(", ") || "none"],
                ["Doors / windows", `${model.openings.filter((o) => o.type !== "window").length} / ${model.openings.filter((o) => o.type === "window").length}`],
                ["Lean-tos", model.leanTos.map((lt) => `${SIDE[lt.side]} ${lt.depthFt}'`).join(", ") || "none"],
                ["Frame", model.frame.system === "postFrame" ? `${model.frame.post.size.replace("x", "×")} posts every ${model.frame.bayFt}', trusses every ${model.frame.trusses.spacingIn / 12}'` : `${model.frame.studs.size.replace("x", "×")} studs at ${model.frame.studs.spacingIn}"`],
                ["Concrete", model.foundation.slab.enabled ? `${model.foundation.slab.thicknessIn}" slab${model.foundation.slab.aprons ? " with aprons" : ""}` : "none"],
                ["Electrical", d.electrical ? `${d.electrical.load.serviceAmps} A panel · ${d.electrical.circuits.length} circuits · ${model.electrical.fixtures.length} devices` : "not planned"],
                ["Materials estimate", `${formatUsd(d.estimate.total)} (${formatUsd(d.estimate.low)}–${formatUsd(d.estimate.high)}), placeholder prices`],
                ["Frost depth", `${model.site.frostDepthIn ?? "?"}" ${model.site.verified.frost ? "verified" : "NOT verified"}`],
                ["Checks", d.report.errors ? `${d.report.errors} must-fix, ${d.report.warnings} warnings` : d.report.warnings ? `${d.report.warnings} warnings` : "all clear"],
              ]}
            />
            <Table head={["Sheet", "Title"]} rows={[["G0", "Cover & index"], ["A1", "Floor plan"], ["S1", "Foundation & post plan"], ["S2", "Wall framing elevations"], ["S3", "Roof framing plan"], ...(d.electrical ? [["E1", "Electrical plan & panel schedule"]] : []), ["A2", "Door, window & room schedules"], ["M1", "Materials & cost estimate"], ["M2", "Cut list"], ["M3", "Hardware schedule"], ["M4", "Build sequence"]]} />
            <p className="text-[10px] leading-relaxed text-muted">These drawings are a planning and communication aid generated from a model. Framing is prescriptive post-frame practice; loads, foundations and the electrical design must be confirmed by a licensed professional and your building department before construction.</p>
          </div>
        </div>
      </Sheet>

      {/* A1 floor plan */}
      <Sheet n={n("A1")} total={total} code="A1" title="Floor plan" project={name} date={date}>
        <PlanSheet model={model} framing={d.framing} partitions={d.partitions} electrical={null} mode="floor" widthPx={SW} heightPx={SH} />
        <Notes items={["Wall lines are the outside face of the girts. Grid bubbles mark post lines; dimensions are to post centres.", "D/W tags refer to the schedules on A2. Stall doors: sl = sliding, hng = hinged.", `${stalls.length ? `Stalls ${stalls.map((z) => `${z.name} ${formatFtIn(zoneRect(z).w)} × ${formatFtIn(zoneRect(z).d)}`).join("; ")}.` : "No stalls drawn."}`, "Partitions: 2×6 tongue-and-groove kick-wall to the height in the interior schedule, grille above."]} />
      </Sheet>

      {/* S1 foundation */}
      <Sheet n={n("S1")} total={total} code="S1" title="Foundation & post plan" project={name} date={date}>
        <div className="grid grid-cols-[1.45fr_1fr] gap-4">
          <PlanSheet model={model} framing={d.framing} partitions={d.partitions} electrical={null} mode="foundation" widthPx={620} heightPx={SH} />
          <div className="flex flex-col gap-3">
            <Table
              testId="post-schedule"
              head={["Post", "Grid", "Size", "Length", "Hole", "Concrete"]}
              rows={d.framing.posts.map((p) => [p.id.replace(/^post_wall_ext_/, "").replace(/^ltpost_/, "lt-"), gridLabel(p.x, p.y), p.nominal.replace("x", "×"), `${p.lengthFt}'`, p.holeDepthIn ? `${p.holeDiaIn}" × ${p.holeDepthIn}"` : "bracket", p.concreteCuFt ? `${p.concreteCuFt.toFixed(1)} cu ft` : "—"])}
            />
            <Notes items={[model.frame.post.foundation === "embedded" ? `Posts set ${model.frame.post.embedIn}" deep on a ${model.frame.post.padDiaIn}" concrete pad, with two PT 2×6 uplift blocks and two #4 rebar pins per post; collar per the schedule. Frost depth ${model.site.frostDepthIn ?? "?"}" (${model.site.verified.frost ? "verified" : "verify with the building department"}).` : "Posts on brackets wet-set in piers below frost depth.", model.foundation.slab.enabled ? `${model.foundation.slab.thicknessIn}" slab on ${model.foundation.slab.gravelBaseIn}" compacted gravel, ${model.foundation.slab.reinforcement === "none" ? "unreinforced" : "with mesh / fibre"}, top ${model.foundation.slab.aboveGradeIn}" above grade, control joints at 12'. Pour after the shell is up; ½" isolation at every post.` : "No slab: compacted gravel floor.", "Diagonals equal within ¼\" before any hole is dug. Strings on the outside girt face.", "Equipotential bonding of the slab mesh under livestock areas where electrical is installed (NEC 547.10)."]} />
          </div>
        </div>
      </Sheet>

      {/* S2 wall elevations */}
      <Sheet n={n("S2")} total={total} code="S2" title="Wall framing elevations" project={name} date={date}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {walls.map((w) => (
            <WallElevation key={w.id} model={model} framing={d.framing} wallId={w.id} widthPx={490} heightPx={250} />
          ))}
        </div>
        <Notes items={[model.frame.system === "postFrame" ? `Girts ${model.frame.girts.size.replace("x", "×")} ${model.frame.girts.mount === "face" ? "on the outside face of the posts" : "bookshelf between posts"} every ${model.frame.girts.spacingIn}"; skirt ${model.frame.skirt.size.replace("x", "×")} PT; truss carrier ${model.frame.carrier.plies}-ply ${model.frame.carrier.size.replace("x", "×")} in a 1½" notch on the inside face of every bearing post, two ½" × 8" carriage bolts per post.` : "Stud walls per the framing schedule; double top plate; headers per opening.", "Headers over openings ≥ 8' between jamb posts; smaller openings framed between girts with 2×6 jambs.", "Corner and end-wall bracing: 2×6 X-brace in each corner bay.", "Heights are from the finished floor (0)."]} />
      </Sheet>

      {/* S3 roof */}
      <Sheet n={n("S3")} total={total} code="S3" title="Roof framing plan" project={name} date={date}>
        <div className="grid grid-cols-[1.45fr_1fr] gap-4">
          <PlanSheet model={model} framing={d.framing} partitions={d.partitions} electrical={null} mode="roof" widthPx={620} heightPx={SH} />
          <div className="flex flex-col gap-3">
            {d.framing.trussSpec ? (
              <KeyValue
                items={[
                  ["Trusses", `${d.framing.trussSpec.count} × ${d.framing.trussSpec.type}`],
                  ["Span", formatFtIn(d.framing.trussSpec.spanFt)],
                  ["Pitch", `${d.framing.trussSpec.pitch}:12`],
                  ["Heel", `${d.framing.trussSpec.heelIn}"`],
                  ["Spacing", `${d.framing.trussSpec.spacingIn}" on centre`],
                  ["Overhang", `${d.framing.trussSpec.overhangIn}" eave · ${model.roof.overhangGableIn}" gable`],
                  ["Bearing", `${d.framing.trussSpec.bearingWalls.map((w) => SIDE[(w.replace("wall_ext_", "") as keyof typeof SIDE)]).join(" and ")} walls`],
                  ["Purlins", `2×4 on edge every ${model.frame.purlins.spacingIn}", lapped 12" past each truss`],
                  ["Snow / wind", `${model.site.groundSnowPsf ?? "?"} psf ground snow${model.site.verified.snow ? "" : " (verify)"} · ${model.site.windMph ?? "?"} mph`],
                  ["Knee braces", d.framing.members.some((m) => m.kind === "kneeBrace") ? `2×6 at 45° at every bearing post (${d.framing.members.filter((m) => m.kind === "kneeBrace").length})` : "not required"],
                ]}
              />
            ) : null}
            <Notes title="Truss order" items={["Order from a truss plant with this span, pitch, heel, spacing, the snow load, and the knee-brace reaction. Never field-cut a truss.", "Gable truss first, ground-braced; then 48\" on centre with 2×4 spacer blocks, three 16d toe-nails and one H2.5A tie at each bearing.", "Permanent web and bottom-chord bracing per the truss drawings (BCSI).", `Roof steel: 29 ga panels, screws ${5} per panel per purlin row; ridge cap over closures.`]} />
          </div>
        </div>
      </Sheet>

      {/* E1 electrical */}
      {d.electrical ? (
        <Sheet n={n("E1")} total={total} code="E1" title="Electrical plan & panel schedule" project={name} date={date}>
          <div className="grid grid-cols-[1.45fr_1fr] gap-4">
            <PlanSheet model={model} framing={d.framing} partitions={d.partitions} electrical={d.electrical} mode="electrical" widthPx={620} heightPx={SH} />
            <div className="flex flex-col gap-3">
              <KeyValue
                items={[
                  ["Service", `${d.electrical.load.serviceAmps} A, 120/240 V, from the ${model.electrical.service.feedFrom === "meter" ? "meter" : "house panel"} · ${model.electrical.service.feederLengthFt}' feeder ${d.electrical.load.feederAwg} Cu (${d.electrical.load.feederAlAwg} Al) in PVC, ${d.electrical.load.feederDropPct}% drop`],
                  ["Demand", `${d.electrical.load.demandVa.toLocaleString()} VA · ${d.electrical.load.demandAmps} A (${d.electrical.load.utilisationPct}% of the panel)`],
                  ["Panel", `${d.electrical.load.panelSpaces}-space main-breaker sub-panel, ${d.electrical.load.breakerSpaces} spaces used${d.electrical.panel.placed ? "" : " — location to be chosen"}`],
                  ["Wiring", `${model.electrical.wiring === "pvcConduit" ? "UF-B in ¾\" PVC conduit" : model.electrical.wiring === "ufCable" ? "UF-B cable" : "Jacketed MC"} along the girts at ${formatFtIn(d.electrical.routeHeightFt)}, across the truss chords; PVC boxes`],
                ]}
              />
              <Table testId="panel-schedule" head={["Ckt", "Serves", "Breaker", "Wire", "Run", "Drop"]} rows={d.electrical.circuits.map((c) => [c.label, `${c.fixtureIds.length} ${c.kind === "lighting" ? "light" : c.kind === "receptacle" ? "outlet" : c.kind === "fan" ? "fan" : c.kind === "waterer" ? "waterer" : "heater"}${c.fixtureIds.length > 1 ? "s" : ""}${c.gfci ? " GFCI" : ""}`, `${c.breakerAmps} A${c.poles === 2 ? " 2P" : ""}`, `${c.wireAwg} AWG`, `${Math.round(c.runFt)}'`, `${c.voltageDropPct}%`])} />
              <Notes items={["All 120 V receptacles GFCI-protected; weather-resistant devices in PVC boxes with in-use covers (NEC 547.5(G), 2023: 547.28).", "Luminaires in stalls vapor-tight with a guard, 8' or higher (NEC 547.8). Nothing an animal can reach.", "Bond the slab mesh, stall fronts and waterers as an equipotential plane (NEC 547.10). Two ground rods at the panel.", "Planning drawing: a licensed electrician sizes and installs the final circuits; inspection before covering."]} />
            </div>
          </div>
        </Sheet>
      ) : null}

      {/* A2 schedules */}
      <Sheet n={n("A2")} total={total} code="A2" title="Door, window & room schedules" project={name} date={date}>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Table
              testId="opening-schedule"
              head={["Tag", "Type", "Size", "Rough opening", "Wall", "From corner", "Opens"]}
              rows={[...model.openings].sort((a, b) => (d.tags.get(a.id) ?? "").localeCompare(d.tags.get(b.id) ?? "", undefined, { numeric: true })).map((o) => [d.tags.get(o.id), OPENING_PRESETS[o.type].label, `${formatFtIn(o.widthFt)} × ${formatFtIn(o.heightFt)}`, `${formatFtIn(o.widthFt + 1 / 12)} × ${formatFtIn(o.heightFt + 0.5 / 12)}`, SIDE[model.walls.find((w) => w.id === o.wallId)?.side ?? "s"], formatFtIn(o.offsetFt), o.type === "window" ? `sill ${formatFtIn(o.sillFt)}` : o.swing])}
            />
            {d.doors.length ? <Table testId="interior-door-schedule" head={["Room / stall", "Door", "Size", "Hardware"]} rows={d.doors.map(({ door }) => [model.zones.find((z) => z.id === door.zoneId)?.name ?? "", INTERIOR_DOOR_PRESETS[door.type].label, `${formatFtIn(door.widthFt)} × ${formatFtIn(door.heightFt)}`, INTERIOR_DOOR_PRESETS[door.type].hardware.map((h) => `${h.qty > 1 ? `${h.qty}× ` : ""}${h.label}`).join(", ") || "—"])} /> : null}
          </div>
          <div className="flex flex-col gap-3">
            <Table
              testId="room-schedule"
              head={["Name", "Kind", "Size", "Area", "Floor", "Partition"]}
              rows={model.zones.map((z) => {
                const r = zoneRect(z);
                const sp = z.species ? SPECIES_PRESETS[z.species] : null;
                return [z.name, ZONE_TYPE_LABEL[z.type], `${formatFtIn(r.w)} × ${formatFtIn(r.d)}`, `${Math.round(r.w * r.d)} sq ft`, { concrete: "Concrete", concreteMats: "Concrete + mats", gravel: "Gravel", dirt: "Dirt", wood: "Wood" }[z.flooring], sp ? `${sp.kickWallFt}' kick-wall, grille to ${sp.partitionTopFt}'` : z.type === "aisle" ? "—" : "full-height stud wall"];
              })}
            />
            {d.electrical ? <Table testId="fixture-schedule" head={["Device", "Count", "Load", "Mount"]} rows={Object.entries(model.electrical.fixtures.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), {} as Record<string, number>)).map(([k, c]) => [FIXTURE_PRESETS[k as keyof typeof FIXTURE_PRESETS].label, c, `${FIXTURE_PRESETS[k as keyof typeof FIXTURE_PRESETS].watts} W`, `${FIXTURE_PRESETS[k as keyof typeof FIXTURE_PRESETS].mountFt}'`])} /> : null}
          </div>
        </div>
      </Sheet>

      {/* M1 materials & cost */}
      <Sheet n={n("M1")} total={total} code="M1" title="Materials & cost estimate" project={name} date={date}>
        <div className="grid grid-cols-[1.6fr_1fr] gap-4">
          <Table testId="materials-table" head={["Item", "Quantity", "Unit price", "Cost"]} rows={d.estimate.lines.map((l) => [l.description, `${l.quantity.toLocaleString()} ${l.unit}`, formatUsd(l.unitCost), formatUsd(l.cost)])} className="compact" />
          <div className="flex flex-col gap-3">
            <KeyValue items={[["Materials total", formatUsd(d.estimate.total)], ["Likely range", `${formatUsd(d.estimate.low)} – ${formatUsd(d.estimate.high)}`], ...d.estimate.byCategory.map((c) => [c.label, formatUsd(c.cost)] as [string, string])]} />
            <KeyValue items={[["Posts", String(d.quick.posts)], ["Trusses", String(d.quick.trussCount)], ["Lumber", `${d.quick.boardFeet.toLocaleString()} board feet`], ["Roof steel", `${d.quick.roofSqFt.toLocaleString()} sq ft`], ["Siding", `${d.quick.sidingSqFt.toLocaleString()} sq ft`], ["Concrete", `${d.quick.concreteCuYd} cu yd`]]} />
            <Notes items={["Raw materials only at placeholder prices; no labour, permits, delivery, tax or tools. Waste: 10% lumber and siding, 5% steel roofing, 5% concrete.", `Prices edited in the app: ${Object.keys(model.priceOverrides).length || "none"}.`, "Get three quotes: the truss plant, the steel supplier and the lumber yard usually price the whole package."]} />
          </div>
        </div>
      </Sheet>

      {/* M2 cut list */}
      <Sheet n={n("M2")} total={total} code="M2" title="Cut list" project={name} date={date}>
        <div className="grid grid-cols-[1.7fr_1fr] gap-4">
          <Table testId="cut-list" className="compact" head={["Piece", "Lumber", "Qty", "Cut length", "Ends", "Buy", "Per stick"]} rows={d.cuts.lines.map((l) => [l.label, `${l.nominal.replace("x", "×").replace("3ply", "3-ply ")} ${l.treatment === "none" ? "" : TREATMENT_LABEL[l.treatment]}`, l.count, l.cutLength, l.ends, `${l.sticks} × ${l.stockFt}'`, l.piecesPerStick >= 1 ? l.piecesPerStick : `splice`])} />
          <div className="flex flex-col gap-3">
            <Table head={["Stock to buy", "Count", "Board ft"]} rows={d.cuts.stock.map((s) => [`${s.nominal.replace("x", "×")} × ${s.stockFt}' ${s.treatment === "none" ? "" : TREATMENT_LABEL[s.treatment]}`, s.count, Math.round(s.boardFeet)])} />
            <KeyValue items={[["Bought", `${d.cuts.boughtBf.toLocaleString()} board feet`], ["Cut", `${d.cuts.cutBf.toLocaleString()} board feet`], ["Waste", `${d.cuts.wastePct}%`]]} />
            {d.cuts.orders.map((o) => (
              <p key={o.label} className="text-[11px]">
                <span className="font-semibold">Order:</span> {o.count} × {o.label}. {o.note}
              </p>
            ))}
            <Notes title="End cuts" items={["S square · P plumb · B birdsmouth · 45 parallel 45° ends · N notch. Lengths to ⅛\".", ...d.cuts.notes.map((n) => `${n.kind}: ${n.note}`)]} />
          </div>
        </div>
      </Sheet>

      {/* M3 hardware */}
      <Sheet n={n("M3")} total={total} code="M3" title="Hardware schedule" project={name} date={date}>
        <Table testId="hardware-table" className="compact" head={["Where", "Item", "Qty", "Goes where"]} rows={d.hardware.map((h) => [h.group, h.description, `${h.quantity.toLocaleString()} ${h.unit}`, h.note])} />
      </Sheet>

      {/* M4 sequence */}
      <Sheet n={n("M4")} total={total} code="M4" title="Build sequence & checks" project={name} date={date}>
        <ol className="sequence" data-testid="build-sequence">
          {d.sequence.map((s) => (
            <li key={s.n}>
              <div className="seq-title">
                <span className="seq-n">{s.n}</span> {s.title}
                {s.sheet ? <span className="seq-sheet">{s.sheet}</span> : null}
              </div>
              <p>{s.what}</p>
              <p className="seq-check">Check: {s.check}</p>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
