"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useDerived } from "@/lib/store/useDerived";
import { useViewStore } from "@/lib/store/useViewStore";
import { runArea, runsForZone } from "@/lib/model/runs";
import { fenceAreaSqFt, fenceLengthFt, formatArea } from "@/lib/model/fences";
import { exteriorEdgesOf } from "@/lib/model/zones";
import { deriveFencing } from "@/lib/site/fencing";
import { formatLatLng, parseLatLng } from "@/lib/site/geo";
import { DockHeader, DockBody, NextStep } from "@/components/editor/Dock";
import { Field, inputClass, Section } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ToolRow, ToolButton, EmptyState, ItemList } from "./ToolRow";

interface Hit {
  label: string;
  lat: number;
  lng: number;
}

/** Site step (ADR-0017): runs and fences off the barn, and the barn on your land. */
export function SiteStep() {
  const model = useProjectStore((s) => s.model)!;
  const autoRuns = useProjectStore((s) => s.autoRuns);
  const select = useProjectStore((s) => s.select);
  const setSite = useProjectStore((s) => s.setSite);
  const setTool = useViewStore((s) => s.setTool);
  const tool = useViewStore((s) => s.tool);
  const setSiteSurface = useViewStore((s) => s.setSiteSurface);
  const requestFit = useViewStore((s) => s.requestFit);
  const { report } = useDerived();
  const problems = new Set((report?.findings ?? []).filter((f) => f.severity !== "info").flatMap((f) => f.entityIds));
  const fencing = deriveFencing(model);
  const pensOutside = model.zones.filter((z) => (z.type === "pen" || z.type === "kidding") && exteriorEdgesOf(model, z).length > 0);
  const pensWithout = pensOutside.filter((z) => runsForZone(model, z.id).length === 0);
  const site = model.site;
  const located = site.lat !== undefined && site.lng !== undefined;

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [coords, setCoords] = useState(located ? formatLatLng({ lat: site.lat!, lng: site.lng! }) : "");
  useEffect(() => {
    setCoords(located ? formatLatLng({ lat: site.lat!, lng: site.lng! }) : "");
  }, [site.lat, site.lng, located]);

  async function search() {
    if (q.trim().length < 3) return;
    setSearching(true);
    setSearchNote(null);
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as { hits: Hit[]; error?: string };
      setHits(data.hits ?? []);
      if (data.error) setSearchNote(data.error);
      else if (!data.hits?.length) setSearchNote("Nothing found. Try the town and state, or paste coordinates from your phone's map app.");
    } catch {
      setSearchNote("Address lookup is unavailable right now. Paste coordinates instead.");
    } finally {
      setSearching(false);
    }
  }

  function place(lat: number, lng: number) {
    setSite({ lat, lng });
    setHits([]);
    setSiteSurface("map");
    requestFit();
  }

  const totalArea = model.runs.reduce((s, r) => s + runArea(r), 0);

  return (
    <>
      <DockHeader step="site" title="Site" subtitle={model.runs.length ? `${model.runs.length} run${model.runs.length > 1 ? "s" : ""} · ${totalArea.toLocaleString()} sq ft · ${fencing.totalFenceFt}' of fence` : "Runs, fences, and the barn on your land"} icon="site" />
      <DockBody>
        <Section title="Runs">
          <ToolRow>
            <ToolButton tool="select" icon="select" label="Select" keyHint="V" hint="Click a run to edit it · drag to move · handles to resize" testId="tool-select" />
            <ToolButton tool="run" icon="run" label="Run" keyHint="R" hint="Click beside an outside wall to add a fenced run there" testId="tool-run" />
            <ToolButton tool="fence" icon="fence" label="Fence" keyHint="F" hint="Click corner by corner around any area; click the first corner again to close it" testId="tool-fence" />
            <ToolButton tool="erase" icon="erase" label="Remove" keyHint="E" hint="Click a run to remove it" testId="tool-erase" />
          </ToolRow>
          {pensWithout.length ? (
            <Button className="px-2 py-1 text-xs" onClick={() => { const ids = autoRuns(); if (ids[0]) select(ids[0]); requestFit(); }} title="One run per stall on an outside wall, sized for its animals" data-testid="auto-runs">
              Runs for {pensWithout.length === 1 ? pensWithout[0].name : `all ${pensWithout.length} stalls on the outside walls`}
            </Button>
          ) : null}
          {model.runs.length === 0 ? (
            <EmptyState title="No runs yet.">
              {pensOutside.length ? "Each stall on an outside wall can have its own run off its Dutch door, sized for the animals in it." : "Put a stall against an outside wall in Layout, or click beside a wall with the Run tool."}
            </EmptyState>
          ) : (
            <ItemList items={model.runs.map((r) => ({ id: r.id, label: r.name, detail: `${r.rect.w}' × ${r.rect.d}' · ${runArea(r).toLocaleString()} sq ft`, icon: "run", warn: problems.has(r.id) }))} />
          )}
          {model.fences.length ? (
            <ItemList items={model.fences.map((f) => ({ id: f.id, label: f.name, detail: `${Math.round(fenceLengthFt(f)).toLocaleString()}' ${f.closed ? `· ${formatArea(fenceAreaSqFt(f))}` : "· open line"}`, icon: "fence", warn: problems.has(f.id) }))} />
          ) : null}
          {tool === "fence" ? <p className="text-[11px] leading-snug text-muted">Works on the plan and on the map: click each corner, click the first corner again to close a paddock, double-click or Enter to finish a line, Backspace to undo a corner.</p> : null}
          {model.runs.length || model.fences.length ? (
            <p className="text-[11px] leading-snug text-muted" data-testid="fence-summary">
              {fencing.totalFenceFt}&apos; of fence, {fencing.totalPosts} posts, {fencing.gates.reduce((s, g) => s + g.count, 0)} gate{fencing.gates.reduce((s, g) => s + g.count, 0) === 1 ? "" : "s"}. The fence schedule and the site plan are in the blueprints.
            </p>
          ) : null}
        </Section>

        <Section title="On your land">
          <Field label="Find the property" hint="An address, a road and town, or coordinates. The barn lands there; then pan to the exact spot and right-click the map to move it.">
            <div className="flex gap-1">
              <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const ll = parseLatLng(q); if (ll) place(ll.lat, ll.lng); else void search(); } }} placeholder="123 County Rd, Town, OH" data-testid="site-search" />
              <Button className="px-2 py-1 text-xs" onClick={() => { const ll = parseLatLng(q); if (ll) place(ll.lat, ll.lng); else void search(); }} disabled={searching} data-testid="site-search-go">
                {searching ? "…" : "Find"}
              </Button>
            </div>
          </Field>
          {hits.length ? (
            <ul className="flex flex-col gap-0.5" data-testid="site-hits">
              {hits.map((h) => (
                <li key={`${h.lat},${h.lng}`}>
                  <button className="w-full rounded-lg border border-border/70 bg-background/60 px-2 py-1 text-left text-[12px] hover:bg-background" onClick={() => place(h.lat, h.lng)}>
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {searchNote ? <p className="text-[11.5px] text-muted">{searchNote}</p> : null}
          <Field label="Coordinates" hint="Latitude, longitude of the middle of the barn.">
            <input
              className={`${inputClass} font-mono`}
              value={coords}
              onChange={(e) => setCoords(e.target.value)}
              onBlur={() => { const ll = parseLatLng(coords); if (ll) place(ll.lat, ll.lng); }}
              onKeyDown={(e) => { if (e.key === "Enter") { const ll = parseLatLng(coords); if (ll) place(ll.lat, ll.lng); } }}
              placeholder="40.12345, -82.12345"
              data-testid="site-coords"
            />
          </Field>
          <Field label="Which way it faces" hint="Degrees the plan's north edge is turned clockwise from true north. 0 keeps the long walls east–west as drawn.">
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={359} value={Math.round(site.orientationDeg)} onChange={(e) => setSite({ orientationDeg: Number(e.target.value) })} className="flex-1" data-testid="site-orientation" />
              <input type="number" min={0} max={359} className={`${inputClass} w-16 font-mono`} value={Math.round(site.orientationDeg)} onChange={(e) => setSite({ orientationDeg: ((Number(e.target.value) % 360) + 360) % 360 })} data-testid="site-orientation-num" />
              <span className="text-[12px] text-muted">°</span>
            </div>
          </Field>
          <p className="text-[11px] leading-snug text-muted">
            {located ? "The map shows the barn and its runs to scale. To move the barn far, pan to the spot and right-click it (or press “Put the barn here” on the map and click). Drag the barn for small moves; drag the round handle to turn it. Scroll to zoom." : "No location yet: find your property, then click the map where the barn goes."}
          </p>
          <div className="flex flex-wrap gap-1">
            <Button className="px-2 py-1 text-xs" onClick={() => { setSiteSurface("map"); setTool("fence"); }}>Draw a fence on the map</Button>
            {located ? <Button className="px-2 py-1 text-xs" onClick={() => setSite({ lat: undefined, lng: undefined })} data-testid="site-clear">Clear location</Button> : null}
          </div>
        </Section>
        <NextStep to="electrical" />
      </DockBody>
    </>
  );
}
