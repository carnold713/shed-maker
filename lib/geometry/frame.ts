import type { Vec3 } from "./types";

/** Plan (x east, y north) -> world (x east, y up, z south). ADR-0005. */
export function planToWorld(x: number, y: number, h = 0): Vec3 {
  return [x, h, -y];
}
