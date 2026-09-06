"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Geometry, PolygonMember } from "@/lib/geometry";
import type { MaterialChoices } from "@/lib/model/schema";
import { useProjectStore } from "@/lib/store/useProjectStore";

const SELECT = "#b5532a";

export function BuildingScene({ geometry, materials }: { geometry: Geometry; materials: MaterialChoices }) {
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);

  return (
    <group>
      {geometry.boxes.map((b) => {
        const selected = selection === b.entityId || (selection === "footprint" && b.kind === "wallPanel");
        const color =
          b.kind === "slab" ? "#b9b6ae" : b.kind === "roofPlane" ? materials.roofColor : b.kind === "wallPanel" ? materials.sidingColor : "#c9a36b";
        return (
          <mesh
            key={b.id}
            position={b.center}
            rotation={b.rotation}
            castShadow
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              select(b.kind === "wallPanel" ? "footprint" : b.entityId);
            }}
          >
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={selected ? SELECT : color} roughness={b.kind === "roofPlane" ? 0.5 : 0.8} metalness={b.kind === "roofPlane" ? 0.3 : 0.05} />
          </mesh>
        );
      })}
      {geometry.polygons.map((p) => (
        <Polygon key={p.id} member={p} color={selection === "footprint" ? SELECT : materials.sidingColor} onClick={() => select("footprint")} />
      ))}
    </group>
  );
}

function Polygon({ member, color, onClick }: { member: PolygonMember; color: string; onClick: () => void }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = member.vertices;
    const positions: number[] = [];
    for (let i = 1; i < verts.length - 1; i++) {
      positions.push(...verts[0], ...verts[i], ...verts[i + 1]);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [member]);
  return (
    <mesh
      geometry={geom}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.8} />
    </mesh>
  );
}
