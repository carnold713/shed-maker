import { BuildingModel, SCHEMA_VERSION, parseBuildingModel } from "./schema";

/**
 * JSON schema migrations are code. Each step upgrades exactly one version.
 * Add `[n]: (doc) => doc'` when SCHEMA_VERSION is bumped; never edit old steps.
 */
type Step = (doc: Record<string, unknown>) => Record<string, unknown>;

const steps: Record<number, Step> = {
  // 1 -> 2 would go here.
};

export function migrateModel(input: unknown): BuildingModel {
  if (typeof input !== "object" || input === null) {
    throw new Error("BuildingModel must be an object");
  }
  let doc = input as Record<string, unknown>;
  let v = typeof doc.schemaVersion === "number" ? doc.schemaVersion : 1;
  if (v > SCHEMA_VERSION) {
    throw new Error(`Model schemaVersion ${v} is newer than supported ${SCHEMA_VERSION}`);
  }
  while (v < SCHEMA_VERSION) {
    const step = steps[v];
    if (!step) throw new Error(`No migration from schemaVersion ${v}`);
    doc = { ...step(doc), schemaVersion: v + 1 };
    v += 1;
  }
  return parseBuildingModel(doc);
}
