import { describe, expect, it } from "vitest";
import { createDefaultModel, migrateModel, parseBuildingModel, SCHEMA_VERSION, safeParseBuildingModel } from "@/lib/model";

describe("BuildingModel schema", () => {
  it("default model is valid and carries the current schemaVersion", () => {
    const m = createDefaultModel({ now: new Date("2026-01-01T00:00:00Z") });
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(() => parseBuildingModel(m)).not.toThrow();
    expect(m.walls).toHaveLength(4);
    expect(m.walls.every((w) => w.role === "exterior")).toBe(true);
  });

  it("applies Appendix B defaults", () => {
    const m = createDefaultModel();
    expect(m.method).toBe("postFrame");
    expect(m.footprint).toEqual({ kind: "rect", wFt: 24, dFt: 36 });
    expect(m.eaveHeightFt).toBe(10);
    expect(m.roof.pitch).toBe(4);
    expect(m.roof.overhangEaveIn).toBe(12);
    expect(m.roof.trussSpacingIn).toBe(48);
    expect(m.foundation.slab.thicknessIn).toBe(4);
    expect(m.foundation.slab.gravelBaseIn).toBe(4);
    expect(m.foundation.postBaySpacingFt).toBe(8);
    expect(m.site.frostDepthIn).toBe(36);
    expect(m.site.verified.frost).toBe(false);
  });

  it("round-trips through JSON", () => {
    const m = createDefaultModel();
    const again = parseBuildingModel(JSON.parse(JSON.stringify(m)));
    expect(again).toEqual(m);
  });

  it("fills nested defaults from a minimal document", () => {
    const now = new Date().toISOString();
    const m = parseBuildingModel({
      schemaVersion: SCHEMA_VERSION,
      footprint: { kind: "rect", wFt: 20, dFt: 30 },
      meta: { name: "Min", createdAt: now, updatedAt: now },
    });
    expect(m.roof.form).toBe("gable");
    expect(m.foundation.kind).toBe("embeddedPost");
    expect(m.materials.wainscot.enabled).toBe(false);
    expect(m.units).toBe("imperial");
  });

  it("rejects bad documents", () => {
    expect(safeParseBuildingModel({}).success).toBe(false);
    expect(safeParseBuildingModel({ ...createDefaultModel(), footprint: { kind: "rect", wFt: -1, dFt: 10 } }).success).toBe(false);
    expect(safeParseBuildingModel({ ...createDefaultModel(), schemaVersion: 99 }).success).toBe(false);
  });

  it("migrateModel accepts the current version and rejects newer ones", () => {
    const m = createDefaultModel();
    expect(migrateModel(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(() => migrateModel({ ...m, schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/newer/);
    expect(() => migrateModel(null)).toThrow();
  });
});
