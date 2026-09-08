"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { BoxMember } from "@/lib/geometry";

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * One InstancedMesh per material group. Thousands of framing members render
 * as a single draw call (SPEC §8.4). Picking maps instanceId back to the box.
 */
export function InstancedBoxes({
  boxes,
  color,
  selectedColor = "#b5532a",
  hoverColor = "#d98a5f",
  selection,
  hovered,
  roughness = 0.85,
  metalness = 0.02,
  transparent = false,
  opacity = 1,
  emissive,
  emissiveIntensity = 0,
  clippingPlanes,
  onClick,
  onContextMenu,
  onHover,
}: {
  boxes: BoxMember[];
  color: string;
  selectedColor?: string;
  hoverColor?: string;
  selection: string | null;
  hovered: string | null;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  /** Self-lit surfaces (light fixtures). */
  emissive?: string;
  emissiveIntensity?: number;
  clippingPlanes: THREE.Plane[];
  onClick?: (box: BoxMember, e: ThreeEvent<MouseEvent>) => void;
  onContextMenu?: (box: BoxMember, e: ThreeEvent<MouseEvent>) => void;
  onHover?: (box: BoxMember | null) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = boxes.length;
  const invalidate = useThree((s) => s.invalidate);

  // Positions/sizes only change when the geometry changes.
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const b = boxes[i];
      tmpObj.position.set(b.center[0], b.center[1], b.center[2]);
      tmpObj.rotation.set(b.rotation[0], b.rotation[1], b.rotation[2]);
      tmpObj.scale.set(Math.max(b.size[0], 1e-4), Math.max(b.size[1], 1e-4), Math.max(b.size[2], 1e-4));
      tmpObj.updateMatrix();
      mesh.setMatrixAt(i, tmpObj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [boxes, count, invalidate]);

  // Colors change with selection/hover.
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const b = boxes[i];
      const isSel = selection !== null && (b.id === selection || b.entityId === selection);
      const isHov = hovered !== null && (b.id === hovered || b.entityId === hovered);
      tmpColor.set(isSel ? selectedColor : isHov ? hoverColor : color);
      mesh.setColorAt(i, tmpColor);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [boxes, count, selection, hovered, color, selectedColor, hoverColor, invalidate]);

  // One material for the life of the component; mutate it so the InstancedMesh is never rebuilt
  // (a rebuilt mesh would lose the per-instance matrices set in the effect above).
  const material = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, clipShadows: true }), []);
  useEffect(() => {
    material.roughness = roughness;
    material.metalness = metalness;
    material.transparent = transparent;
    material.opacity = opacity;
    material.emissive.set(emissive ?? "#000000");
    material.emissiveIntensity = emissive ? emissiveIntensity : 0;
    material.clippingPlanes = clippingPlanes;
    material.needsUpdate = true;
    invalidate();
  }, [material, roughness, metalness, transparent, opacity, emissive, emissiveIntensity, clippingPlanes, invalidate]);
  useEffect(() => () => material.dispose(), [material]);

  if (count === 0) return null;
  return (
    <instancedMesh
      key={count}
      ref={ref}
      args={[unitBox, material, count]}
      castShadow
      receiveShadow
      frustumCulled={false}
      onClick={(e) => {
        if (e.instanceId === undefined) return;
        e.stopPropagation();
        onClick?.(boxes[e.instanceId], e);
      }}
      onContextMenu={(e) => {
        if (e.instanceId === undefined) return;
        e.stopPropagation();
        onContextMenu?.(boxes[e.instanceId], e);
      }}
      onPointerOver={(e) => {
        if (e.instanceId === undefined) return;
        e.stopPropagation();
        onHover?.(boxes[e.instanceId]);
      }}
      onPointerOut={() => onHover?.(null)}
    />
  );
}
