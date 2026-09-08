"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore } from "@/lib/store/useViewStore";
import { useDerived } from "@/lib/store/useDerived";
import { BuildingScene } from "./BuildingScene";
import { FitCamera, CAMERA_FAR_FT, CAMERA_NEAR_FT } from "./FitCamera";
import { Ground } from "./Ground";
import { Lighting } from "./Lighting";
import { createRenderer } from "./renderer";
import { ClipGroup } from "./ClipGroup";
import { PostFX } from "./PostFX";

/**
 * 3D viewer: exterior orbit, framing-only, dollhouse and interior presets,
 * per-layer visibility, horizontal cutaway via a clipping plane (SPEC §8).
 */
export function Viewer() {
  const model = useProjectStore((s) => s.model);
  const { geometry } = useDerived();
  const preset = useViewStore((s) => s.preset);
  const cut = useViewStore((s) => s.cutHeightFt);
  const setHint = useViewStore((s) => s.setHint);
  const fitNonce = useViewStore((s) => s.fitNonce);
  const openContextMenu = useViewStore((s) => s.openContextMenu);
  const select = useProjectStore((s) => s.select);
  const iso = useViewStore((s) => s.isometric);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  const clippingPlanes = useMemo(() => (cut === null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)]), [cut]);

  const screenshot = useCallback(() => {
    const gl = glRef.current;
    if (!gl) return;
    if (sceneRef.current && cameraRef.current) gl.render(sceneRef.current, cameraRef.current);
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

  const [minX, minY, minZ] = geometry.bounds.min;
  const [maxX, maxY, maxZ] = geometry.bounds.max;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2;
  const eave = model.eaveHeightFt;
  const grade = -(model.foundation.slab.aboveGradeIn / 12);

  return (
    <div className="relative h-full w-full" data-testid="viewer" onPointerEnter={() => setHint("Drag to orbit · right-drag to pan · scroll to zoom · click anything for its details")} onPointerLeave={() => setHint(null)}>
      <Canvas
        frameloop="demand"
        shadows="soft"
        camera={{ position: [cx + 60, 40, cz + 70], fov: 34, near: CAMERA_NEAR_FT, far: CAMERA_FAR_FT }}
        dpr={[1, 2]}
        gl={createRenderer}
        onCreated={({ gl, scene, camera }) => {
          glRef.current = gl as THREE.WebGLRenderer;
          sceneRef.current = scene;
          cameraRef.current = camera;
          gl.localClippingEnabled = true;
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        onPointerMissed={(e) => {
          if (e.button === 2) {
            e.preventDefault();
            openContextMenu({ kind: "viewport", x: e.clientX, y: e.clientY, from: "3d" });
          } else select(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <color attach="background" args={["#f3f0ea"]} />
        <fog attach="fog" args={["#f3f0ea", 140, 900]} />
        <Lighting center={[cx, 0, cz]} radius={radius} />
        <PostFX />
        {iso ? <OrthographicCamera makeDefault position={[cx + 80, 70, cz + 80]} zoom={8} near={-500} far={1000} /> : null}
        <FitCamera bounds={geometry.bounds} nonce={fitNonce} preset={preset} eaveFt={eave} iso={iso} />
        <ClipGroup planes={clippingPlanes}>
          <BuildingScene geometry={geometry} materials={model.materials} clippingPlanes={clippingPlanes} />
          <Ground center={[cx, cz]} grade={grade} clippingPlanes={clippingPlanes} />
        </ClipGroup>
        <OrbitControls maxPolarAngle={Math.PI / 2 - 0.02} minDistance={2} maxDistance={400} makeDefault mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} />
        <ClipShadowFix />
      </Canvas>

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
