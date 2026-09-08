import { describe, expect, it } from "vitest";
import { createDefaultModel, parseBuildingModel } from "@/lib/model";
import { addZone, resizeZone, zoneRect } from "@/lib/model/zones";
import { applyLayout } from "@/lib/model/layouts";
import { addEndDoors, addInteriorDoor, addZoneDoor, defaultExteriorDoorSpec, defaultInteriorDoorType, endDoorsLabel, findInteriorDoor, moveInteriorDoor, removeInteriorDoor, setAutoDoor, updateInteriorDoor } from "@/lib/model/interiorDoors";
import { exteriorEdgesOf, isExteriorSide } from "@/lib/model/zones";
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

  it("aisle end doors: sliding doors sized to the aisle on the outside walls it reaches", () => {
    // 36' × 48' barn (default), 12' aisle running the full depth north-south.
    let m = applyLayout(base(), "centerAisle", { species: "horse", supportBays: 1 });
    const aisle = m.zones.find((z) => z.type === "aisle")!;
    const edges = exteriorEdgesOf(m, aisle);
    expect(edges.map((e) => e.side).sort()).toEqual(["n", "s"]);
    expect(isExteriorSide(m, aisle, "e")).toBe(false);
    expect(endDoorsLabel(m, aisle)).toBe("Doors at both ends");
    const short = resizeZone(m, aisle.id, { ...zoneRect(aisle), d: zoneRect(aisle).d - 4 }, { autoGrow: false });
    expect(endDoorsLabel(short, short.zones.find((z) => z.id === aisle.id)!)).toBe("Door at the south end");
    expect(defaultExteriorDoorSpec(m, aisle, 12)).toMatchObject({ type: "slidingDoor", widthFt: 12, heightFt: 9 }); // eave 10' -> 9' clear
    expect(defaultExteriorDoorSpec(m, aisle, 16)).toMatchObject({ type: "slidingDoor", widthFt: 16, swing: "biParting" });
    expect(defaultExteriorDoorSpec(m, { type: "pen" }, 12)).toMatchObject({ type: "dutchDoor", widthFt: 4 });
    expect(defaultExteriorDoorSpec(m, { type: "tack" }, 12)).toMatchObject({ type: "manDoor", widthFt: 3 });

    const before = m.openings.length;
    const r = addEndDoors(m, aisle.id, ["end_s", "end_n"]);
    m = r.model;
    expect(r.added).toEqual(["end_s", "end_n"]);
    expect(m.openings).toHaveLength(before + 2);
    const s = m.openings.find((o) => o.id === "end_s")!;
    const n = m.openings.find((o) => o.id === "end_n")!;
    expect(s).toMatchObject({ wallId: "wall_ext_s", type: "slidingDoor", widthFt: 12 });
    expect(n).toMatchObject({ wallId: "wall_ext_n", type: "slidingDoor", widthFt: 12 });
    // Centred on the aisle: south wall runs west->east, north wall east->west.
    const ar = m.zones.find((z) => z.id === aisle.id)!;
    const { x, w } = zoneRect(ar);
    expect(s.offsetFt + s.widthFt / 2).toBeCloseTo(x + w / 2, 5);
    expect(n.offsetFt + n.widthFt / 2).toBeCloseTo(m.footprint.kind === "rect" ? m.footprint.wFt - (x + w / 2) : 0, 5);
    // Idempotent: an end that already has a door is skipped.
    expect(addEndDoors(m, aisle.id).added).toEqual([]);
    expect(() => parseBuildingModel(m)).not.toThrow();
  });

  it("aisles get a sliding aisle door sized to the aisle on an inside side (an entry vestibule)", () => {
    let m = addZone(base(), { type: "aisle", rect: { x: 0, y: 0, w: 12, d: 8 }, id: "lock", name: "Vestibule" });
    m = addZone(m, { type: "aisle", rect: { x: 0, y: 8, w: 12, d: 28 }, id: "main" });
    expect(defaultInteriorDoorType({ type: "aisle" })).toBe("aisleSlide");
    m = addZoneDoor(m, { zoneId: "lock", side: "n", id: "d1" });
    const d = findInteriorDoor(m, "d1")!.door;
    expect(d).toMatchObject({ type: "aisleSlide", widthFt: 10, heightFt: 8, swing: "slideRight", offsetFt: 1 });
    const host = derivePartitions(m).find((p) => p.doors.some((x) => x.id === "d1"))!;
    expect(host.zones.map((z) => z?.id)).toEqual(["lock", "main"]);
    // On the side facing open floor too.
    m = addZoneDoor(m, { zoneId: "lock", side: "e", id: "d2" });
    expect(findInteriorDoor(m, "d2")!.door).toMatchObject({ type: "aisleSlide", widthFt: 6 });
    expect(interiorGeometry(m).some((b) => b.entityId === "d1" && b.kind === "stallDoor")).toBe(true);
    expect(() => parseBuildingModel(m)).not.toThrow();
  });

  it("addZoneDoor: a partition side gets an interior door, an outside-wall side gets an opening", () => {
    let m = addZone(base(), { type: "pen", species: "alpaca", rect: { x: 0, y: 0, w: 10, d: 10 }, id: "p1" });
    // West and south sides are on the outside walls; east and north face the open floor.
    m = addZoneDoor(m, { zoneId: "p1", side: "e", id: "d_e" });
    expect(findInteriorDoor(m, "d_e")!.door).toMatchObject({ side: "e", type: "stallSlide" });
    expect(derivePartitions(m).some((p) => p.doors.some((d) => d.id === "d_e"))).toBe(true);
    m = addZoneDoor(m, { zoneId: "p1", side: "w", id: "d_w" });
    const dutch = m.openings.find((o) => o.id === "d_w")!;
    expect(dutch).toMatchObject({ wallId: "wall_ext_w", type: "dutchDoor" });
    expect(dutch.offsetFt + dutch.widthFt / 2).toBeCloseTo(m.footprint.kind === "rect" ? m.footprint.dFt - 5 : 0, 5);
    // A room on the west wall gets an entry door there.
    m = addZone(m, { type: "tack", rect: { x: 0, y: 10, w: 10, d: 8 }, id: "t" });
    m = addZoneDoor(m, { zoneId: "t", side: "w", id: "d_t" });
    expect(m.openings.find((o) => o.id === "d_t")).toMatchObject({ wallId: "wall_ext_w", type: "manDoor", widthFt: 3 });
  });
});
