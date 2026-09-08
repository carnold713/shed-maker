"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { Field, inputClass, Section, Toggle } from "@/components/ui/Field";

/** Project step (UX audit §2.8): name, notes, and the site facts that clear warnings on every plan. */
export function ProjectStep() {
  const model = useProjectStore((s) => s.model)!;
  const setName = useProjectStore((s) => s.setName);
  const setNotes = useProjectStore((s) => s.setNotes);
  const setSite = useProjectStore((s) => s.setSite);
  const site = model.site;
  return (
    <>
      <DockHeader step="project" title="Project" icon="project" />
      <DockBody>
        <Section title="About this barn">
          <Field label="Name">
            <input className={inputClass} defaultValue={model.meta.name} key={model.meta.name} onBlur={(e) => setName(e.target.value.trim() || model.meta.name)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} data-testid="project-name-field" />
          </Field>
          <Field label="Notes for your builder" hint="Animals, site, what matters most. Printed on the cover sheet.">
            <textarea className={`${inputClass} min-h-[5.5rem] resize-y`} rows={4} defaultValue={model.meta.notes ?? ""} key={`notes_${model.meta.notes ?? ""}`} onBlur={(e) => setNotes(e.target.value)} data-testid="project-notes" />
          </Field>
        </Section>
        <Section title="Site">
          <Field label="North is this way" hint="Rotation of the plan's up direction from true north, clockwise. The plan's N arrow follows.">
            <select className={inputClass} value={String(site.orientationDeg)} onChange={(e) => setSite({ orientationDeg: Number(e.target.value) })}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "Plan up = north (0°)" : `${d}° clockwise`}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Frost depth (inches)" hint="Sets how deep the posts go.">
              <input type="number" min={0} max={96} className={`${inputClass} font-mono`} value={site.frostDepthIn ?? ""} onChange={(e) => setSite({ frostDepthIn: e.target.value ? Number(e.target.value) : undefined })} data-testid="site-frost" />
            </Field>
            <Field label="Ground snow (psf)" hint="From your building department.">
              <input type="number" min={0} max={200} className={`${inputClass} font-mono`} value={site.groundSnowPsf ?? ""} onChange={(e) => setSite({ groundSnowPsf: e.target.value ? Number(e.target.value) : undefined })} data-testid="site-snow" />
            </Field>
          </div>
          <Toggle checked={site.verified.frost} onChange={(v) => setSite({ verified: { frost: v } })} label="Frost depth verified with my building department" hint="Removes the frost warning on every plan." testId="site-frost-verified" />
          <Toggle checked={site.verified.snow} onChange={(v) => setSite({ verified: { snow: v } })} label="Snow load verified" hint="Trusses are ordered to this number." testId="site-snow-verified" />
        </Section>
        <p className="text-[11px] leading-relaxed text-muted">Nothing here is required, but a verified frost depth removes the warning on every plan. This tool is a planning and communication aid, not a substitute for an engineer or your building department.</p>
      </DockBody>
      <NextStep to="layout" />
    </>
  );
}
