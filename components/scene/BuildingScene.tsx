"use client";

import { useCallback, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { BoxMember, Geometry, PolygonMember } from "@/lib/geometry";
import type { MaterialChoices } from "@/lib/model/schema";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore, type ContextTarget } from "@/lib/store/useViewStore";
import { InstancedBoxes } from "./InstancedBoxes";

const SELECT = "#b5532a";

type Group = { key: string; boxes: BoxMember[]; color: string; roughness: number; metalness: number; transparent?: boolean; opacity?: number };

/** Selection id for a box: openings select the opening, skins select the footprint, framing selects the member. */
function selectionIdFor(b: BoxMember): string {
  if (b.kind === "wallSkin") return "footprint";
  if (b.kind === "floor" || b.kind === "partition" || b.kind === "grille" || b.kind === "stallDoor") return b.entityId;
  if (b.kind === "framing") return b.id;
  if (b.kind === "roofPlane" || b.kind === "slab") return b.entityId;
  return b.entityId; // opening parts -> opening id
}

function targetFor(b: BoxMember): ContextTarget["kind"] {
  if (b.kind === "wallSkin") return "wall";
  if (b.kind === "floor" || b.kind === "partition" || b.kind === "grille" || b.kind === "stallDoor") return "zone";
  if (b.kind === "leanToSkin" || b.entityId.startsWith("lt_")) return "leanTo";
  if (b.kind === "apron" || b.kind === "gravel") return "footprint";
  if (b.kind === "framing") return "member";
  if (b.kind === "roofPlane") return "roof";
  if (b.kind === "slab") return "footprint";
  return "opening";
}

export function BuildingScene({ geometry, materials, clippingPlanes }: { geometry: Geometry; materials: MaterialChoices; clippingPlanes: THREE.Plane[] }) {
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const visible = useViewStore((s) => s.visibleLayers);
  const renderMode = useViewStore((s) => s.renderMode);
  const hovered = useViewStore((s) => s.hovered);
  const setHovered = useViewStore((s) => s.setHovered);
  const openContextMenu = useViewStore((s) => s.openContextMenu);

  const groups = useMemo<Group[]>(() => {
    const white = renderMode === "white";
    const palette: Record<BoxMember["material"], Omit<Group, "key" | "boxes">> = {
      siding: { color: white ? "#e8e8e6" : materials.sidingColor, roughness: 0.6, metalness: 0.05 },
      roofing: { color: white ? "#d9d9d6" : materials.roofColor, roughness: 0.5, metalness: 0.08 },
      concrete: { color: white ? "#cfcfcc" : "#b9b6ae", roughness: 0.95, metalness: 0 },
      wood: { color: white ? "#dedcd6" : "#c9a36b", roughness: 0.85, metalness: 0 },
      ptWood: { color: white ? "#d3d1cb" : "#9d8a5c", roughness: 0.85, metalness: 0 },
      glass: { color: "#9fc4d8", roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.45 },
      door: { color: white ? "#e2e2df" : materials.trimColor, roughness: 0.6, metalness: 0.1 },
      trim: { color: white ? "#efefec" : materials.trimColor, roughness: 0.6, metalness: 0.05 },
      grille: { color: white ? "#9a9a96" : "#3b3f44", roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.35 },
      mats: { color: white ? "#c9c9c6" : "#3d3b39", roughness: 0.95, metalness: 0 },
      gravel: { color: white ? "#d6d6d2" : "#a8a394", roughness: 1, metalness: 0 },
      dirt: { color: white ? "#d3d0ca" : "#8a6f52", roughness: 1, metalness: 0 },
      floorWood: { color: white ? "#e0ddd6" : "#a67c4f", roughness: 0.8, metalness: 0 },
    };
    const by = new Map<string, Group>();
    for (const b of geometry.boxes) {
      if (!visible.has(b.layer)) continue;
      const key = `${b.material}`;
      let g = by.get(key);
      if (!g) {
        g = { key, boxes: [], ...palette[b.material] };
        by.set(key, g);
      }
      g.boxes.push(b);
    }
    return [...by.values()];
  }, [geometry, materials, visible, renderMode]);

  const onClick = useCallback((b: BoxMember) => select(selectionIdFor(b)), [select]);
  const onContextMenu = useCallback(
    (b: BoxMember, e: ThreeEvent<MouseEvent>) => {
      e.nativeEvent.preventDefault();
      const kind = targetFor(b);
      const id = kind === "wall" ? b.entityId : kind === "member" ? b.id : kind === "roof" ? "roof" : kind === "footprint" ? "footprint" : b.entityId;
      if (kind === "opening" || kind === "member" || kind === "wall" || kind === "zone" || kind === "leanTo") select(kind === "wall" ? "footprint" : id);
      openContextMenu({ kind, id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, from: "3d" });
    },
    [openContextMenu, select],
  );
  const onHover = useCallback((b: BoxMember | null) => setHovered(b ? selectionIdFor(b) : null), [setHovered]);

  return (
    <group>
      {groups.map((g) => (
        <InstancedBoxes
          key={g.key}
          boxes={g.boxes}
          color={g.color}
          roughness={g.roughness}
          metalness={g.metalness}
          transparent={g.transparent}
          opacity={g.opacity}
          selection={selection}
          hovered={hovered}
          clippingPlanes={clippingPlanes}
          onClick={onClick}
          onContextMenu={onContextMenu}
          onHover={onHover}
        />
      ))}
      {geometry.polygons
        .filter((p) => visible.has(p.layer))
        .map((p) => (
          <Polygon
            key={p.id}
            member={p}
            color={selection === "footprint" ? SELECT : renderMode === "white" ? "#e8e8e6" : materials.sidingColor}
            clippingPlanes={clippingPlanes}
            onClick={() => select("footprint")}
            onContextMenu={(e) => {
              e.nativeEvent.preventDefault();
              openContextMenu({ kind: "wall", id: p.entityId, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, from: "3d" });
            }}
          />
        ))}
    </group>
  );
}

function Polygon({ member, color, clippingPlanes, onClick, onContextMenu }: { member: PolygonMember; color: string; clippingPlanes: THREE.Plane[]; onClick: () => void; onContextMenu: (e: ThreeEvent<MouseEvent>) => void }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = member.vertices;
    const positions: number[] = [];
    for (let i = 1; i < verts.length - 1; i++) positions.push(...verts[0], ...verts[i], ...verts[i + 1]);
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
      onContextMenu={(e) => {
        e.stopPropagation();
        onContextMenu(e);
      }}
    >
      <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.6} metalness={0.05} clippingPlanes={clippingPlanes} clipShadows />
    </mesh>
  );
}
