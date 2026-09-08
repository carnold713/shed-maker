"use client";

import { ALL_LAYERS, LAYER_LABEL, PRESET_LABEL, useViewStore, type ViewPreset } from "@/lib/store/useViewStore";
import { Popover, MenuRow, MenuLabel, MenuDivider } from "@/components/ui/Popover";
import { Icon } from "@/components/ui/Icon";

const PRESETS: { id: ViewPreset; hint: string; testId: string }[] = [
  { id: "exterior", hint: "The finished barn from outside, roof on", testId: "view-outside" },
  { id: "noRoof", hint: "The finished barn with the roof off, so you can see inside", testId: "view-noroof" },
  { id: "framing", hint: "Posts, girts and partitions only, no roof", testId: "view-framing" },
  { id: "interior", hint: "Stand in the aisle", testId: "view-inside" },
];

/** View ▾ (UX audit §2.9): one place for the 3D preset, white model, camera and layers. */
export function ViewMenu() {
  const preset = useViewStore((s) => s.preset);
  const setPreset = useViewStore((s) => s.setPreset);
  const renderMode = useViewStore((s) => s.renderMode);
  const setRenderMode = useViewStore((s) => s.setRenderMode);
  const iso = useViewStore((s) => s.isometric);
  const setIso = useViewStore((s) => s.setIsometric);
  const visible = useViewStore((s) => s.visibleLayers);
  const toggleLayer = useViewStore((s) => s.toggleLayer);

  return (
    <Popover
      testId="view-menu"
      panelTestId="view-presets"
      button={(open) => (
        <button className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium transition ${open ? "bg-foreground text-background" : "text-foreground hover:bg-black/5"}`} aria-haspopup="menu" aria-expanded={open} title="How the 3D view looks">
          <Icon name="cube" size={16} /> {PRESET_LABEL[preset]} <Icon name="chevron" size={14} />
        </button>
      )}
    >
      <MenuLabel>3D view</MenuLabel>
      {PRESETS.map((p) => (
        <MenuRow key={p.id} active={preset === p.id} onClick={() => setPreset(p.id)} hint={p.hint} testId={p.testId}>
          {PRESET_LABEL[p.id]}
        </MenuRow>
      ))}
      <MenuDivider />
      <MenuRow active={renderMode === "white"} onClick={() => setRenderMode(renderMode === "white" ? "realistic" : "white")} hint="Plain white model instead of your colours">
        Plain white
      </MenuRow>
      <MenuRow active={iso} onClick={() => setIso(!iso)} hint="Flat, game-like camera with no perspective (I)" testId="iso-toggle">
        No perspective
      </MenuRow>
      <MenuDivider />
      <MenuLabel>Show</MenuLabel>
      <div className="grid grid-cols-2 gap-x-2 px-1">
        {ALL_LAYERS.map((l) => (
          <label key={l} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 text-xs hover:bg-black/5">
            <input type="checkbox" checked={visible.has(l)} onChange={() => toggleLayer(l)} /> {LAYER_LABEL[l]}
          </label>
        ))}
      </div>
    </Popover>
  );
}
