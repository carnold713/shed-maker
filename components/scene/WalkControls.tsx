"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useViewStore } from "@/lib/store/useViewStore";
import { planToWorld } from "@/lib/geometry/frame";

/**
 * First-person camera (street-view style). The camera stands at the walk
 * position at eye height; dragging on the canvas turns it in place (grab the
 * world: drag right looks left), the wheel zooms, W A S D / arrows walk.
 */
export function WalkControls() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const walk = useViewStore((s) => s.walk);
  const setWalk = useViewStore((s) => s.setWalk);

  // Pose the camera from the store.
  useEffect(() => {
    const [x, h, z] = planToWorld(walk.x, walk.y, walk.eyeFt);
    camera.position.set(x, h, z);
    const yaw = THREE.MathUtils.degToRad(walk.yawDeg);
    const pitch = THREE.MathUtils.degToRad(walk.pitchDeg);
    // yaw 0 faces plan north (world -z); clockwise turns east (+x).
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    camera.up.set(0, 1, 0);
    camera.lookAt(camera.position.clone().add(dir));
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = walk.fovDeg;
      camera.near = 0.25;
      camera.far = 2500;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, invalidate, walk.x, walk.y, walk.eyeFt, walk.yawDeg, walk.pitchDeg, walk.fovDeg]);

  // Mouse look, wheel zoom, keys to walk.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    let moved = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      lx = e.clientX;
      ly = e.clientY;
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 0) moved = true;
      const s = useViewStore.getState().walk;
      const scale = 0.22 * (s.fovDeg / 70);
      setWalk({ yawDeg: (((s.yawDeg - dx * scale) % 360) + 360) % 360, pitchDeg: s.pitchDeg + dy * scale });
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      el.releasePointerCapture?.(e.pointerId);
      void moved;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useViewStore.getState().walk;
      setWalk({ fovDeg: s.fovDeg + e.deltaY * 0.05 });
    };
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const s = useViewStore.getState().walk;
      const step = e.shiftKey ? 3 : 1;
      const yaw = THREE.MathUtils.degToRad(s.yawDeg);
      const fwd = { x: Math.sin(yaw), y: Math.cos(yaw) };
      const right = { x: Math.cos(yaw), y: -Math.sin(yaw) };
      let dx = 0;
      let dy = 0;
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          dx = fwd.x; dy = fwd.y; break;
        case "s":
        case "arrowdown":
          dx = -fwd.x; dy = -fwd.y; break;
        case "a":
        case "arrowleft":
          dx = -right.x; dy = -right.y; break;
        case "d":
        case "arrowright":
          dx = right.x; dy = right.y; break;
        case "q":
          setWalk({ yawDeg: (s.yawDeg - 15 + 360) % 360 }); e.preventDefault(); return;
        case "e":
          setWalk({ yawDeg: (s.yawDeg + 15) % 360 }); e.preventDefault(); return;
        default:
          return;
      }
      e.preventDefault();
      setWalk({ x: Math.round((s.x + dx * step) * 2) / 2, y: Math.round((s.y + dy * step) * 2) / 2 });
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
  }, [gl, setWalk]);

  return null;
}
