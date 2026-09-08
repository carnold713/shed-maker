"use client";

import { ALL_LAYERS, LAYER_LABEL, PRESET_LABEL, useViewStore, type ViewPreset } from "@/lib/store/useViewStore";
import { useDerived } from "@/lib/store/useDerived";
import { formatFtIn } from "@/lib/units";
import { Popover, MenuRow, MenuLabel, MenuDivider } from "@/components/ui/Popover";
import { Icon } from "@/components/ui/Icon";

const PRESETS: { id: ViewPreset; hint: string; testId: string }[] = [
  { id: "exterior", hint: "The finished barn from outside", testId: "view-outside" },
  { id: "interior", hint: "Stand in the aisle", testId: "view-inside" },
  { id: "framing", hint: "Posts, girts, trusses and purlins only", testId: "view-framing" },
  { id: "dollhouse", hint: "Cut the walls at 4' to see inside", testId: "view-cutaway" },
];

/** View ▾ (UX audit §2.9): one place for the 3D preset, cutaway height, white model, camera and layers. */
export function ViewMenu() {
  const preset = useViewStore((s) => s.preset);
  const setPreset = useViewStore((s) => s.setPreset);
  const cut = useViewStore((s) => s.cutHeightFt);
  const setCut = useViewStore((s) => s.setCutHeight);
  const renderMode = useViewStore((s) => s.renderMode);
  const setRenderMode = useViewStore((s) => s.setRenderMode);
  const iso = useViewStore((s) => s.isometric);
  const setIso = useViewStore((s) => s.setIsometric);
  const visible = useViewStore((s) => s.visibleLayers);
  const toggleLayer = useViewStore((s) => s.toggleLayer);
  const { geometry } = useDerived();
  const ridge = geometry?.ridgeHeightFt ?? 16;

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
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={cut !== null} onChange={(e) => setCut(e.target.checked ? 4 : null)} data-testid="cut-toggle" /> Cut at
        </label>
        <input type="range" min={0.5} max={Math.ceil(ridge)} step={0.25} value={cut ?? 4} disabled={cut === null} onChange={(e) => setCut(Number(e.target.value))} className="w-24" aria-label="Cut height" />
        <span className="w-12 font-mono text-foreground">{formatFtIn(cut ?? 4)}</span>
      </div>
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
          <label key={l} className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs hover:bg-black/5">
            <input type="checkbox" checked={visible.has(l)} onChange={() => toggleLayer(l)} /> {LAYER_LABEL[l]}
          </label>
        ))}
      </div>
    </Popover>
  );
}
