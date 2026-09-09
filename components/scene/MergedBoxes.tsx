"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type { BoxMember } from "@/lib/geometry";
import { cornerUv, type Axis, type UvRule } from "./boxUv";
import type { TextureSet } from "./textures";

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();

// Six faces of a unit box: outward axis, sign, and the four corners (CCW seen from outside).
const FACES: { axis: Axis; sign: 1 | -1; corners: [number, number, number][] }[] = [
  { axis: 0, sign: 1, corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { axis: 0, sign: -1, corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { axis: 1, sign: 1, corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { axis: 1, sign: -1, corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { axis: 2, sign: 1, corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { axis: 2, sign: -1, corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

/**
 * One mesh per material group: every box's six faces merged into a single
 * geometry with texture coordinates in feet oriented for the material (wood
 * grain along the member, steel ribs vertical or down the slope). One draw
 * call per material, correct PBR maps on both the WebGL and WebGPU
 * backends, and picking maps the hit face back to its box.
 */
export function MergedBoxes({
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
  textures,
  uvRule = "plain",
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
  /** PBR maps for this material, or null for a plain colour. */
  textures?: TextureSet | null;
  uvRule?: UvRule;
  clippingPlanes: THREE.Plane[];
  onClick?: (box: BoxMember, e: ThreeEvent<MouseEvent>) => void;
  onContextMenu?: (box: BoxMember, e: ThreeEvent<MouseEvent>) => void;
  onHover?: (box: BoxMember | null) => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const meshRef = useRef<THREE.Mesh>(null);
  const count = boxes.length;

  // Geometry: 24 vertices and 12 triangles per box.
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 24 * 3);
    const normals = new Float32Array(count * 24 * 3);
    const uvs = new Float32Array(count * 24 * 2);
    const colors = new Float32Array(count * 24 * 3);
    const index = new Uint32Array(count * 36);
    const rot = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const b = boxes[i];
      const size: [number, number, number] = [Math.max(b.size[0], 1e-4), Math.max(b.size[1], 1e-4), Math.max(b.size[2], 1e-4)];
      tmpObj.position.set(b.center[0], b.center[1], b.center[2]);
      tmpObj.rotation.set(b.rotation[0], b.rotation[1], b.rotation[2]);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      rot.copy(tmpObj.matrix);
      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        tmpN.set(0, 0, 0);
        tmpN.setComponent(face.axis, face.sign);
        tmpN.transformDirection(rot);
        for (let c = 0; c < 4; c++) {
          const corner = face.corners[c];
          const local: [number, number, number] = [(corner[0] * size[0]) / 2, (corner[1] * size[1]) / 2, (corner[2] * size[2]) / 2];
          tmpV.set(local[0], local[1], local[2]).applyMatrix4(rot);
          const vi = (i * 24 + f * 4 + c);
          positions[vi * 3] = tmpV.x;
          positions[vi * 3 + 1] = tmpV.y;
          positions[vi * 3 + 2] = tmpV.z;
          normals[vi * 3] = tmpN.x;
          normals[vi * 3 + 1] = tmpN.y;
          normals[vi * 3 + 2] = tmpN.z;
          const [u, v] = cornerUv(local, size, face.axis, uvRule);
          uvs[vi * 2] = u;
          uvs[vi * 2 + 1] = v;
        }
        const base = i * 24 + f * 4;
        const ti = (i * 6 + f) * 6;
        index[ti] = base;
        index[ti + 1] = base + 1;
        index[ti + 2] = base + 2;
        index[ti + 3] = base;
        index[ti + 4] = base + 2;
        index[ti + 5] = base + 3;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeBoundingSphere();
    return g;
  }, [boxes, count, uvRule]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Colours: the material's colour, or the selection / hover tint, per box.
  useEffect(() => {
    const attr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const b = boxes[i];
      const isSel = selection !== null && (b.id === selection || b.entityId === selection);
      const isHov = hovered !== null && (b.id === hovered || b.entityId === hovered);
      tmpColor.set(isSel ? selectedColor : isHov ? hoverColor : color);
      for (let v = 0; v < 24; v++) {
        const o = (i * 24 + v) * 3;
        arr[o] = tmpColor.r;
        arr[o + 1] = tmpColor.g;
        arr[o + 2] = tmpColor.b;
      }
    }
    attr.needsUpdate = true;
    invalidate();
  }, [geometry, boxes, count, selection, hovered, color, selectedColor, hoverColor, invalidate]);

  // One material for the life of the component; mutated in place.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, clipShadows: true, vertexColors: true }), []);
  useEffect(() => {
    material.roughness = roughness;
    material.metalness = metalness;
    material.transparent = transparent;
    material.opacity = opacity;
    material.emissive.set(emissive ?? "#000000");
    material.emissiveIntensity = emissive ? emissiveIntensity : 0;
    material.clippingPlanes = clippingPlanes;
    if (textures) {
      const rep = 1 / textures.tileFt;
      for (const t of [textures.map, textures.normalMap, textures.roughnessMap]) t.repeat.set(rep, rep);
      material.map = textures.map;
      material.normalMap = textures.normalMap;
      material.normalScale.set(textures.normalScale, textures.normalScale);
      material.roughnessMap = textures.roughnessMap;
      material.roughness = 1; // the map carries it
    } else {
      material.map = null;
      material.normalMap = null;
      material.roughnessMap = null;
    }
    material.needsUpdate = true;
    invalidate();
  }, [material, roughness, metalness, transparent, opacity, emissive, emissiveIntensity, clippingPlanes, textures, invalidate]);
  useEffect(() => () => material.dispose(), [material]);

  if (count === 0) return null;
  const boxAt = (e: ThreeEvent<MouseEvent | PointerEvent>) => (e.faceIndex === undefined || e.faceIndex === null ? null : boxes[Math.floor(e.faceIndex / 12)] ?? null);
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
      frustumCulled={false}
      onClick={(e) => {
        const b = boxAt(e);
        if (!b) return;
        e.stopPropagation();
        onClick?.(b, e);
      }}
      onContextMenu={(e) => {
        const b = boxAt(e);
        if (!b) return;
        e.stopPropagation();
        onContextMenu?.(b, e);
      }}
      onPointerOver={(e) => {
        const b = boxAt(e);
        if (!b) return;
        e.stopPropagation();
        onHover?.(b);
      }}
      onPointerOut={() => onHover?.(null)}
    />
  );
}
