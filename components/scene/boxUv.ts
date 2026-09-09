/**
 * Texture coordinates for the faces of a box, in feet, oriented the way the
 * real material runs: wood grain along the member, steel ribs vertical on
 * walls and down the slope on roofs, boards-and-battens vertical. Pure so it
 * can be unit tested; used by MergedBoxes when it builds geometry.
 */

/** How a texture is laid onto a box. */
export type UvRule = "grain" | "ribsVertical" | "ribsSlope" | "plain";

/** Axis indices into a size triple. */
export type Axis = 0 | 1 | 2;

/**
 * For the face whose outward normal is along `faceAxis`, which local axes
 * carry u and v. `v` runs along the material's direction (grain, rib).
 */
export function faceAxes(size: [number, number, number], faceAxis: Axis, rule: UvRule): { u: Axis; v: Axis } {
  const others = ([0, 1, 2] as Axis[]).filter((a) => a !== faceAxis) as [Axis, Axis];
  const byLen = ([0, 1, 2] as Axis[]).slice().sort((a, b) => size[b] - size[a]);
  const longest = byLen[0];
  const middle = byLen[1];
  let v: Axis;
  if (rule === "grain") {
    v = longest === faceAxis ? others[1] : longest;
  } else if (rule === "ribsVertical") {
    v = faceAxis === 1 ? others[1] : 1;
  } else if (rule === "ribsSlope") {
    // Roof planes: the thin axis is the normal, the longest runs along the ridge, the middle one runs down the slope.
    v = middle === faceAxis ? longest : middle;
  } else {
    v = others[1];
  }
  const u = others.find((a) => a !== v) ?? others[0];
  return { u, v };
}

/** Texture coordinate (feet) of a corner of the box for a given face and rule. Corners are in local box space (centred). */
export function cornerUv(corner: [number, number, number], size: [number, number, number], faceAxis: Axis, rule: UvRule): [number, number] {
  const { u, v } = faceAxes(size, faceAxis, rule);
  return [corner[u] + size[u] / 2, corner[v] + size[v] / 2];
}
