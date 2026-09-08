import type { MenuItem } from "./ContextMenu";
import type { ContextTarget } from "@/lib/store/useViewStore";
import { useViewStore, ALL_LAYERS, LAYER_LABEL } from "@/lib/store/useViewStore";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { DOOR_TYPES, OPENING_PRESETS, DOOR_PALETTE, WINDOW_PALETTE } from "@/lib/model/openings";
import { LEAN_TO_DEPTHS_FT } from "@/lib/model/leanTos";
import type { OpeningType } from "@/lib/model/schema";
import { formatFtIn } from "@/lib/units";
import { getRule } from "@/rules";
import { PEN_SPECIES, SPECIES_PRESETS } from "@/rules/animals/presets";
import { ROOM_PRESETS, ZONE_TYPE_LABEL, defaultPenSize, zoneRect } from "@/lib/model/zones";
import type { FixtureKind, InteriorDoorType, Species, ZoneType } from "@/lib/model/schema";
import { INTERIOR_DOOR_PRESETS, INTERIOR_DOOR_TYPES, findInteriorDoor } from "@/lib/model/interiorDoors";
import { FIXTURE_PRESETS, PLACEABLE_FIXTURE_KINDS } from "@/lib/model/electrical";
import { PRESET_LABEL } from "@/lib/store/useViewStore";

/**
 * Context-menu definitions (SPEC §21.1), keyed by what was right-clicked.
 * Reads the stores directly so menus stay in sync with the model.
 */
export function buildMenu(t: ContextTarget, opts: { screenshot?: () => void } = {}): MenuItem[] {
  const ps = useProjectStore.getState();
  const vs = useViewStore.getState();
  const model = ps.model;
  if (!model) return [];

  const sizeItems = (type: OpeningType, apply: (w: number, h: number) => void): MenuItem[] =>
    OPENING_PRESETS[type].sizes.map(([w, h]) => ({ label: `${formatFtIn(w)} × ${formatFtIn(h)}`, onSelect: () => apply(w, h) }));

  const addOpeningItems = (wallId: string, uFt?: number): MenuItem[] => [
    {
      label: "Add door",
      children: DOOR_PALETTE.map((d) => ({
        label: d.label,
        onSelect: () => {
          const id = ps.addOpening({ wallId, type: d.type, centerFt: uFt, widthFt: d.widthFt, heightFt: d.heightFt, sillFt: d.sillFt, swing: d.swing, variant: d.variant });
          if (id) ps.select(id);
        },
      })),
    },
    {
      label: "Add window",
      children: WINDOW_PALETTE.map((w) => ({
        label: w.label,
        onSelect: () => {
          const id = ps.addOpening({ wallId, type: "window", centerFt: uFt, widthFt: w.widthFt, heightFt: w.heightFt, sillFt: w.sillFt, variant: w.variant });
          if (id) ps.select(id);
        },
      })),
    },
  ];

  const viewItems: MenuItem[] = [
    {
      label: "View",
      children: (["exterior", "interior", "framing", "dollhouse"] as const).map((p) => ({ label: `${vs.preset === p ? "✓ " : "   "}${PRESET_LABEL[p]}`, onSelect: () => vs.setPreset(p) })),
    },
    {
      label: "Layers",
      children: ALL_LAYERS.map((l) => ({ label: `${vs.visibleLayers.has(l) ? "✓ " : "   "}${LAYER_LABEL[l]}`, onSelect: () => vs.toggleLayer(l) })),
    },
    { label: vs.renderMode === "white" ? "Your colours" : "Plain white model", onSelect: () => vs.setRenderMode(vs.renderMode === "white" ? "realistic" : "white") },
    { label: `${vs.isometric ? "✓ " : "   "}No perspective`, onSelect: () => vs.setIsometric(!vs.isometric), shortcut: "I" },
    { label: vs.cutHeightFt === null ? "Cutaway at 4'" : "Remove cutaway", onSelect: () => vs.setCutHeight(vs.cutHeightFt === null ? 4 : null), shortcut: "X" },
    { separator: true, label: "" },
    { label: "Zoom to fit", onSelect: () => vs.requestFit(), shortcut: "F" },
    ...(opts.screenshot ? [{ label: "Screenshot (PNG)", onSelect: opts.screenshot }] : []),
  ];

  switch (t.kind) {
    case "wall": {
      const wall = model.walls.find((w) => w.id === t.id);
      if (!wall) return [];
      const hasLeanTo = model.leanTos.some((l) => l.side === wall.side);
      return [
        ...addOpeningItems(wall.id, t.uFt),
        {
          label: hasLeanTo ? "Lean-to on this side (exists)" : "Add lean-to on this side",
          disabled: hasLeanTo,
          children: hasLeanTo
            ? undefined
            : LEAN_TO_DEPTHS_FT.map((d) => ({ label: `${d}' deep · open`, onSelect: () => { const id = ps.addLeanTo({ side: wall.side!, depthFt: d }); if (id) ps.select(id); } })).concat([
                { label: "12' deep · enclosed", onSelect: () => { const id = ps.addLeanTo({ side: wall.side!, depthFt: 12, enclosed: true }); if (id) ps.select(id); } },
              ]),
        },
        { separator: true, label: "" },
        {
          label: "Girts",
          children: [
            { label: `${model.frame.girts.mount === "face" ? "✓ " : "   "}Face-mounted`, onSelect: () => ps.setFrame({ girts: { mount: "face" } }) },
            { label: `${model.frame.girts.mount === "bookshelf" ? "✓ " : "   "}Bookshelf`, onSelect: () => ps.setFrame({ girts: { mount: "bookshelf" } }) },
            { separator: true, label: "" },
            { label: `${model.frame.girts.size === "2x4" ? "✓ " : "   "}2×4`, onSelect: () => ps.setFrame({ girts: { size: "2x4" } }) },
            { label: `${model.frame.girts.size === "2x6" ? "✓ " : "   "}2×6`, onSelect: () => ps.setFrame({ girts: { size: "2x6" } }) },
          ],
        },
        { label: "Properties", onSelect: () => ps.select("footprint") },
      ];
    }
    case "opening": {
      const o = model.openings.find((x) => x.id === t.id);
      if (!o) return [];
      const types: OpeningType[] = o.type === "window" ? ["window"] : [...DOOR_TYPES];
      return [
        {
          label: "Change type",
          children: types.filter((x) => x !== o.type).map((type) => ({ label: OPENING_PRESETS[type].label, onSelect: () => ps.updateOpening(o.id, { type }) })),
        },
        { label: "Change size", children: sizeItems(o.type, (w, h) => ps.updateOpening(o.id, { widthFt: w, heightFt: h })) },
        { label: o.type === "slidingDoor" || o.type === "stallDoor" ? "Flip slide direction" : "Flip swing", onSelect: () => ps.flipOpeningSwing(o.id), disabled: o.swing === "none" || o.swing === "biParting" },
        ...(o.type === "slidingDoor" ? [{ label: o.swing === "biParting" ? "Single leaf" : "Bi-parting", onSelect: () => ps.updateOpening(o.id, { swing: o.swing === "biParting" ? "slideRight" : "biParting" }) }] : []),
        { separator: true, label: "" },
        { label: "Center on wall", onSelect: () => ps.centerOpening(o.id, "wall") },
        { label: "Center in bay", onSelect: () => ps.centerOpening(o.id, "bay") },
        { label: "Nudge", children: [
          { label: "← 1\"", onSelect: () => ps.moveOpening(o.id, o.offsetFt - 1 / 12) },
          { label: "→ 1\"", onSelect: () => ps.moveOpening(o.id, o.offsetFt + 1 / 12) },
          { label: "← 1'", onSelect: () => ps.moveOpening(o.id, o.offsetFt - 1) },
          { label: "→ 1'", onSelect: () => ps.moveOpening(o.id, o.offsetFt + 1) },
        ] },
        { separator: true, label: "" },
        { label: "Properties", onSelect: () => ps.select(o.id) },
        { label: "Delete", onSelect: () => ps.removeOpening(o.id), danger: true, shortcut: "Del" },
      ];
    }
    case "member": {
      const rule = t.id ? getRule(t.id) : undefined;
      return [
        { label: "Show rule", onSelect: () => ps.select(t.id ?? null) },
        ...(rule ? [{ label: `${rule.id} · ${rule.source}`, disabled: true }] : []),
        { separator: true, label: "" },
        {
          label: "Post size",
          children: (["4x6", "6x6", "6x8", "3ply2x6"] as const).map((size) => ({ label: `${model.frame.post.size === size ? "✓ " : "   "}${size.replace("x", "×").replace("3ply", "3-ply ")}`, onSelect: () => ps.setFrame({ post: { size } }) })),
        },
        {
          label: "Bay spacing",
          children: [8, 10, 12].map((b) => ({ label: `${model.frame.bayFt === b ? "✓ " : "   "}${b}'`, onSelect: () => ps.setFrame({ bayFt: b }) })),
        },
        { label: "Isolate framing view", onSelect: () => vs.setPreset("framing") },
      ];
    }
    case "roof":
      return [
        { label: "Form", children: [
          { label: `${model.roof.form === "gable" ? "✓ " : "   "}Gable`, onSelect: () => ps.setRoof({ form: "gable" }) },
          { label: `${model.roof.form === "shed" ? "✓ " : "   "}Shed`, onSelect: () => ps.setRoof({ form: "shed" }) },
        ] },
        { label: "Pitch", children: [3, 4, 5, 6, 8].map((p) => ({ label: `${model.roof.pitch === p ? "✓ " : "   "}${p}:12`, onSelect: () => ps.setRoof({ pitch: p }) })) },
        { label: "Overhang", children: [0, 6, 12, 18, 24].map((o) => ({ label: `${model.roof.overhangEaveIn === o ? "✓ " : "   "}${o}"`, onSelect: () => ps.setRoof({ overhangEaveIn: o, overhangGableIn: o }) })) },
        { label: "Ridge runs", children: [
          { label: `${model.roof.ridgeAxis === "ns" ? "✓ " : "   "}North–south`, onSelect: () => ps.setRoof({ ridgeAxis: "ns" }) },
          { label: `${model.roof.ridgeAxis === "ew" ? "✓ " : "   "}East–west`, onSelect: () => ps.setRoof({ ridgeAxis: "ew" }) },
        ] },
        { separator: true, label: "" },
        { label: "See inside (cutaway)", onSelect: () => vs.setPreset("dollhouse") },
        ...viewItems,
      ];
    case "footprint":
      return [
        { label: "Snap to 2' module", onSelect: () => ps.snapFootprintToModule(2) },
        { label: "Properties", onSelect: () => ps.select("footprint") },
        { separator: true, label: "" },
        ...viewItems,
      ];
    case "zone": {
      const z = model.zones.find((x) => x.id === t.id);
      if (!z) return [];
      const r = zoneRect(z);
      const alongDir = model.roof.ridgeAxis === "ns" ? "n" : "e";
      const preset = z.species ? SPECIES_PRESETS[z.species] : null;
      return [
        ...(z.type === "pen" || z.type === "kidding"
          ? [{ label: "Species", children: PEN_SPECIES.map((sp) => ({ label: `${z.species === sp ? "✓ " : "   "}${SPECIES_PRESETS[sp].label}`, onSelect: () => ps.updateZone(z.id, { species: sp }) })) }]
          : []),
        { label: "Change type", children: (["pen", "aisle", "tack", "feed", "hay", "wash", "equipment", "office", "utility", "open"] as ZoneType[]).filter((x) => x !== z.type).map((type) => ({ label: ZONE_TYPE_LABEL[type], onSelect: () => ps.updateZone(z.id, { type }) })) },
        ...(preset
          ? [{ label: "Resize to", children: [preset.minPen, preset.recommendedPen, [14, 16] as [number, number], [16, 16] as [number, number]].map(([w, d]) => ({ label: `${w}×${d}`, onSelect: () => ps.resizeZone(z.id, { ...r, w, d }, vs.autoGrow) })) }]
          : []),
        ...(z.type === "pen" ? [{ label: `${z.outsideAccess ? "✓ " : "   "}Door to the outside (Dutch door)`, onSelect: () => ps.setOutsideAccess(z.id, !z.outsideAccess) }] : []),
        ...(z.type !== "aisle" && z.type !== "open"
          ? [
              {
                label: "Add a door",
                children: INTERIOR_DOOR_TYPES.map((t: InteriorDoorType) => ({
                  label: INTERIOR_DOOR_PRESETS[t].label,
                  onSelect: () => {
                    vs.setToolInteriorDoorType(t);
                    vs.setTool("interiorDoor");
                  },
                })),
              },
              ...(z.doors.length === 0 ? [{ label: `${z.autoDoor ? "✓ " : "   "}Default door to the aisle`, onSelect: () => ps.setAutoDoor(z.id, !z.autoDoor) }] : []),
            ]
          : []),
        { separator: true, label: "" },
        { label: "Add another beside it", onSelect: () => ps.duplicateZone(z.id, alongDir), shortcut: "Ctrl+D" },
        { label: "Array", children: [2, 3, 4, 6].map((n) => ({ label: `${n} more along the bays`, onSelect: () => ps.arrayZone(z.id, n, alongDir) })) },
        { label: "Split", children: [
          { label: "In halves", onSelect: () => ps.splitZone(z.id, 2) },
          { label: "In thirds", onSelect: () => ps.splitZone(z.id, 3) },
          { label: "Halves across", onSelect: () => ps.splitZone(z.id, 2, r.w >= r.d ? "y" : "x") },
        ] },
        { separator: true, label: "" },
        { label: "Properties", onSelect: () => ps.select(z.id) },
        { label: "Delete", onSelect: () => ps.removeZone(z.id), danger: true, shortcut: "Del" },
      ];
    }
    case "leanTo": {
      const lt = model.leanTos.find((l) => l.id === t.id);
      if (!lt) return [];
      return [
        { label: "Depth", children: LEAN_TO_DEPTHS_FT.map((d) => ({ label: `${lt.depthFt === d ? "✓ " : "   "}${d}'`, onSelect: () => ps.updateLeanTo(lt.id, { depthFt: d }) })) },
        { label: "Pitch", children: [1, 2, 3, 4].map((p) => ({ label: `${lt.pitch === p ? "✓ " : "   "}${p}:12`, onSelect: () => ps.updateLeanTo(lt.id, { pitch: p }) })) },
        { label: `${lt.enclosed ? "✓ " : "   "}Enclosed`, onSelect: () => ps.updateLeanTo(lt.id, { enclosed: !lt.enclosed }) },
        { label: `${lt.slab ? "✓ " : "   "}Concrete pad`, onSelect: () => ps.updateLeanTo(lt.id, { slab: !lt.slab }) },
        { separator: true, label: "" },
        { label: "Properties", onSelect: () => ps.select(lt.id) },
        { label: "Delete", onSelect: () => ps.removeLeanTo(lt.id), danger: true, shortcut: "Del" },
      ];
    }
    case "interiorDoor": {
      // planX === 1 marks the zone's default (auto) door; id is then the zone id.
      if (t.planX === 1) {
        const z = model.zones.find((x) => x.id === t.id);
        if (!z) return [];
        return [
          { label: "Default door (click it to edit)", disabled: true },
          { label: "Change to", children: INTERIOR_DOOR_TYPES.map((ty) => ({ label: INTERIOR_DOOR_PRESETS[ty].label, onSelect: () => { vs.setToolInteriorDoorType(ty); vs.setTool("interiorDoor"); } })) },
          { separator: true, label: "" },
          { label: "No door here", onSelect: () => ps.setAutoDoor(z.id, false), danger: true },
        ];
      }
      const found = findInteriorDoor(model, t.id ?? "");
      if (!found) return [];
      const { door } = found;
      const preset = INTERIOR_DOOR_PRESETS[door.type];
      return [
        { label: "Change type", children: INTERIOR_DOOR_TYPES.filter((ty) => ty !== door.type).map((ty) => ({ label: INTERIOR_DOOR_PRESETS[ty].label, onSelect: () => ps.updateInteriorDoor(door.id, { type: ty }) })) },
        ...(preset.hinged
          ? [
              { label: door.swing === "in" ? "Swing out (into the aisle)" : "Swing in", onSelect: () => ps.updateInteriorDoor(door.id, { swing: door.swing === "in" ? "out" : "in" }) },
              { label: `Hinges on the ${door.hinge === "left" ? "right" : "left"}`, onSelect: () => ps.updateInteriorDoor(door.id, { hinge: door.hinge === "left" ? "right" : "left" }) },
            ]
          : preset.leaf !== "none"
            ? [{ label: door.swing === "slideLeft" ? "Slide right" : "Slide left", onSelect: () => ps.updateInteriorDoor(door.id, { swing: door.swing === "slideLeft" ? "slideRight" : "slideLeft" }) }]
            : []),
        { label: "Width", children: [3, 3.5, 4, 5, 6].map((w) => ({ label: `${Math.abs(door.widthFt - w) < 1e-6 ? "✓ " : "   "}${w}'`, onSelect: () => ps.updateInteriorDoor(door.id, { widthFt: w }) })) },
        { separator: true, label: "" },
        { label: "Properties", onSelect: () => ps.select(door.id) },
        { label: "Delete", onSelect: () => ps.removeInteriorDoor(door.id), danger: true, shortcut: "Del" },
      ];
    }
    case "fixture": {
      const f = model.electrical.fixtures.find((x) => x.id === t.id);
      if (!f) return [];
      return [
        ...(f.kind !== "panel"
          ? [{ label: "Change to", children: PLACEABLE_FIXTURE_KINDS.filter((k: FixtureKind) => k !== f.kind && k !== "panel").map((k: FixtureKind) => ({ label: FIXTURE_PRESETS[k].label, onSelect: () => ps.updateFixture(f.id, { kind: k }) })) }]
          : []),
        { label: "Height", children: [4, 7, 8, 9, 10, 12].filter((h) => h <= model.eaveHeightFt).map((h) => ({ label: `${Math.abs(f.mountFt - h) < 1e-6 ? "✓ " : "   "}${h}' up`, onSelect: () => ps.updateFixture(f.id, { mountFt: h }) })) },
        { separator: true, label: "" },
        { label: "Properties", onSelect: () => ps.select(f.id) },
        { label: "Delete", onSelect: () => ps.removeFixture(f.id), danger: true, shortcut: "Del" },
      ];
    }
    case "empty": {
      const at = (w: number, d: number) => ({ x: (t.planX ?? 0) - w / 2, y: (t.planY ?? 0) - d / 2, w, d });
      return [
        {
          label: "Add pen here",
          children: PEN_SPECIES.map((sp: Species) => {
            const [w, d] = defaultPenSize(sp);
            return { label: `${SPECIES_PRESETS[sp].label} ${w}×${d}`, onSelect: () => { const id = ps.addZone({ type: "pen", species: sp, rect: at(w, d), autoGrow: vs.autoGrow }); if (id) ps.select(id); } };
          }),
        },
        {
          label: "Add room here",
          children: (["tack", "feed", "hay", "wash", "equipment", "office", "utility"] as ZoneType[]).map((type) => {
            const [w, d] = ROOM_PRESETS[type] ?? [12, 12];
            return { label: ZONE_TYPE_LABEL[type], onSelect: () => { const id = ps.addZone({ type, rect: at(w, d), autoGrow: vs.autoGrow }); if (id) ps.select(id); } };
          }),
        },
        { label: "Add aisle here", onSelect: () => { const ns = model.roof.ridgeAxis === "ns"; const fp = model.footprint.kind === "rect" ? model.footprint : { wFt: 24, dFt: 36 }; const id = ps.addZone({ type: "aisle", rect: ns ? { x: (t.planX ?? 0) - 6, y: 0, w: 12, d: fp.dFt } : { x: 0, y: (t.planY ?? 0) - 6, w: fp.wFt, d: 12 }, autoGrow: vs.autoGrow }); if (id) ps.select(id); } },
        { separator: true, label: "" },
        {
          label: "Fill with layout",
          children: [
            { label: `Center aisle (${SPECIES_PRESETS[vs.toolSpecies as Species]?.label ?? "horse"})`, onSelect: () => ps.applyLayout("centerAisle", { species: vs.toolSpecies as Species }) },
            { label: "Center aisle + tack/feed", onSelect: () => ps.applyLayout("centerAisle", { species: vs.toolSpecies as Species, supportBays: 2 }) },
            { label: "Shed row (outside doors)", onSelect: () => ps.applyLayout("shedRow", { species: vs.toolSpecies as Species }) },
            { label: "Clear interior", onSelect: () => ps.applyLayout("clear"), danger: true },
          ],
        },
        { label: "Shrink building to fit the stalls", onSelect: () => ps.fitEnvelopeToZones(), disabled: model.zones.length === 0 },
        { separator: true, label: "" },
        {
          label: "Add electrical here",
          children: PLACEABLE_FIXTURE_KINDS.map((k: FixtureKind) => ({
            label: FIXTURE_PRESETS[k].label,
            onSelect: () => {
              const id = ps.addFixture({ kind: k, x: t.planX ?? 0, y: t.planY ?? 0 });
              if (id) ps.select(id);
            },
          })),
        },
        { separator: true, label: "" },
        ...viewItems,
      ];
    }
    case "viewport":
    default:
      return viewItems;
  }
}
