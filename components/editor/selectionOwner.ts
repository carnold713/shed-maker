import type { BuildingModel } from "@/lib/model/schema";
import type { Step } from "@/lib/store/useViewStore";

/** Which step "owns" a selected entity (UX audit §3.1). Null = any step may show it. */
export function ownerStep(model: BuildingModel, id: string): Step | null {
  if (model.zones.some((z) => z.id === id || z.doors.some((d) => d.id === id))) return "layout";
  if (model.openings.some((o) => o.id === id) || model.leanTos.some((l) => l.id === id)) return "outside";
  if (model.electrical.fixtures.some((f) => f.id === id) || id === "electrical") return "electrical";
  if (id === "footprint" || id === "roof" || id === "foundation" || id === "drainage" || id === "drain_outlet" || model.drainage.drains.some((d) => d.id === id)) return "building";
  return null; // framing members and the like
}
