"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import type { Finding } from "@/rules";

/** Maps a finding's `fix.command` to a store action (SPEC §7.7 `fix?`). */
export function runFix(f: Finding) {
  const s = useProjectStore.getState();
  const args = f.fix?.args ?? {};
  switch (f.fix?.command) {
    case "snapFootprintToModule":
      return s.snapFootprintToModule((args.moduleFt as 2 | 4) ?? 2);
    case "setEaveHeight":
      return s.setEaveHeight(Number(args.ft));
    case "centerOpeningInBay":
      return s.centerOpening(String(args.id), "bay");
    case "growToFitZones":
      return s.growToFitZones();
    case "setOutsideAccess":
      return s.setOutsideAccess(String(args.id), true);
    case "resizeZoneTo": {
      const id = String(args.id);
      const z = s.model?.zones.find((x) => x.id === id);
      if (!z) return;
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      return s.resizeZone(id, { x: Math.min(...xs), y: Math.min(...ys), w: Number(args.w), d: Number(args.d) }, true);
    }
    case "autoPlacePanel":
      return s.autoPlacePanel();
    case "autoLightZone":
      return s.autoLightZone(String(args.id));
    case "setServiceAmps":
      return s.setElectricalService({ amps: Number(args.amps) });
    case "setFixtureMount":
      return s.updateFixture(String(args.id), { mountFt: Number(args.mountFt) });
    case "addFixtureAt":
      return s.addFixture({ kind: args.kind as "switch", x: Number(args.x), y: Number(args.y), wallId: args.wallId ? String(args.wallId) : undefined });
    case "setInteriorDoorWidth":
      return s.updateInteriorDoor(String(args.id), { widthFt: Number(args.widthFt) });
    case "setAutoDoor":
      return s.setAutoDoor(String(args.id), true);
    case "autoDrainWashBays":
      return s.autoDrainWashBays();
    case "autoOutlet":
      return s.autoOutlet();
    case "setOutletKind":
      return s.setOutlet({ kind: args.kind as "dryWell" });
    case "fitRunToHead":
      return s.fitRunToHead(String(args.id));
    case "updateRun":
      return s.updateRun(String(args.id), (args.patch ?? {}) as Parameters<typeof s.updateRun>[1]);
    case "addFenceGate":
      return s.addFenceGate(String(args.id), { widthFt: args.widthFt ? Number(args.widthFt) : undefined });
    case "addRunGate":
      return s.addRunGate(String(args.runId), { widthFt: args.widthFt ? Number(args.widthFt) : undefined });
    case "nudgeOpeningClear": {
      const id = String(args.id);
      const clear = Number(args.clearanceFt ?? 1);
      const m = s.model;
      const o = m?.openings.find((x) => x.id === id);
      const w = o && m?.walls.find((x) => x.id === o.wallId);
      if (!o || !w) return;
      const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
      const target = o.offsetFt < clear ? clear : len - clear - o.widthFt;
      return s.moveOpening(id, target);
    }
  }
}

