"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore, ALL_LAYERS, LAYER_LABEL, type ViewPreset } from "@/lib/store/useViewStore";
import { useDerived } from "@/lib/store/useDerived";
import { BuildingScene } from "./BuildingScene";
import { FitCamera } from "./FitCamera";
import { formatFtIn } from "@/lib/units";

const PRESETS: { id: ViewPreset; label: string }[] = [
  { id: "exterior", label: "Exterior" },
  { id: "framing", label: "Framing" },
  { id: "dollhouse", label: "Dollhouse" },
  { id: "interior", label: "Interior" },
];

/**
 * 3D viewer: exterior orbit, framing-only, dollhouse and interior presets,
 * per-layer visibility, horizontal cutaway via a clipping plane (SPEC §8).
 */
export function Viewer() {
  const model = useProjectStore((s) => s.model);
  const { geometry } = useDerived();
  const preset = useViewStore((s) => s.preset);
  const setPreset = useViewStore((s) => s.setPreset);
  const visible = useViewStore((s) => s.visibleLayers);
  const toggleLayer = useViewStore((s) => s.toggleLayer);
  const cut = useViewStore((s) => s.cutHeightFt);
  const setCut = useViewStore((s) => s.setCutHeight);
  const fitNonce = useViewStore((s) => s.fitNonce);
  const openContextMenu = useViewStore((s) => s.openContextMenu);
  const select = useProjectStore((s) => s.select);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  const clippingPlanes = useMemo(() => (cut === null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)]), [cut]);

  const screenshot = useCallback(() => {
    const gl = glRef.current;
    if (!gl) return;
    const url = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model?.meta.name ?? "barn"}.png`.replace(/[^\w.-]+/g, "_");
    a.click();
  }, [model]);

  useEffect(() => {
    (window as unknown as { __barnScreenshot?: () => void }).__barnScreenshot = screenshot;
  }, [screenshot]);

  if (!model || !geometry) return null;

  const [minX, , minZ] = geometry.bounds.min;
  const [maxX, , maxZ] = geometry.bounds.max;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const eave = model.eaveHeightFt;

  return (
    <div className="relative h-full w-full" data-testid="viewer">
      <Canvas
        shadows
        flat
        camera={{ position: [cx + 60, 40, cz + 70], fov: 38, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.localClippingEnabled = true;
        }}
        onPointerMissed={(e) => {
          if (e.button === 2) {
            e.preventDefault();
            openContextMenu({ kind: "viewport", x: e.clientX, y: e.clientY, from: "3d" });
          } else select(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <color attach="background" args={["#e9eef2"]} />
        <ambientLight intensity={0.35} />
        <hemisphereLight args={["#ffffff", "#8f9aa5", 0.9]} />
        <directionalLight position={[cx + 40, 60, cz + 30]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={80} shadow-camera-bottom={-80} />
        <FitCamera bounds={geometry.bounds} nonce={fitNonce} preset={preset} eaveFt={eave} />
        <BuildingScene geometry={geometry} materials={model.materials} clippingPlanes={clippingPlanes} />
        <Grid position={[cx, -0.01, cz]} args={[400, 400]} cellSize={2} sectionSize={10} cellColor="#c7ced4" sectionColor="#9aa5ad" fadeDistance={220} infiniteGrid />
        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.02} minDistance={2} maxDistance={400} makeDefault mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} />
        <ClipShadowFix />
      </Canvas>

      {/* View presets */}
      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-md border border-border bg-panel/95 p-0.5 text-xs shadow-sm" data-testid="view-presets">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => setPreset(p.id)} aria-pressed={preset === p.id} className={`rounded px-2 py-1 ${preset === p.id ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Layers */}
      <details className="absolute right-3 top-3 rounded-md border border-border bg-panel/95 text-xs shadow-sm">
        <summary className="cursor-pointer select-none px-2 py-1 text-muted">Layers</summary>
        <ul className="px-2 pb-2">
          {ALL_LAYERS.map((l) => (
            <li key={l}>
              <label className="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={visible.has(l)} onChange={() => toggleLayer(l)} />
                {LAYER_LABEL[l]}
              </label>
            </li>
          ))}
        </ul>
      </details>

      {/* Cutaway */}
      <div className="absolute bottom-8 left-3 flex items-center gap-2 rounded-md border border-border bg-panel/95 px-2 py-1 text-xs shadow-sm">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={cut !== null} onChange={(e) => setCut(e.target.checked ? 4 : null)} data-testid="cut-toggle" />
          Cut at
        </label>
        <input type="range" min={0.5} max={Math.ceil(geometry.ridgeHeightFt)} step={0.25} value={cut ?? 4} disabled={cut === null} onChange={(e) => setCut(Number(e.target.value))} className="w-28" />
        <span className="w-12 font-mono">{formatFtIn(cut ?? 4)}</span>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-muted">
        drag orbit · right-drag pan · right-click for menu · ridge {formatFtIn(geometry.ridgeHeightFt)}
      </div>
    </div>
  );
}

/** Keeps the renderer's clipping enabled after context loss / hot reload. */
function ClipShadowFix() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  return null;
}
