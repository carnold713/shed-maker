"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useMemo } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { deriveGeometry } from "@/lib/geometry";
import { BuildingScene } from "./BuildingScene";
import { FitCamera } from "./FitCamera";

/**
 * Exterior orbit view (SPEC §8.1). Geometry is derived from the model on every
 * change; interior/cutaway/framing views arrive in M1–M2.
 */
export function Viewer() {
  const model = useProjectStore((s) => s.model);
  const geometry = useMemo(() => (model ? deriveGeometry(model) : null), [model]);
  if (!model || !geometry) return null;

  const [minX, , minZ] = geometry.bounds.min;
  const [maxX, , maxZ] = geometry.bounds.max;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  return (
    <div className="relative h-full w-full" data-testid="viewer">
      <Canvas
        shadows
        camera={{ position: [cx + 60, 40, cz + 70], fov: 38, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#e9eef2"]} />
        <hemisphereLight args={["#ffffff", "#8f9aa5", 0.7]} />
        <directionalLight
          position={[cx + 40, 60, cz + 30]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />
        <FitCamera bounds={geometry.bounds} />
        <BuildingScene geometry={geometry} materials={model.materials} />
        <Grid
          position={[cx, -0.01, cz]}
          args={[400, 400]}
          cellSize={2}
          sectionSize={10}
          cellColor="#c7ced4"
          sectionColor="#9aa5ad"
          fadeDistance={220}
          infiniteGrid
        />
        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.02} minDistance={8} maxDistance={400} makeDefault />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[11px] text-muted">
        Exterior · drag to orbit · scroll to zoom · ridge {geometry.ridgeHeightFt.toFixed(1)}&apos;
      </div>
    </div>
  );
}
