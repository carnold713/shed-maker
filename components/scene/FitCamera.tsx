"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Geometry } from "@/lib/geometry";

/**
 * Frames the building's bounding sphere from a fixed south-east, elevated
 * direction, respecting the viewport aspect. Re-fits when the bounds change
 * (footprint/roof edits), which also resets any user orbit — acceptable for M0.
 */
export function FitCamera({ bounds }: { bounds: Geometry["bounds"] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;

  const key = bounds.min.join(",") + "|" + bounds.max.join(",");
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const min = new THREE.Vector3(...bounds.min);
    const max = new THREE.Vector3(...bounds.max);
    const center = min.clone().add(max).multiplyScalar(0.5);
    const radius = max.clone().sub(min).length() / 2;
    const aspect = size.width / Math.max(1, size.height);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fitFov = Math.min(vFov, hFov);
    const distance = (radius / Math.sin(fitFov / 2)) * 1.05;
    const dir = new THREE.Vector3(0.9, 0.55, 1.0).normalize(); // south-east, above
    const target = new THREE.Vector3(center.x, (min.y + max.y) * 0.35, center.z);
    camera.position.copy(target.clone().add(dir.multiplyScalar(distance)));
    camera.near = Math.max(0.1, distance / 100);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target);
      controls.update();
    } else {
      camera.lookAt(target);
    }
    // `key` stands in for the bounds object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, camera, size.width, size.height, controls]);

  return null;
}
