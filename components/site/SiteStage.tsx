"use client";

import dynamic from "next/dynamic";
import { useViewStore } from "@/lib/store/useViewStore";
import { PlanView } from "@/components/plan/PlanView";
import { Segmented } from "@/components/ui/Segmented";

// Leaflet touches `window` at import time, so the map is client-only.
const SiteMap = dynamic(() => import("@/components/site/SiteMap").then((m) => m.SiteMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading map…</div>,
});

/** The Site step's left pane: the plan (runs and fences to scale) or the satellite map, with the same tools on both. */
export function SiteStage() {
  const surface = useViewStore((s) => s.siteSurface);
  const setSurface = useViewStore((s) => s.setSiteSurface);
  return (
    <div className="relative h-full w-full">
      {surface === "map" ? <SiteMap /> : <PlanView />}
      <div className={`absolute top-3 z-[1001] ${surface === "map" ? "left-16" : "left-3"}`}>
        <Segmented
          value={surface}
          onChange={(v) => setSurface(v as "plan" | "map")}
          options={[
            { value: "plan", label: "Plan", testId: "site-surface-plan" },
            { value: "map", label: "Map", testId: "site-surface-map" },
          ]}
        />
      </div>
    </div>
  );
}
