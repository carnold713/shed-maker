import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel } from "@/lib/model";
import { addZone, resizeZone } from "@/lib/model/zones";
import { applyLayout } from "@/lib/model/layouts";
import { addInteriorDoor, findInteriorDoor, moveInteriorDoor, removeInteriorDoor, setAutoDoor, updateInteriorDoor } from "@/lib/model/interiorDoors";
import { derivePartitions, interiorDoors } from "@/lib/interior/partitions";
import { interiorGeometry } from "@/lib/geometry";
import { estimateMaterials } from "@/lib/bom/estimate";
import { deriveFraming } from "@/lib/framing";
import { deriveGeometry } from "@/lib/geometry";
import { runRules } from "@/rules";

const base = () => createDefaultModel({ now: new Date(0) });

describe("interior doors", () => {
  it("default doors: sliding stall doors on pens, wood doors on rooms, none on aisles", () => {
    let m = applyLayout(base(), "centerAisle", { species: "horse", supportBays: 1 });
    const doors = interiorDoors(m);
    const pens = m.zones.filter((z) => z.type === "pen");
    expect(doors.filter((d) => d.door.type === "stallSlide")).toHaveLength(pens.length);
    expect(doors.some((d) => d.door.type === "woodHinged")).toBe(true);
    expect(doors.every((d) => d.door.auto)).toBe(true);
    m = setAutoDoor(m, pens[0].id, false);
    expect(interiorDoors(m).filter((d) => d.door.zoneId === pens[0].id)).toHaveLength(0);
    expect(runRules(m).findings.some((f) => f.rule === "design.interiorDoor.exists" && f.entityIds.includes(pens[0].id) && f.fix?.command === "setAutoDoor")).toBe(true);
  });

  it("adds an explicit door on a zone edge, centred by default, snapped to 6\", and lands it in the partition", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "p1" });
    m = addZone(m, { type: "aisle", rect: { x: 12, y: 0, w: 12, d: 36 }, id: "a" });
    m = addInteriorDoor(m, { zoneId: "p1", side: "e", type: "dutch", id: "d1" });
    const z = m.zones.find((x) => x.id === "p1")!;
    expect(z.autoDoor).toBe(false);
    expect(z.doors[0]).toMatchObject({ id: "d1", type: "dutch", side: "e", widthFt: 4, heightFt: 7.5, offsetFt: 4 });
    expect(() => parseBuildingModel(m)).not.toThrow();
    const front = derivePartitions(m).find((p) => p.zones.some((q) => q?.id === "p1") && p.zones.some((q) => q?.id === "a"))!;
    expect(front.doors).toHaveLength(1);
    expect(front.doors[0]).toMatchObject({ id: "d1", type: "dutch", u: 4, auto: false, x0: 12, y0: 4, x1: 12, y1: 8 });
    // A second door in the same spot is refused; one beside it is fine.
    expect(addInteriorDoor(m, { zoneId: "p1", side: "e", offsetFt: 5 })).toBe(m);
    const two = addInteriorDoor(m, { zoneId: "p1", side: "e", offsetFt: 0.3, widthFt: 3 });
    expect(two.zones[0].doors).toHaveLength(2);
    expect(two.zones[0].doors[1].offsetFt).toBe(0.5);
  });

  it("move, update type (re-sizes), resize clamps, remove", () => {
    let m = addZone(base(), { type: "tack", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "t" });
    m = addZone(m, { type: "aisle", rect: { x: 12, y: 0, w: 12, d: 36 }, id: "a" });
    m = addInteriorDoor(m, { zoneId: "t", side: "e", id: "d" });
    expect(findInteriorDoor(m, "d")!.door).toMatchObject({ type: "woodHinged", widthFt: 3 });
    m = moveInteriorDoor(m, "d", 8.2);
    expect(findInteriorDoor(m, "d")!.door.offsetFt).toBe(8);
    m = updateInteriorDoor(m, "d", { type: "cased" });
    expect(findInteriorDoor(m, "d")!.door).toMatchObject({ type: "cased", widthFt: 4, heightFt: 7, offsetFt: 7.75 });
    m = resizeZone(m, "t", { x: 0, y: 0, w: 12, d: 6 }, { autoGrow: false });
    expect(findInteriorDoor(m, "d")!.door.offsetFt).toBe(1.75); // clamped inside the 6' edge
    m = removeInteriorDoor(m, "d");
    expect(findInteriorDoor(m, "d")).toBeNull();
    expect(m.zones[0].autoDoor).toBe(false);
  });

  it("geometry: sliders get a leaf on the aisle side and a track; hinged doors sit in the partition plane; wood doors get jambs", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "p1" });
    m = addZone(m, { type: "pen", species: "horse", rect: { x: 0, y: 12, w: 12, d: 12 }, id: "p2" });
    m = addZone(m, { type: "tack", rect: { x: 0, y: 24, w: 12, d: 12 }, id: "t" });
    m = addZone(m, { type: "aisle", rect: { x: 12, y: 0, w: 12, d: 36 }, id: "a" });
    m = addInteriorDoor(m, { zoneId: "p2", side: "e", type: "stallHinged", id: "h" });
    const g = interiorGeometry(m);
    const slide = g.find((b) => b.kind === "stallDoor" && b.entityId === "p1")!;
    expect(slide.center[0]).toBeGreaterThan(12); // hangs on the aisle (east) side of x = 12
    expect(g.some((b) => b.kind === "track" && b.entityId === "p1")).toBe(true);
    const hinged = g.find((b) => b.kind === "stallDoor" && b.entityId === "h")!;
    expect(hinged.center[0]).toBeCloseTo(12, 6); // in the plane
    expect(g.filter((b) => b.entityId === "t" && b.material === "trim")).toHaveLength(3); // two jambs + head
  });

  it("warns on narrow stall doors and counts doors and hardware in the estimate", () => {
    let m = addZone(base(), { type: "pen", species: "horse", rect: { x: 0, y: 0, w: 12, d: 12 }, id: "p1" });
    m = addZone(m, { type: "aisle", rect: { x: 12, y: 0, w: 12, d: 36 }, id: "a" });
    m = addInteriorDoor(m, { zoneId: "p1", side: "e", widthFt: 3, id: "d" });
    const f = runRules(m).findings.find((x) => x.rule === "design.interiorDoor.width");
    expect(f?.fix).toMatchObject({ command: "setInteriorDoorWidth", args: { id: "d", widthFt: 4 } });
    const est = estimateMaterials(m, deriveFraming(m), deriveGeometry(m));
    expect(est.lines.find((l) => l.sku === "door.stallSlide")?.quantity).toBe(1);
    expect(est.lines.find((l) => l.sku === "hw.stallHanger")?.quantity).toBe(2);
    expect(est.lines.find((l) => l.sku === "hw.stallTrack")?.quantity).toBe(1); // 6' of track -> one 8' section
  });
});
