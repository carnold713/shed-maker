"use client";

import { useCallback, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { BoxMember, Geometry, PolygonMember } from "@/lib/geometry";
import type { MaterialChoices } from "@/lib/model/schema";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { useViewStore, type ContextTarget } from "@/lib/store/useViewStore";
import { MergedBoxes } from "./MergedBoxes";
import { getTextureSet, textureFor, uvRuleFor, type TextureSet } from "./textures";
import type { UvRule } from "./boxUv";

const SELECT = "#b5532a";

type Group = { key: string; boxes: BoxMember[]; color: string; roughness: number; metalness: number; transparent?: boolean; opacity?: number; emissive?: string; emissiveIntensity?: number; textures?: TextureSet | null; uvRule?: UvRule };

/** Selection id for a box: openings select the opening, skins select the footprint, framing selects the member. */
function selectionIdFor(b: BoxMember): string {
  if (b.kind === "wallSkin") return "footprint";
  if (b.kind === "floor" || b.kind === "partition" || b.kind === "grille" || b.kind === "stallDoor" || b.kind === "track" || b.kind === "fixture") return b.entityId;
  if (b.kind === "wire") return "electrical";
  if (b.kind === "drain" || b.kind === "pipe") return b.entityId;
  if (b.kind === "framing") return b.id;
  if (b.kind === "roofPlane" || b.kind === "slab") return b.entityId;
  return b.entityId; // opening parts -> opening id
}

function targetFor(b: BoxMember): ContextTarget["kind"] {
  if (b.kind === "wallSkin") return "wall";
  if (b.kind === "fixture") return "fixture";
  if (b.kind === "drain" && b.entityId !== "drainage") return "drain";
  if (b.kind === "pipe" && b.entityId === "drain_outlet") return "drainOutlet";
  if (b.kind === "drain" || b.kind === "pipe") return "viewport";
  if (b.kind === "wire") return "viewport";
  if (b.kind === "stallDoor" || b.kind === "track") return b.entityId.startsWith("door_") ? "interiorDoor" : "zone";
  if (b.kind === "floor" || b.kind === "partition" || b.kind === "grille") return "zone";
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
      siding: { color: white ? "#efefec" : materials.sidingColor, roughness: 0.75, metalness: white ? 0.02 : 0.35 },
      roofing: { color: white ? "#e2e2df" : materials.roofColor, roughness: 0.7, metalness: white ? 0.04 : 0.4 },
      concrete: { color: white ? "#d9d8d4" : "#d2cfc7", roughness: 0.95, metalness: 0 },
      wood: { color: white ? "#e6e3dc" : "#dcc39c", roughness: 0.9, metalness: 0 },
      ptWood: { color: white ? "#dedbd4" : "#c9b48c", roughness: 0.9, metalness: 0 },
      glass: { color: "#9fc4d8", roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.45 },
      door: { color: white ? "#e2e2df" : materials.trimColor, roughness: 0.6, metalness: 0.1 },
      trim: { color: white ? "#efefec" : materials.trimColor, roughness: 0.6, metalness: 0.05 },
      grille: { color: white ? "#9a9a96" : "#3b3f44", roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.35 },
      mats: { color: white ? "#cfcfcc" : "#6b6763", roughness: 0.95, metalness: 0 },
      gravel: { color: white ? "#dadad6" : "#c2bdb0", roughness: 1, metalness: 0 },
      dirt: { color: white ? "#d8d5cf" : "#b19a80", roughness: 1, metalness: 0 },
      floorWood: { color: white ? "#e4e1da" : "#d4b489", roughness: 0.85, metalness: 0 },
      fixture: { color: "#fbfbf6", roughness: 0.4, metalness: 0.05, emissive: "#fff6dc", emissiveIntensity: 0.6 },
      device: { color: white ? "#b9b7b2" : "#6e7378", roughness: 0.6, metalness: 0.25 },
      wire: { color: white ? "#9a9894" : "#8e8f93", roughness: 0.5, metalness: 0.3 },
      pipe: { color: white ? "#e9e9e6" : "#f2f2ee", roughness: 0.45, metalness: 0.05 },
      grass: { color: white ? "#e3e4de" : "#8fae6a", roughness: 1, metalness: 0 },
      mesh: { color: white ? "#b5b3ae" : "#6e6a62", roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.4 },
      steel: { color: white ? "#c9c8c4" : "#8d9096", roughness: 0.45, metalness: 0.6 },
      stone: { color: white ? "#d6d3cc" : "#b3a48c", roughness: 0.95, metalness: 0 },
      wainscot: { color: white ? "#d0cec8" : materials.wainscot.color, roughness: 0.8, metalness: materials.wainscot.kind === "steel" ? 0.05 : 0 },
    };
    const by = new Map<string, Group>();
    for (const b of geometry.boxes) {
      if (!visible.has(b.layer)) continue;
      const key = `${b.material}`;
      let g = by.get(key);
      if (!g) {
        // Realistic mode: PBR maps in feet; a luminance albedo keeps the model's colour on painted steel and trim.
        const texKind = white ? null : textureFor(b.material, materials.wainscot.kind);
        const tex = texKind ? getTextureSet(texKind) : null;
        const base = palette[b.material];
        g = { key, boxes: [], ...base, textures: tex, uvRule: uvRuleFor(b.material, tex), color: tex && !tex.tinted ? "#ffffff" : base.color };
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
      if (kind === "opening" || kind === "member" || kind === "wall" || kind === "zone" || kind === "leanTo" || kind === "fixture" || kind === "interiorDoor" || kind === "drain" || kind === "drainOutlet") select(kind === "wall" ? "footprint" : id);
      openContextMenu({ kind, id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, from: "3d" });
    },
    [openContextMenu, select],
  );
  const onHover = useCallback((b: BoxMember | null) => setHovered(b ? selectionIdFor(b) : null), [setHovered]);

  return (
    <group>
      {groups.map((g) => (
        <MergedBoxes
          key={g.key}
          textures={g.textures}
          uvRule={g.uvRule}
          boxes={g.boxes}
          color={g.color}
          roughness={g.roughness}
          metalness={g.metalness}
          transparent={g.transparent}
          opacity={g.opacity}
          emissive={g.emissive}
          emissiveIntensity={g.emissiveIntensity}
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
            textures={renderMode === "white" ? null : getTextureSet("steelRibs")}
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

function Polygon({ member, color, textures, clippingPlanes, onClick, onContextMenu }: { member: PolygonMember; color: string; textures: TextureSet | null; clippingPlanes: THREE.Plane[]; onClick: () => void; onContextMenu: (e: ThreeEvent<MouseEvent>) => void }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = member.vertices;
    const positions: number[] = [];
    const uvs: number[] = [];
    // Gable ends stand in a vertical plane: u runs along the wall (x or z), v is height, so the ribs stand vertical.
    const alongX = Math.abs(verts[1][0] - verts[0][0]) >= Math.abs(verts[1][2] - verts[0][2]);
    const push = (v: [number, number, number]) => {
      positions.push(...v);
      uvs.push(alongX ? v[0] : v[2], v[1]);
    };
    for (let i = 1; i < verts.length - 1; i++) {
      push(verts[0]);
      push(verts[i]);
      push(verts[i + 1]);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    return g;
  }, [member]);
  const rep = textures ? 1 / textures.tileFt : 1;
  if (textures) for (const t of [textures.map, textures.normalMap, textures.roughnessMap]) t.repeat.set(rep, rep);
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
      <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={textures ? 1 : 0.6} metalness={textures ? 0.35 : 0.05} map={textures?.map ?? null} normalMap={textures?.normalMap ?? null} normalScale={textures ? new THREE.Vector2(textures.normalScale, textures.normalScale) : undefined} roughnessMap={textures?.roughnessMap ?? null} clippingPlanes={clippingPlanes} clipShadows />
    </mesh>
  );
}
