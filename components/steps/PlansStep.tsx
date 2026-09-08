"use client";

import { useMemo, useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { estimateMaterials, formatUsd } from "@/lib/bom/estimate";
import { quickQuantities, designProgress } from "@/lib/bom/quick";
import { PRICE_BY_SKU } from "@/rules/materials/prices";
import { DockHeader, DockBody } from "@/components/editor/Dock";
import { Section } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

/** Plans step (UX audit §2.7 + cost): the estimate, what's in it, and the way to the blueprint sheets. */
export function PlansStep() {
  const model = useProjectStore((s) => s.model)!;
  const projectId = useProjectStore((s) => s.projectId);
  const setPriceOverride = useProjectStore((s) => s.setPriceOverride);
  const { framing, geometry, report } = useDerived();
  const est = useMemo(() => (framing && geometry ? estimateMaterials(model, framing, geometry) : null), [model, framing, geometry]);
  const q = useMemo(() => (framing && geometry ? quickQuantities(model, framing, geometry) : null), [model, framing, geometry]);
  const steps = designProgress(model, report?.errors ?? 0);
  const [editPrices, setEditPrices] = useState(false);
  const overrides = Object.keys(model.priceOverrides).length;
  if (!est || !q) return null;

  return (
    <>
      <DockHeader step="plans" title="Plans" subtitle="Blueprints, materials and cost" icon="plans" />
      <DockBody>
        <a href={`/p/${projectId}/pack`} className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white shadow-[0_8px_18px_-8px_rgba(238,125,43,0.9)] transition hover:brightness-105" data-testid="open-blueprints">
          <span className="flex items-center gap-2">
            <Icon name="print" size={18} /> Open the blueprints
          </span>
          <span aria-hidden>→</span>
        </a>
        <p className="-mt-3 text-[11px] leading-relaxed text-muted">Floor plan, post plan, wall and roof framing, electrical, cut list, hardware, materials with cost and a build sequence. Print to PDF from there.</p>

        <Section title="Materials estimate" aside={<span className="text-[11px] text-muted">{formatUsd(est.low)} – {formatUsd(est.high)}</span>}>
          <div className="text-[26px] font-semibold tracking-tight" data-testid="estimate-total">
            {formatUsd(est.total)}
          </div>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {est.byCategory.map((c) => (
              <li key={c.category} className="flex items-center justify-between">
                <span>{c.label}</span>
                <span className="font-mono text-muted">{formatUsd(c.cost)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-muted">Raw materials only, at placeholder prices (±15%). No labour, permits, delivery or tax. Edit any price below to match your local quotes{overrides ? ` (${overrides} edited)` : ""}.</p>
          <button className="text-left text-[12px] text-accent underline" onClick={() => setEditPrices((v) => !v)} data-testid="edit-prices">
            {editPrices ? "Hide prices" : "Edit prices"}
          </button>
          {editPrices ? (
            <table className="w-full text-[11.5px]" data-testid="price-table">
              <tbody>
                {est.lines.map((l) => (
                  <tr key={l.sku + l.description} className="border-t border-border/50">
                    <td className="py-1 pr-2">
                      <div>{l.description}</div>
                      <div className="font-mono text-[10.5px] text-muted">
                        {l.quantity.toLocaleString()} {l.unit}
                      </div>
                    </td>
                    <td className="py-1 text-right">
                      <span className="inline-flex items-center gap-0.5 font-mono">
                        $
                        <input type="number" step="0.01" min={0} className="w-16 rounded border border-border bg-background/60 px-1 py-0.5 text-right font-mono text-[11.5px] focus:border-accent focus:outline-none" value={l.unitCost} onChange={(e) => setPriceOverride(l.sku, e.target.value === "" ? null : Number(e.target.value))} aria-label={`Unit price for ${l.description}`} />
                        <span className="text-muted">/{l.unit}</span>
                      </span>
                      {model.priceOverrides[l.sku] !== undefined ? (
                        <button className="ml-1 text-[10.5px] text-muted underline" onClick={() => setPriceOverride(l.sku, null)} title={`Back to ${PRICE_BY_SKU[l.sku]?.unitCost ?? 0}`}>
                          reset
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Section>

        <Section title="At a glance">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
            <dt className="text-muted">Posts</dt>
            <dd className="font-mono">{q.posts}</dd>
            <dt className="text-muted">Trusses</dt>
            <dd className="font-mono">{q.trussCount}</dd>
            <dt className="text-muted">Lumber</dt>
            <dd className="font-mono">{q.boardFeet.toLocaleString()} board feet</dd>
            <dt className="text-muted">Roof steel</dt>
            <dd className="font-mono">{q.roofSqFt.toLocaleString()} sq ft</dd>
            <dt className="text-muted">Siding</dt>
            <dd className="font-mono">{q.sidingSqFt.toLocaleString()} sq ft</dd>
            <dt className="text-muted">Concrete</dt>
            <dd className="font-mono">{q.concreteCuYd} cubic yards</dd>
          </dl>
        </Section>

        <Section title="Ready to build?">
          <ul className="flex flex-col gap-1" data-testid="progress-card">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-[12.5px]" title={s.hint}>
                <span className="flex items-center gap-2">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${s.done ? "bg-emerald-500 text-white" : "border border-border text-transparent"}`}>✓</span>
                  {s.label}
                </span>
                <span className={`text-[11px] ${s.done ? "text-emerald-700" : "text-muted"}`}>{s.done ? "Done" : "Not yet"}</span>
              </li>
            ))}
          </ul>
        </Section>
      </DockBody>
    </>
  );
}
