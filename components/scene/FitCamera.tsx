"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Geometry } from "@/lib/geometry";
import type { ViewPreset } from "@/lib/store/useViewStore";

/**
 * Frames the building's bounding sphere from a fixed south-east, elevated
 * direction, respecting the viewport aspect. Re-fits when the bounds change,
 * on an explicit request (`nonce`), or when the preset switches. The interior
 * preset drops the camera inside the building at eye height.
 */
export function FitCamera({ bounds, nonce, preset, eaveFt }: { bounds: Geometry["bounds"]; nonce: number; preset: ViewPreset; eaveFt: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;

  const key = bounds.min.join(",") + "|" + bounds.max.join(",");
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const min = new THREE.Vector3(...bounds.min);
    const max = new THREE.Vector3(...bounds.max);
    const center = min.clone().add(max).multiplyScalar(0.5);
    let target: THREE.Vector3;
    let position: THREE.Vector3;
    if (preset === "interior") {
      // Stand near the south end of the building at eye height, looking north up the length.
      const eye = 5 + 8 / 12;
      position = new THREE.Vector3(center.x, Math.min(eye, eaveFt - 1), max.z - 3);
      target = new THREE.Vector3(center.x, Math.min(eye, eaveFt - 1) - 0.5, min.z + 3);
    } else {
      const radius = max.clone().sub(min).length() / 2;
      const aspect = size.width / Math.max(1, size.height);
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.05;
      const dir = new THREE.Vector3(0.9, 0.55, 1.0).normalize();
      target = new THREE.Vector3(center.x, (min.y + max.y) * 0.35, center.z);
      position = target.clone().add(dir.multiplyScalar(distance));
    }
    camera.position.copy(position);
    camera.near = 0.1;
    camera.far = 2000;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target);
      controls.update();
    } else {
      camera.lookAt(target);
    }
    // `key` stands in for the bounds object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, preset, camera, size.width, size.height, controls]);

  return null;
}
