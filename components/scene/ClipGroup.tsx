"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Clipping for both backends. The WebGL renderer honours per-material
 * `clippingPlanes`; the WebGPU renderer clips via a ClippingGroup ancestor.
 * We do both: materials carry the planes, and on WebGPU the whole building
 * is parented under a ClippingGroup that holds the same planes.
 */
export function ClipGroup({ planes, children }: { planes: THREE.Plane[]; children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const isWebGPU = (gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer === true;
  const [group, setGroup] = useState<(THREE.Group & { clippingPlanes: THREE.Plane[]; enabled: boolean }) | null>(null);

  useEffect(() => {
    if (!isWebGPU) return;
    let alive = true;
    import("three/webgpu").then(({ ClippingGroup }) => {
      if (!alive) return;
      setGroup(new ClippingGroup() as unknown as THREE.Group & { clippingPlanes: THREE.Plane[]; enabled: boolean });
    });
    return () => {
      alive = false;
    };
  }, [isWebGPU]);

  useEffect(() => {
    if (!group) return;
    group.clippingPlanes = planes;
    group.enabled = planes.length > 0;
    invalidate();
  }, [group, planes, invalidate]);

  if (!isWebGPU || !group) return <>{children}</>;
  return <primitive object={group}>{children}</primitive>;
}
