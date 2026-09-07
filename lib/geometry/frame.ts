import type { Vec3 } from "./types";

/** Plan (x east, y north) -> world (x east, y up, z south). ADR-0005. */
export function planToWorld(x: number, y: number, h = 0): Vec3 {
  return [x, h, -y];
}

/**
 * Euler XYZ angles equivalent to "yaw about world Y, then tilt about the
 * object's own X axis" (Ry(yaw) · Rx(tilt)). Sloped members on rotated walls
 * (lean-to rafters, roofs) need this; a plain [tilt, yaw, 0] tilts about the
 * WORLD x axis instead.
 */
export function eulerYX(yaw: number, tilt: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  // Rows of Ry(yaw) · Rx(tilt).
  const m11 = cy;
  const m12 = sy * st;
  const m13 = sy * ct;
  const m22 = ct;
  const m23 = -st;
  const m32 = cy * st;
  const m33 = cy * ct;
  // three.js Euler.setFromRotationMatrix, order XYZ.
  const y = Math.asin(Math.max(-1, Math.min(1, m13)));
  if (Math.abs(m13) < 0.9999999) return [Math.atan2(-m23, m33), y, Math.atan2(-m12, m11)];
  return [Math.atan2(m32, m22), y, 0];
}
