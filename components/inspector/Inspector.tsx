"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { OPENING_PRESETS, DOOR_TYPES, WINDOW_VARIANTS } from "@/lib/model/openings";
import type { BuildingModel, OpeningType } from "@/lib/model/schema";
import { formatFtIn } from "@/lib/units";
import { actualFt, stockLength, TREATMENT_LABEL, boardFeet } from "@/rules/materials/lumber";
import { getRule } from "@/rules";
import { Field, inputClass, Section } from "@/components/ui/Field";
import { FtInput } from "@/components/ui/FtInput";
import { Button } from "@/components/ui/Button";
import { DockHeader, DockBody } from "@/components/editor/Dock";
import { ZoneInspector } from "./ZoneInspector";
import { LeanToInspector } from "./LeanToInspector";
import { RunInspector } from "./RunInspector";
import { InteriorDoorInspector } from "./InteriorDoorInspector";
import { FixtureInspector } from "./FixtureInspector";
import { DrainInspector, OutletInspector } from "./DrainInspector";

export { FtInput };

/** Does this selection have its own dock panel? Building-level ids fall through to the step panel. */
export function hasInspector(model: BuildingModel, id: string): boolean {
  if (id === "footprint" || id === "roof" || id === "foundation" || id === "electrical" || id === "site" || id === "drainage") return false;
  void model;
  return true; // items get their panel; unknown ids reach MemberInspector, which clears them
}

export function Inspector() {
  const model = useProjectStore((s) => s.model);
  const selection = useProjectStore((s) => s.selection);
  if (!model || model.footprint.kind !== "rect" || !selection) return null;
  if (model.openings.some((o) => o.id === selection)) return <OpeningInspector id={selection} />;
  if (model.zones.some((z) => z.id === selection)) return <ZoneInspector id={selection} />;
  if (model.zones.some((z) => z.doors.some((d) => d.id === selection))) return <InteriorDoorInspector id={selection} />;
  if (model.leanTos.some((l) => l.id === selection)) return <LeanToInspector id={selection} />;
  if (model.runs.some((r) => r.id === selection)) return <RunInspector id={selection} />;
  if (model.electrical.fixtures.some((f) => f.id === selection)) return <FixtureInspector id={selection} />;
  if (model.drainage.drains.some((d) => d.id === selection)) return <DrainInspector id={selection} />;
  if (selection === "drain_outlet" && model.drainage.outlet) return <OutletInspector />;
  return <MemberInspector id={selection} />;
}

const SIDE_NAME = { n: "north wall", s: "south wall", e: "east wall", w: "west wall" } as const;

function OpeningInspector({ id }: { id: string }) {
  const model = useProjectStore((s) => s.model)!;
  const updateOpening = useProjectStore((s) => s.updateOpening);
  const removeOpening = useProjectStore((s) => s.removeOpening);
  const flip = useProjectStore((s) => s.flipOpeningSwing);
  const center = useProjectStore((s) => s.centerOpening);
  const o = model.openings.find((x) => x.id === id);
  if (!o) return null;
  const wall = model.walls.find((w) => w.id === o.wallId);
  const preset = OPENING_PRESETS[o.type];
  const types: OpeningType[] = o.type === "window" ? ["window"] : [...DOOR_TYPES];
  const isWindow = o.type === "window";
  const slides = o.type === "slidingDoor" || o.type === "stallDoor";

  return (
    <>
      <DockHeader back="outside" title={preset.label} subtitle={`${SIDE_NAME[wall?.side ?? "s"]} · ${formatFtIn(o.widthFt)} × ${formatFtIn(o.heightFt)}`} icon={isWindow ? "window" : "door"} />
      <DockBody>
        <Section title="What it is">
          <Field label="Type">
            <select className={inputClass} value={o.type} onChange={(e) => updateOpening(o.id, { type: e.target.value as OpeningType })} data-testid="opening-type">
              {types.map((t) => (
                <option key={t} value={t}>
                  {OPENING_PRESETS[t].label}
                </option>
              ))}
            </select>
          </Field>
          {isWindow ? (
            <Field label="Style">
              <select className={inputClass} value={o.variant ?? "slider"} onChange={(e) => updateOpening(o.id, { variant: e.target.value })}>
                {WINDOW_VARIANTS.map((v) => (
                  <option key={v} value={v}>
                    {{ slider: "Sliding", singleHung: "Single-hung", fixed: "Fixed (doesn't open)", awning: "Awning (hinged at the top)", hopper: "Hopper", transom: "Transom (high, for light)" }[v]}
                  </option>
                ))}
              </select>
            </Field>
          ) : o.type === "manDoor" ? (
            <Field label="Style">
              <select className={inputClass} value={o.variant ?? "solid"} onChange={(e) => updateOpening(o.id, { variant: e.target.value })}>
                <option value="solid">Solid steel</option>
                <option value="halfLight">With window</option>
              </select>
            </Field>
          ) : null}
        </Section>
        <Section title="Size">
          <div className="flex flex-wrap gap-1">
            {preset.sizes.map(([w, h]) => (
              <button key={`${w}x${h}`} onClick={() => updateOpening(o.id, { widthFt: w, heightFt: h })} className={`rounded-lg border px-2 py-0.5 font-mono text-[11.5px] ${Math.abs(w - o.widthFt) < 1e-6 && Math.abs(h - o.heightFt) < 1e-6 ? "border-accent bg-accent/10" : "border-border hover:bg-background"}`}>
                {formatFtIn(w)} × {formatFtIn(h)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width">
              <FtInput value={o.widthFt} min={1} max={40} onCommit={(v) => updateOpening(o.id, { widthFt: v })} testId="opening-width" />
            </Field>
            <Field label="Height">
              <FtInput value={o.heightFt} min={1} max={24} onCommit={(v) => updateOpening(o.id, { heightFt: v })} testId="opening-height" />
            </Field>
            {isWindow ? (
              <Field label="Sill height">
                <FtInput value={o.sillFt} min={0} max={20} onCommit={(v) => updateOpening(o.id, { sillFt: v })} />
              </Field>
            ) : null}
          </div>
          <p className="text-[11px] leading-snug text-muted">
            Rough opening {formatFtIn(o.widthFt + 1 / 12)} × {formatFtIn(o.heightFt + 0.5 / 12)} — what the framer cuts. Header and jambs are in the framing.
          </p>
        </Section>
        <Section title="Where">
          <Field label="From the corner" hint="Or drag it along the wall in the plan">
            <FtInput value={o.offsetFt} min={0} max={200} onCommit={(v) => updateOpening(o.id, { offsetFt: v })} testId="opening-offset" />
          </Field>
          <div className="flex flex-wrap gap-1">
            <Button className="px-2 py-1 text-xs" onClick={() => center(o.id, "wall")}>
              Center on wall
            </Button>
            <Button className="px-2 py-1 text-xs" onClick={() => center(o.id, "bay")}>
              Center between posts
            </Button>
          </div>
          {!isWindow ? (
            <Field label={slides ? "Slides" : "Opens"}>
              <select className={inputClass} value={o.swing} onChange={(e) => updateOpening(o.id, { swing: e.target.value as typeof o.swing })}>
                {slides ? (
                  <>
                    <option value="slideLeft">Left</option>
                    <option value="slideRight">Right</option>
                    <option value="biParting">From the middle</option>
                  </>
                ) : o.type === "overheadDoor" || o.type === "rollUpDoor" ? (
                  <option value="none">{o.type === "rollUpDoor" ? "Rolls up" : "Lifts up"}</option>
                ) : (
                  <>
                    <option value="in">In</option>
                    <option value="out">Out</option>
                  </>
                )}
              </select>
            </Field>
          ) : null}
        </Section>
        <div className="flex flex-wrap gap-1">
          <Button className="px-2 py-1 text-xs" onClick={() => flip(o.id)} disabled={o.swing === "none" || o.swing === "biParting"}>
            Flip
          </Button>
          <Button className="px-2 py-1 text-xs text-red-700" onClick={() => removeOpening(o.id)} data-testid="opening-delete">
            Delete
          </Button>
        </div>
      </DockBody>
    </>
  );
}

const KIND_LABEL: Record<string, string> = {
  post: "Post",
  footing: "Footing pad",
  skirt: "Skirt board",
  girt: "Girt (wall board)",
  carrier: "Truss carrier",
  header: "Header",
  jamb: "Jamb",
  trussTopChord: "Truss top chord",
  trussBottomChord: "Truss bottom chord",
  trussWeb: "Truss web",
  purlin: "Purlin",
  plate: "Plate",
  stud: "Stud",
  kneeBrace: "Knee brace",
};

function MemberInspector({ id }: { id: string }) {
  const { framing } = useDerived();
  const select = useProjectStore((s) => s.select);
  const m = framing?.members.find((x) => x.id === id);
  if (!m) {
    // Unknown id: clear it rather than show a blank panel.
    queueMicrotask(() => select(null));
    return null;
  }
  const a = actualFt(m.nominal);
  const stock = stockLength(m.lengthFt);
  const rule = getRule(m.ruleRef);
  return (
    <>
      <DockHeader back="building" title={KIND_LABEL[m.kind] ?? m.kind} subtitle={`${m.nominal.replace("x", "×").replace("3ply", "3-ply ")} · ${formatFtIn(m.lengthFt)}`} icon="building" />
      <DockBody>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]" data-testid="member-inspector">
          <dt className="text-muted">Actual size</dt>
          <dd className="font-mono">
            {formatFtIn(a.t)} × {formatFtIn(a.d)}
          </dd>
          <dt className="text-muted">Cut length</dt>
          <dd className="font-mono">{formatFtIn(m.lengthFt)}</dd>
          <dt className="text-muted">Buy</dt>
          <dd className="font-mono">
            {stock.stockFt}&apos; stock{stock.pieces > 1 ? ` × ${stock.pieces}` : ""} · {boardFeet(m.nominal, stock.stockFt * stock.pieces).toFixed(1)} bf
          </dd>
          <dt className="text-muted">Treatment</dt>
          <dd>{TREATMENT_LABEL[m.treatment]}</dd>
          {m.note ? (
            <>
              <dt className="text-muted">Note</dt>
              <dd>{m.note}</dd>
            </>
          ) : null}
          <dt className="text-muted">Placed by</dt>
          <dd className="font-mono text-[11px]">{m.ruleRef}</dd>
          {rule ? (
            <>
              <dt className="text-muted">Source</dt>
              <dd className="font-mono text-[11px]">{rule.source}</dd>
            </>
          ) : null}
        </dl>
        {rule ? <p className="text-[11px] leading-relaxed text-muted">{rule.rationale}</p> : null}
      </DockBody>
    </>
  );
}
