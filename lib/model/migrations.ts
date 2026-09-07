import { BuildingModel, SCHEMA_VERSION, parseBuildingModel } from "./schema";

/**
 * JSON schema migrations are code. Each step upgrades exactly one version.
 * Add `[n]: (doc) => doc'` when SCHEMA_VERSION is bumped; never edit old steps.
 */
type Step = (doc: Record<string, unknown>) => Record<string, unknown>;

const steps: Record<number, Step> = {
  /**
   * v1 -> v2 (SPEC Part II §31): `method` becomes `frame.system` with the
   * full post-frame parameter block; `roof.trussSpacingIn` moves to
   * `frame.trusses.spacingIn`.
   */
  1: (doc) => {
    const method = doc.method === "stickFrame" ? "stickFrame" : "postFrame";
    const roof = (doc.roof ?? {}) as Record<string, unknown>;
    const { trussSpacingIn, ...roofRest } = roof;
    const spacingIn = typeof trussSpacingIn === "number" ? trussSpacingIn : method === "postFrame" ? 48 : 24;
    const rest = { ...doc };
    delete rest.method;
    return {
      ...rest,
      roof: roofRest,
      frame: {
        system: method,
        trusses: { spacingIn },
      },
    };
  },
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
